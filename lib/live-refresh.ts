import type {Bar,Disposition,MarketSnapshot,Notice,Stock} from './market-types';
export const stripHtml=(v:unknown)=>String(v??'').replace(/<[^>]*>/g,'').trim();
export function toDate(v:unknown){const parts=String(v??'').match(/\d+/g);if(!parts)return null;let a=parts;if(parts.length===1&&[7,8].includes(parts[0].length)){const s=parts[0];a=[s.slice(0,-4),s.slice(-4,-2),s.slice(-2)];}if(a.length<3)return null;let y=Number(a[0]);if(y<1911)y+=1911;const m=Number(a[1]),d=Number(a[2]);if(m<1||m>12||d<1||d>31)return null;return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function numeric(v:unknown):number|null{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replaceAll(',','').trim());return Number.isFinite(n)?n:null;}
const cn:Record<string,number>={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14};
export function parseNotice(r:unknown[]):Notice{return {code:String(r[1]),name:String(r[2]),date:toDate(r[5])||'',reason:stripHtml(r[4]),rules:[...new Set([...String(r[4]).matchAll(/第([一二三四五六七八九十]+)款/g)].map(m=>cn[m[1]]).filter(Boolean))],close:numeric(r[6]),pe:numeric(r[7])};}
type Row=Record<string,unknown>; type Report={stat:string;data:unknown[][];title?:string};
async function fetchJson<T>(url:string):Promise<T>{const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('官方來源目前無法回應');const data=await response.json() as T;if(data&&typeof data==='object'&&'stat' in data&&(data as {stat:string}).stat!=='OK')throw new Error('官方來源尚未提供完整資料');return data;}
const common=(s:string)=>/^[1-9]\d{3}$/.test(s);
export async function refreshOfficial(previous:MarketSnapshot):Promise<MarketSnapshot>{
 const quotes=await fetchJson<Row[]>('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
 if(!Array.isArray(quotes)||quotes.length<100)throw new Error('行情筆數異常，保留上一版資料');
 const asOf=quotes.map(q=>toDate(q.Date)).filter((x):x is string=>!!x).sort().at(-1)!;
 if(asOf<previous.asOf)throw new Error('來源日期較舊，保留上一版資料');
 // A same-date check never silently replaces a saved complete batch with an empty holiday response.
 if(asOf===previous.asOf)return previous;
 const start=new Date(`${asOf}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-105);const compact=asOf.replaceAll('-','');
 const sources=[`https://www.twse.com.tw/announcement/notice?response=json&startDate=${start.toISOString().slice(0,10).replaceAll('-','')}&endDate=${compact}`,`https://www.twse.com.tw/announcement/notetrans?response=json&date=${compact}`,`https://www.twse.com.tw/announcement/punish?response=json&startDate=${start.toISOString().slice(0,10).replaceAll('-','')}&endDate=${compact}`,'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL','https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule'];
 const [noticeReport,candidateReport,dispositionReport,fundamentals,holidayRows]=await Promise.all([fetchJson<Report>(sources[0]),fetchJson<Report>(sources[1]),fetchJson<Report>(sources[2]),fetchJson<Row[]>(sources[3]),fetchJson<Row[]>(sources[4])]);
 const titleDate=toDate(candidateReport.title);if(titleDate!==asOf)throw new Error('候選公告尚未與行情同日，保留上一版完整資料');
 const notices=noticeReport.data.map(parseNotice).filter(n=>common(n.code)&&n.date&&n.date<=asOf);const todayNotices=notices.filter(n=>n.date===asOf);
 // Empty attention feeds cannot currently prove completion; fail closed until a batch collector verifies them.
 if(!todayNotices.length)throw new Error('當日注意公告為空，尚無法確認資料已完整發布');
 const candidates=new Map(candidateReport.data.filter(r=>common(String(r[1]))).map(r=>[String(r[1]),stripHtml(r[3])]));
 const dispositions:Disposition[]=dispositionReport.data.filter(r=>common(String(r[2]))).map(r=>{const period=String(r[6]).match(/\d{2,3}\/\d{1,2}\/\d{1,2}/g)||[];return {code:String(r[2]),name:String(r[3]),announced:toDate(r[1])||'',start:toDate(period[0]),end:toDate(period[1]),condition:stripHtml(r[5]),measure:stripHtml(r[7]),content:stripHtml(r[8])};}).filter(d=>d.announced&&d.announced<=asOf);
 const previousByCode=new Map(previous.stocks.map(s=>[s.code,s]));const fByCode=new Map(fundamentals.map(f=>[String(f.Code),f]));
 const companyUrl='https://openapi.twse.com.tw/v1/opendata/t187ap03_L';
 const companies=await fetchJson<Row[]>(companyUrl);if(!Array.isArray(companies)||companies.length<100)throw new Error('普通股公司分類無法核對');sources.push(companyUrl);
 const companyCodes=new Set(companies.map(c=>String(c['公司代號'])));
 const issuedSharesByCode=new Map(companies.map(c=>[String(c['公司代號']),numeric(c['已發行普通股數或TDR原股發行股數'])]));
 const paidInCapitalByCode=new Map(companies.map(c=>[String(c['公司代號']),numeric(c['實收資本額'])]));
 const symbols=new Set([...candidates.keys(),...todayNotices.map(n=>n.code),...dispositions.filter(d=>d.end&&d.end>=asOf).map(d=>d.code)].filter(code=>companyCodes.has(code)));
 const qByCode=new Map(quotes.filter(q=>toDate(q.Date)===asOf).map(q=>[String(q.Code),q]));
 const stocks:Stock[]=[];
 for(const code of symbols){const old=previousByCode.get(code),quote=qByCode.get(code);if(!quote)continue;const f=fByCode.get(code)||{},close=numeric(quote.ClosingPrice),change=numeric(quote.Change);const reference=close!==null&&change!==null?Number((close-change).toFixed(2)):null;let bars=old?.bars||[];
  const newBar:Bar={date:asOf,open:numeric(quote.OpeningPrice),high:numeric(quote.HighestPrice),low:numeric(quote.LowestPrice),close,reference,volume:numeric(quote.TradeVolume),note:''};
  // Always refill the last two calendar months, including missed sessions after an offline interval.
  for(const offset of [1,0]){const month=new Date(Date.UTC(Number(asOf.slice(0,4)),Number(asOf.slice(5,7))-1-offset,1));const historyUrl=`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month.toISOString().slice(0,10).replaceAll('-','')}&stockNo=${code}`;const payload=await fetchJson<Report>(historyUrl);sources.push(historyUrl);bars=[...bars,...payload.data.map(r=>{const c=numeric(r[6]),d=numeric(r[7]);return {date:toDate(r[0])||'',open:numeric(r[3]),high:numeric(r[4]),low:numeric(r[5]),close:c,reference:c!==null&&d!==null?Number((c-d).toFixed(2)):null,volume:numeric(r[1]),note:stripHtml(r[9])};}).filter(b=>b.date&&b.date<=asOf)];}
  // Keep official special-event annotations from the daily report.
  newBar.note=bars.findLast(b=>b.date===asOf)?.note||'';
  bars=[...new Map([...bars,newBar].map(b=>[b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-150);
  stocks.push({code,name:String(quote.Name),market:'TWSE',industry:old?.industry||'',close,change,changePercent:reference&&change!==null?change/reference*100:null,volume:numeric(quote.TradeVolume),issuedShares:issuedSharesByCode.get(code)??null,paidInCapital:paidInCapitalByCode.get(code)??null,pe:numeric(f.PEratio),pb:numeric(f.PBratio),valuationDate:asOf,bars,notices:notices.filter(n=>n.code===code).sort((a,b)=>b.date.localeCompare(a.date)),candidateReason:candidates.get(code)||null,dispositions:dispositions.filter(d=>d.code===code)});
 }
 const closed=new Set(holidayRows.filter(h=>!/(開始交易|最後交易)/.test(String(h.Name)+String(h.Description))).map(h=>toDate(h.Date)));
 const next=(date:string)=>{const d=new Date(`${date}T00:00:00Z`);do{d.setUTCDate(d.getUTCDate()+1);}while([0,6].includes(d.getUTCDay())||closed.has(d.toISOString().slice(0,10)));return d.toISOString().slice(0,10);};
 const generatedAt=new Date().toISOString(),targetDate=next(asOf);
 const verified=holidayRows.some(h=>toDate(h.Date)?.startsWith(asOf.slice(0,4)));
 if(!verified)throw new Error('交易日曆年份未完成核對');
 const sessions:string[]=[];let day=start.toISOString().slice(0,10);while(day<asOf){day=next(day);if(day<=asOf)sessions.push(day);}
 return {...previous,asOf,targetDate,effectiveDate:next(targetDate),generatedAt,calendarVerified:verified,corporateActionsAvailable:false,classificationVerified:true,calendar:[...new Set([...previous.calendar,...sessions])].sort(),stocks,todayNotices:todayNotices.filter(n=>companyCodes.has(n.code)),dispositions:dispositions.filter(d=>companyCodes.has(d.code)),sources:[...sources,'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'].map(url=>({url,observedAt:generatedAt})),ingestionErrors:[]};
}

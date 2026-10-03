import type { MarketSnapshot, PriceInterval, RiskForecast, RuleResult, Scenario, Simulation, Stock } from './market-types';

// Exact rational comparisons. Prices are stored in hundredths of NT dollars.
class Q {
  n:bigint; d:bigint;
  constructor(n:bigint,d=1n){if(!d)throw new Error('Invalid denominator');if(d<0n){n=-n;d=-d;}const g=Q.gcd(n<0n?-n:n,d);this.n=n/g;this.d=d/g;}
  static gcd(a:bigint,b:bigint):bigint{while(b){[a,b]=[b,a%b];}return a||1n;}
  static of(value:number|string){const s=String(value);if(!/^-?\d+(\.\d+)?$/.test(s))throw new Error('Invalid decimal');const parts=s.split('.');const scale=10n**BigInt(parts[1]?.length||0);return new Q(BigInt(parts.join('')),scale);}
  add(q:Q){return new Q(this.n*q.d+q.n*this.d,this.d*q.d)} sub(q:Q){return this.add(new Q(-q.n,q.d))} mul(q:Q){return new Q(this.n*q.n,this.d*q.d)} div(q:Q){return new Q(this.n*q.d,this.d*q.n)} cmp(q:Q){const v=this.n*q.d-q.n*this.d;return v<0n?-1:v>0n?1:0} abs(){return new Q(this.n<0n?-this.n:this.n,this.d)} num(){return Number(this.n)/Number(this.d)} trunc2(){return new Q(this.n*100n/this.d,100n)}
}
const q=(x:number|string)=>Q.of(x), money=(x:number)=>q(x.toFixed(2));
const positive=(x:number|null|undefined):x is number=>x!=null&&Number.isFinite(x)&&x>0;
export const DEFAULT_SCENARIO:Scenario={market6:0,industry6:0,market30:0,industry30:0,market60:0,industry60:0,market90:0,industry90:0,marketPe:30,marketPb:2,industryPb:3};
export const RULESET_VERSION='TW-MARKETS-2026-08-10-v0.3';
export const RULES_URL='https://twse-regulation.twse.com.tw/TW/law/DAT0201.aspx?FLCODE=FL007226';

export function validateScenario(input:unknown):Scenario{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('情境格式錯誤');
  const raw=input as Record<string,unknown>, result={...DEFAULT_SCENARIO};
  const keys=Object.keys(DEFAULT_SCENARIO) as (keyof typeof DEFAULT_SCENARIO)[];
  for(const key of Object.keys(raw)){if(!keys.includes(key as keyof Scenario)&&key!=='referencePrice')throw new Error('情境欄位不支援');}
  for(const key of keys){const v=raw[key]??result[key];if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1000)throw new Error('情境數值須介於 -1000 至 1000');if(['marketPe','marketPb','industryPb'].includes(key)&&v<=0)throw new Error('估值平均值須大於零');result[key]=v;}
  if(raw.referencePrice!==undefined){const r=raw.referencePrice;if(typeof r!=='number'||!Number.isFinite(r)||r<.01||r>1000000||Math.abs(r*100-Math.round(r*100))>1e-6)throw new Error('參考價格式錯誤');result.referencePrice=r;}
  return result;
}
export function tickCents(c:number){return c<1000?1:c<5000?5:c<10000?10:c<50000?50:c<100000?100:500;}
/** Rule six needs both 3,000 trading units and 5% turnover; common-stock units are 1,000 shares. */
export function sixthClauseMinimumShares(issuedShares:number|null|undefined):number|null{
  if(!positive(issuedShares))return null;
  return Math.max(3_000_000,Math.ceil(issuedShares*0.05));
}
export function legalPrices(reference:number):number[]{
  if(!positive(reference)||reference>1000000)throw new Error('無效參考價');
  const base=Math.round(reference*100);const lo=Math.ceil(base*9/10),hi=Math.floor(base*11/10);const prices:number[]=[];
  let c=lo;while(c<=hi){const tick=tickCents(c);if(c%tick){c+=tick-c%tick;continue;}prices.push(c/100);c+=tick;}
  return prices;
}
export function cumulativeReturn(bars:Stock['bars']):number|null{
  if(!bars.length||bars.some(b=>!positive(b.close)||!positive(b.reference)))return null;
  return cumulativeQ(bars).num();
}
// Daily percentage truncation reconciles all 24 eligible official announcements in the initial batch.
// This is an empirically validated convention, not a claim of a fully verified exchange implementation.
function cumulativeQ(bars:Stock['bars']){return bars.reduce((r,b)=>r.add(money(b.close!).div(money(b.reference!)).sub(q(1)).mul(q(100)).trunc2()),q(0));}
export function countGate(stock:Stock,calendar:string[],asOf:string){
  const dates=calendar.filter(d=>d<=asOf);const byDate=new Map<string,Set<number>>();
  for(const n of stock.notices){const set=byDate.get(n.date)||new Set<number>();n.rules.forEach(r=>set.add(r));byDate.set(n.date,set);}
  const first=(d:string)=>byDate.get(d)?.has(1)||false;
  const any=(d:string)=>[...(byDate.get(d)||[])].some(r=>r>=1&&r<=8);
  const streak=(fn:(d:string)=>boolean)=>{let n=0;for(const d of [...dates].reverse()){if(!fn(d))break;n++;}return n;};
  const firstStreak=streak(first),anyStreak=streak(any),nineCount=dates.slice(-9).filter(any).length,twentyNineCount=dates.slice(-29).filter(any).length;
  const paths:string[]=[];
  if(firstStreak>=2)paths.push('第一款連續三日');if(anyStreak>=4)paths.push('連續五日');if(dates.length>=9&&nineCount>=5)paths.push('十日內六日');if(dates.length>=29&&twentyNineCount>=11)paths.push('三十日內十二日');
  return {official:!!stock.candidateReason,paths,firstStreak,anyStreak,nineCount,twentyNineCount};
}
export function forecastDispositionRisk(stock:Stock,snapshot:Pick<MarketSnapshot,'asOf'|'targetDate'|'effectiveDate'|'forecastDates'|'calendar'>,horizon=3):RiskForecast|null{
  const future=(snapshot.forecastDates?.length?snapshot.forecastDates:[snapshot.targetDate,snapshot.effectiveDate]).slice(0,horizon);
  if(!future.length)return null;
  // The exchange's accumulation list is conditional: another qualifying
  // attention notice on the next session would trigger disposition. It is
  // not itself a declaration that a disposition will happen tomorrow.
  if(stock.candidateReason)return {days:1,date:future[0],paths:['次一營業日再達注意標準時，將公告處置'],official:true};
  const history=snapshot.calendar.filter(d=>d<=snapshot.asOf),base=countGate(stock,history,snapshot.asOf);
  const countable=new Set(stock.notices.filter(n=>n.rules.some(r=>r>=1&&r<=8)).map(n=>n.date));
  for(let index=0;index<future.length;index++){
    const days=(index+1) as 1|2|3,assumed=future.slice(0,days),sessions=[...history,...assumed];
    const isCountable=(date:string)=>countable.has(date)||assumed.includes(date);
    const paths:string[]=[];
    if(base.firstStreak>0&&base.firstStreak+days>=3)paths.push('第一款連續三日');
    if(base.anyStreak>0&&base.anyStreak+days>=5)paths.push('第 1–8 款連續五日');
    if(sessions.slice(-10).filter(isCountable).length>=6)paths.push('十日內六日');
    if(sessions.slice(-30).filter(isCountable).length>=12)paths.push('三十日內十二日');
    if(paths.length)return {days,date:future[index],paths,official:false};
  }
  return null;
}
function mergePrices(prices:number[],matches:(p:number)=>boolean,reference:number,rule:number):PriceInterval[]{
  const intervals:PriceInterval[]=[];let current:PriceInterval|undefined;
  for(const p of prices){if(matches(p)){const direction=p>=reference?'up':'down';if(current&&current.direction===direction)current.to=p;else{current={from:p,to:p,direction,rule};intervals.push(current);}}else current=undefined;}
  return intervals;
}
function result(rule:number,label:string,intervals:PriceInterval[],conditions:string[],reason?:string):RuleResult{return {rule,label,status:reason?'missing':intervals.length?'conditional':'no_price',intervals,conditions,...(reason?{reason}:{})};}

export function simulate(stock:Stock,snapshot:Pick<MarketSnapshot,'asOf'|'targetDate'|'effectiveDate'|'calendar'|'calendarVerified'>,raw:unknown=DEFAULT_SCENARIO):Simulation{
  const scenario=validateScenario(raw), reference=scenario.referencePrice??stock.close;
  if(!positive(reference))throw new Error('缺少有效收盤或參考價格');
  const prices=legalPrices(reference),bars=stock.bars.filter(b=>b.date<=snapshot.asOf),lastFive=bars.slice(-5),dates=snapshot.calendar.filter(d=>d<=snapshot.asOf);
  const historyOkay=lastFive.length===5&&lastFive.every(b=>positive(b.close)&&positive(b.reference)&&!b.note)&&lastFive.every((b,i)=>b.date===dates.slice(-5)[i]);
  const historicalSum=historyOkay?cumulativeQ(lastFive):q(0);
  const six=(p:number)=>historicalSum.add(money(p).div(money(reference)).sub(q(1)).mul(q(100)).trunc2());
  const peExemption=stock.market==='TPEX'?65:60;
  const industryExempt=(p:number)=>stock.pe!==null&&positive(stock.close)&&stock.valuationDate===snapshot.asOf&&(stock.pe<0||q(stock.pe).mul(money(p)).div(money(stock.close)).cmp(q(peExemption))>=0);
  const differential=(r:Q,market:number,industry:number,min:number,exempt:boolean)=>r.cmp(q(0))>=0?(r.sub(q(market)).cmp(q(min))>=0&&(exempt||r.sub(q(industry)).cmp(q(min))>=0)):(q(market).sub(r).cmp(q(min))>=0&&(exempt||q(industry).sub(r).cmp(q(min))>=0));
  const firstMatches=(p:number)=>{const r=six(p);return p>=5&&differential(r,scenario.market6,scenario.industry6,20,industryExempt(p))&&(r.abs().cmp(q(32))>0||(r.abs().cmp(q(25))>0&&money(p).sub(money(lastFive[0].close!)).abs().cmp(q(50))>=0));};
  const shared=['普通股、正常漲跌幅限制及交易狀態不變。','未發生尚未處理的除權息、減資或其他非交易價格變動。','市場與同類平均值為輸入的情境假設，並非明日已知數據。'];
  const rules:RuleResult[]=[];
  rules.push(result(1,'六日累積漲跌幅',historyOkay?mergePrices(prices,firstMatches,reference,1):[],[...shared,`每股盈餘不變，以試算價格重估本益比；負值或達 ${peExemption} 倍時免同類差幅比較。`,'同類證券至少五種；少於五種的除外條件尚需確認。','每日報酬百分比先向零截至小數兩位再加總；已與上市初始批次 24 筆歷史公告核對。'],historyOkay?undefined:'缺少連續五日有效報酬或有特殊註記'));

  rules.push(result(2,'三十／六十／九十日漲跌幅',[],[...shared,'長期企業行動及處置除外條件需完整驗證後開放。'],'第二款尚未完成企業行動與除外條件驗證，暫不提供門檻'));

  const valuationReady=stock.close!==null&&stock.pe!==null&&stock.pb!==null&&stock.pb>0&&stock.valuationDate===snapshot.asOf;
  const sixthMatch=(p:number)=>{
    const relative=money(p).div(money(stock.close!));const pe=q(stock.pe!).mul(relative),pb=q(stock.pb!).mul(relative);
    return (pe.cmp(q(0))<0||(pe.cmp(q(60))>=0&&pe.cmp(q(scenario.marketPe).mul(q(2)))>0))&&pb.cmp(q(6))>=0&&pb.cmp(q(scenario.marketPb).mul(q(2)))>0&&pb.cmp(q(scenario.industryPb).mul(q(4)))>=0;
  };
  rules.push(result(6,'估值與週轉率・產業比較分支',valuationReady?mergePrices(prices,sixthMatch,reference,6):[],['每股盈餘、每股淨值與本益比正負狀態不變。','當日週轉率至少 5%，且成交量至少 3,000 交易單位；依規定扣除鉅額交易。','全市場本益比、股價淨值比及產業股價淨值比為目前選擇的情境。','僅試算產業股價淨值比分支，券商／單一投資人集中度分支未涵蓋。'],valuationReady?undefined:'缺少同一交易日的本益比或股價淨值比'));
  return {code:stock.code,asOf:snapshot.asOf,targetDate:snapshot.targetDate,effectiveDate:snapshot.effectiveDate,rulesVersion:RULESET_VERSION,scenario,reference,referenceAssumed:scenario.referencePrice===undefined,limits:{low:prices[0],high:prices.at(-1)!},gate:countGate(stock,dates,snapshot.asOf),rules,intervals:rules.flatMap(r=>r.intervals),limitations:['本結果為指定情境的注意條件價格試算，並非確定處置價格。','第三、四、五、七至十四款及特殊決議尚未實作；無門檻不代表不會處置。',...(!snapshot.calendarVerified?['下一交易日依平日推估，官方休市表未成功取得。']:[])]};
}

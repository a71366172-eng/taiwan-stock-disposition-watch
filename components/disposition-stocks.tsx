import {CalendarDays,ExternalLink,Info,ShieldAlert} from 'lucide-react';
import {useState} from 'react';
import {dispositionMetrics} from '../lib/disposition-metrics';
import type {Disposition,MarketSnapshot,Stock} from '../lib/market-types';
import {SiteShell} from './site-shell';

type ActiveItem={disposition:Disposition;stock?:Stock;metrics:ReturnType<typeof dispositionMetrics>};
type Sort='end'|'return-high'|'return-low'|'five-day-high'|'five-day-low'|'ten-day-high'|'ten-day-low'|'institutional-buy'|'institutional-sell'|'ma20-high'|'ma20-low';
type Direction='all'|'positive'|'negative';
const compareNullable=(a:number|null|undefined,b:number|null|undefined,descending:boolean)=>a==null?(b==null?0:1):b==null?-1:descending?b-a:a-b;
const directionMatches=(value:number|null|undefined,direction:Direction)=>direction==='all'||(value!=null&&(direction==='positive'?value>0:value<0));
const todayTaipei=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const lots=(shares:number|null|undefined)=>shares==null?'—':`${shares>0?'+':''}${(shares/1000).toLocaleString('zh-TW',{maximumFractionDigits:1})} 張`;
const date=(value:string|null)=>value?.replaceAll('-','.')||'—';
const price=(value:number|null|undefined)=>value==null?'—':value.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
const percent=(value:number|null)=>value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
const percentTone=(value:number|null)=>value===null?'muted':value>0?'up':value<0?'down':'';

export function DispositionStocks({snapshot}:{snapshot:MarketSnapshot}){
 const [tier,setTier]=useState<'all'|'first'|'repeat'>('all'),[market,setMarket]=useState<'ALL'|'TWSE'|'TPEX'>('ALL'),[search,setSearch]=useState(''),[sort,setSort]=useState<Sort>('end'),[view,setView]=useState<'list'|'grid'>('list');
 const [endWithin,setEndWithin]=useState('all'),[returnDirection,setReturnDirection]=useState<Direction>('all'),[institutionalDirection,setInstitutionalDirection]=useState<Direction>('all'),[ma20Direction,setMa20Direction]=useState<Direction>('all'),[fiveDayDirection,setFiveDayDirection]=useState<Direction>('all'),[tenDayDirection,setTenDayDirection]=useState<Direction>('all');
 const referenceDate=[snapshot.asOf,todayTaipei()].sort().at(-1)!;
 const byCode=new Map(snapshot.stocks.map(stock=>[stock.code,stock]));
 const unique=new Map<string,Disposition>();
 for(const disposition of snapshot.dispositions){
  if(!disposition.start||!disposition.end||disposition.start>referenceDate||disposition.end<referenceDate)continue;
  const previous=unique.get(disposition.code);
  if(!previous||disposition.start>previous.start!)unique.set(disposition.code,disposition);
 }
 const items:ActiveItem[]=[...unique.values()].map(disposition=>{const stock=byCode.get(disposition.code);return {disposition,stock,metrics:dispositionMetrics(disposition,stock,referenceDate)};});
 const visibleItems=items.filter(({disposition,stock,metrics})=>{
  const repeat=/第二次|再次處置|曾發布處置交易資訊/.test(`${disposition.measure} ${disposition.content}`);
  const matchesTier=tier==='all'||(tier==='repeat')===repeat;
  const matchesMarket=market==='ALL'||stock?.market===market;
  const matchesSearch=!search||`${disposition.code}${stock?.name||disposition.name}`.toLowerCase().includes(search.toLowerCase());
  return matchesTier&&matchesMarket&&matchesSearch&&(endWithin==='all'||metrics.calendarDaysUntilEnd<=Number(endWithin))
   &&directionMatches(metrics.periodChangePercent,returnDirection)
   &&directionMatches(metrics.fiveDayChangePercent,fiveDayDirection)
   &&directionMatches(metrics.tenDayChangePercent,tenDayDirection)
   &&directionMatches(stock?.institutionalNet5Shares,institutionalDirection)
   &&directionMatches(metrics.ma20DeviationPercent,ma20Direction);
 }).sort((a,b)=>{
  let result=0;
  if(sort==='end')result=a.metrics.calendarDaysUntilEnd-b.metrics.calendarDaysUntilEnd;
  if(sort==='return-high')result=compareNullable(a.metrics.periodChangePercent,b.metrics.periodChangePercent,true);
  if(sort==='return-low')result=compareNullable(a.metrics.periodChangePercent,b.metrics.periodChangePercent,false);
  if(sort==='five-day-high')result=compareNullable(a.metrics.fiveDayChangePercent,b.metrics.fiveDayChangePercent,true);
  if(sort==='five-day-low')result=compareNullable(a.metrics.fiveDayChangePercent,b.metrics.fiveDayChangePercent,false);
  if(sort==='ten-day-high')result=compareNullable(a.metrics.tenDayChangePercent,b.metrics.tenDayChangePercent,true);
  if(sort==='ten-day-low')result=compareNullable(a.metrics.tenDayChangePercent,b.metrics.tenDayChangePercent,false);
  if(sort==='institutional-buy')result=compareNullable(a.stock?.institutionalNet5Shares,b.stock?.institutionalNet5Shares,true);
  if(sort==='institutional-sell')result=compareNullable(a.stock?.institutionalNet5Shares,b.stock?.institutionalNet5Shares,false);
  if(sort==='ma20-high')result=compareNullable(a.metrics.ma20DeviationPercent,b.metrics.ma20DeviationPercent,true);
  if(sort==='ma20-low')result=compareNullable(a.metrics.ma20DeviationPercent,b.metrics.ma20DeviationPercent,false);
  return result||a.disposition.end!.localeCompare(b.disposition.end!)||a.disposition.code.localeCompare(b.disposition.code);
 });
 const institutionalCount=items.filter(({stock})=>stock?.institutionalNet5Shares!=null).length;
 return <SiteShell active="dispositions">
  <div className="page-heading"><div><div className="eyebrow">OFFICIAL DISPOSITION NOTICES</div><h1>處置股<span className="heading-dot">.</span></h1><p>依證交所與櫃買中心公告，列出目前仍在處置期間的股票。</p></div><div className="date-stamp"><CalendarDays size={18}/><div>行情資料日<strong>{snapshot.asOf.replaceAll('-','.')}</strong></div></div></div>
  <div className="summary-grid disposition-summary"><div className="summary-card featured"><div className="summary-label">目前處置股</div><div className="summary-number">{items.length}<span>檔</span></div><p>截至 {date(referenceDate)} 仍在處置期間</p></div><div className="summary-card"><div className="summary-label">報酬計算基準</div><div className="status-value">處置起始日</div><p>起始日收盤價至最新可用收盤價；不含股利及交易成本。</p></div><div className="summary-card"><div className="summary-label">三大法人 5 日資料</div><div className="status-value">{institutionalCount} / {items.length} 檔</div><p>最近 5 個交易日買賣超合計；與券商分點主力不同。</p></div></div>
  {items.length===0?<section className="panel"><div className="empty-state"><ShieldAlert size={32}/><h2>目前沒有處置中的股票</h2><p>已依公告處置區間核對至 {referenceDate}，正式資料仍以交易所公告為準。</p></div></section>:<section className="panel disposition-panel">
   <div className="panel-heading"><div><h2>處置期間一覽</h2><p>出關倒數以台灣日期計算曆日；行情與法人資料截至 {snapshot.asOf}。</p></div><span className="badge amber">{visibleItems.length} / {items.length} 檔</span></div>
   <div className="disposition-tools">
    <div className="segmented-control" aria-label="處置次數">{(['all','first','repeat'] as const).map(value=><button key={value} className={tier===value?'active':''} onClick={()=>setTier(value)}>{value==='all'?'全部':value==='first'?'首次處置':'再次處置'}</button>)}</div>
    <div className="segmented-control" aria-label="市場">{(['ALL','TWSE','TPEX'] as const).map(value=><button key={value} className={market===value?'active':''} onClick={()=>setMarket(value)}>{value==='ALL'?'全部':value==='TWSE'?'上市':'上櫃'}</button>)}</div>
    <input className="disposition-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜尋股票代號或名稱" aria-label="搜尋處置股"/>
    <label className="disposition-sort">出關<select value={endWithin} onChange={event=>setEndWithin(event.target.value)}><option value="all">全部日期</option><option value="0">今天</option><option value="3">3 天內</option><option value="7">7 天內</option></select></label>
    <label className="disposition-sort">期間漲跌<select value={returnDirection} onChange={event=>setReturnDirection(event.target.value as Direction)}><option value="all">全部</option><option value="positive">上漲</option><option value="negative">下跌</option></select></label>
    <label className="disposition-sort">5 日漲跌<select value={fiveDayDirection} onChange={event=>setFiveDayDirection(event.target.value as Direction)}><option value="all">全部</option><option value="positive">上漲</option><option value="negative">下跌</option></select></label>
    <label className="disposition-sort">10 日漲跌<select value={tenDayDirection} onChange={event=>setTenDayDirection(event.target.value as Direction)}><option value="all">全部</option><option value="positive">上漲</option><option value="negative">下跌</option></select></label>
    <label className="disposition-sort">法人 5 日<select value={institutionalDirection} onChange={event=>setInstitutionalDirection(event.target.value as Direction)}><option value="all">全部</option><option value="positive">買超</option><option value="negative">賣超</option></select></label>
    <label className="disposition-sort">20MA 乖離<select value={ma20Direction} onChange={event=>setMa20Direction(event.target.value as Direction)}><option value="all">全部</option><option value="positive">均線之上</option><option value="negative">均線之下</option></select></label>
    <label className="disposition-sort">排序<select value={sort} onChange={event=>setSort(event.target.value as Sort)}><option value="end">最早出關</option><option value="return-high">期間漲幅高至低</option><option value="return-low">期間漲幅低至高</option><option value="five-day-high">5 日漲幅高至低</option><option value="five-day-low">5 日漲幅低至高</option><option value="ten-day-high">10 日漲幅高至低</option><option value="ten-day-low">10 日漲幅低至高</option><option value="ma20-high">20MA 乖離高至低</option><option value="ma20-low">20MA 乖離低至高</option><option value="institutional-buy">法人買超高至低</option><option value="institutional-sell">法人賣超高至低</option></select></label>
    <div className="view-toggle" aria-label="檢視方式"><button className={view==='list'?'active':''} aria-label="列表檢視" onClick={()=>setView('list')}>≡</button><button className={view==='grid'?'active':''} aria-label="格狀檢視" onClick={()=>setView('grid')}>▦</button></div>
   </div>
   <div className={`disposition-list ${view==='grid'?'grid-view':''}`}>{visibleItems.map(({disposition:d,stock,metrics})=>{
   const repeat=/第二次|再次處置|曾發布處置交易資訊/.test(`${d.measure} ${d.content}`);
   const institutional=stock?.institutionalNet5Shares;
   return <article className={`disposition-card ${repeat?'repeat-disposition':''}`} key={`${d.code}-${d.start}`}>
    <div className="disposition-card-head"><a href={`#/stocks/${d.code}`} className="disposition-stock"><strong>{d.code}</strong><span>{stock?.name||d.name}</span><small>{stock?.market==='TPEX'?'上櫃':stock?.market==='TWSE'?'上市':'市場未提供'} · 查看個股 ↗</small></a><div className="disposition-status"><span className="disposition-tier-badge">{repeat?'再次處置':'首次處置'}</span><span className="period-badge">{date(d.start)} — {date(d.end)}</span></div></div>
    <div className="disposition-metrics">
     <div><small>離出關日 · 曆日</small><strong>{metrics.calendarDaysUntilEnd===0?'今天出關':`${metrics.calendarDaysUntilEnd} 天`}</strong><small>{date(d.end)} 結束</small></div>
     <div><small>處置期間漲跌幅</small><strong className={percentTone(metrics.periodChangePercent)}>{percent(metrics.periodChangePercent)}</strong><small>{metrics.startClose===null?'缺少起始日收盤價':`${price(metrics.startClose)} → ${price(metrics.latestClose)} 元`}</small></div>
     <div><small>5 日漲幅</small><strong className={percentTone(metrics.fiveDayChangePercent)}>{percent(metrics.fiveDayChangePercent)}</strong><small>相較 5 個交易日前</small></div>
     <div><small>10 日漲幅</small><strong className={percentTone(metrics.tenDayChangePercent)}>{percent(metrics.tenDayChangePercent)}</strong><small>相較 10 個交易日前</small></div>
     <div><small>20MA 乖離率</small><strong className={percentTone(metrics.ma20DeviationPercent)}>{percent(metrics.ma20DeviationPercent)}</strong><small>{metrics.ma20===null?'未滿 20 個交易日收盤價':`20 日均線 ${price(metrics.ma20)} 元`}</small></div>
     <div><small>三大法人 5 日買賣超</small><strong className={institutional==null?'muted':institutional>0?'up':institutional<0?'down':''}>{lots(institutional)}</strong><small>{institutional==null?'官方資料尚未齊全':'最近 5 個交易日合計'}</small></div>
    </div>
    <div className="disposition-reason"><strong>本次公告原因</strong><p>{d.condition||d.content||'請查看交易所原始公告。'}</p>{d.content&&d.content!==d.condition&&<details><summary>查看公告補充內容</summary><p>{d.content}</p></details>}</div>
   </article>;
   })}{visibleItems.length===0&&<div className="empty-state"><ShieldAlert size={28}/><h2>沒有符合篩選條件的股票</h2><p>請調整出關日、漲跌幅、20MA 乖離、法人買賣超或搜尋文字。</p></div>}</div><div className="panel-note"><Info size={16}/><p>期間漲跌幅＝最新可用收盤價 ÷ 處置開始日收盤價 − 1。5 日／10 日漲幅＝最新可用收盤價 ÷ 5／10 個交易日前收盤價 − 1，均不含股利；不足 6／11 筆有效收盤價時顯示缺值。20MA 乖離率＝（最新可用收盤價 ÷ 最近 20 個交易日收盤價平均 − 1）× 100%；正值表示股價在均線之上，並非保證後續上漲。三大法人 5 日買賣超是外資、投信、自營商官方每日淨買賣股數合計，單位換算為張；它與券商分點主力不同。缺資料的股票不納入相關篩選，排序時列在最後。</p></div></section>}
  <section className="panel repeat-rules"><div className="panel-heading"><div><h2>什麼情況可能再次進入處置？</h2><p>是否處置由交易所依公告與監視程序認定，不代表股票會自動進入下一次處置。</p></div></div><div className="repeat-rules-body"><p>處置結束後，若再次達到處置發布標準，交易所可能再次公告處置。主要累計門檻包括：</p><ul><li>連續 3 個營業日，依規定發布第一款注意交易資訊；或</li><li>連續 5 個營業日，或最近 10 個營業日有 6 日，或最近 30 個營業日有 12 日，依規定發布第一至第八款注意交易資訊。</li></ul><p>若最近 30 個營業日內第二次（含）以上依上述標準發布處置，交易所可能採較嚴格措施，例如更嚴格的預收款券範圍。實際措施與期間請以個別公告為準。</p><div className="official-links"><a href="https://twse-regulation.twse.com.tw/tw/law/DOC01.aspx?FLCODE=FL007225&FLNO=6" target="_blank" rel="noreferrer">證交所處置作業要點第六條 <ExternalLink size={14}/></a><a href="https://www.tpex.org.tw/zh-tw/announcement/mainboard/warning.html" target="_blank" rel="noreferrer">櫃買中心累計門檻說明 <ExternalLink size={14}/></a></div></div></section>
 </SiteShell>;
}

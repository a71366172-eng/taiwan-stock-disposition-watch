import {CalendarDays,ExternalLink,Info,ShieldAlert} from 'lucide-react';
import {useState} from 'react';
import type {Disposition,MarketSnapshot,Stock} from '../lib/market-types';
import {SiteShell} from './site-shell';

type ActiveItem={disposition:Disposition;stock?:Stock};
const daysBetween=(from:string,to:string)=>Math.max(0,Math.ceil((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000));
const date=(value:string|null)=>value?.replaceAll('-','.')||'—';
const price=(value:number|null|undefined)=>value==null?'—':value.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});

export function DispositionStocks({snapshot}:{snapshot:MarketSnapshot}){
 const [tier,setTier]=useState<'all'|'first'|'repeat'>('all'),[market,setMarket]=useState<'ALL'|'TWSE'|'TPEX'>('ALL'),[search,setSearch]=useState(''),[sort,setSort]=useState<'end'|'change'>('end'),[view,setView]=useState<'list'|'grid'>('list');
 const byCode=new Map(snapshot.stocks.map(stock=>[stock.code,stock]));
 const unique=new Map<string,ActiveItem>();
 for(const disposition of snapshot.dispositions){
  if(!disposition.start||!disposition.end||disposition.start>snapshot.asOf||disposition.end<snapshot.asOf)continue;
  const previous=unique.get(disposition.code);
  if(!previous||disposition.start>previous.disposition.start!)unique.set(disposition.code,{disposition,stock:byCode.get(disposition.code)});
 }
 const items=[...unique.values()].sort((a,b)=>a.disposition.end!.localeCompare(b.disposition.end!)||a.disposition.code.localeCompare(b.disposition.code));
 const visibleItems=items.filter(({disposition,stock})=>{const repeat=/第二次|再次處置|曾發布處置交易資訊/.test(`${disposition.measure} ${disposition.content}`),matchesTier=tier==='all'||(tier==='repeat')===repeat,matchesMarket=market==='ALL'||stock?.market===market,matchesSearch=!search||`${disposition.code}${stock?.name||disposition.name}`.toLowerCase().includes(search.toLowerCase());return matchesTier&&matchesMarket&&matchesSearch;}).sort((a,b)=>sort==='end'?a.disposition.end!.localeCompare(b.disposition.end!):((b.stock?.changePercent||0)-(a.stock?.changePercent||0)));
 return <SiteShell active="dispositions">
  <div className="page-heading"><div><div className="eyebrow">OFFICIAL DISPOSITION NOTICES</div><h1>處置股<span className="heading-dot">.</span></h1><p>依證交所與櫃買中心公告，列出資料日仍在處置期間的股票。</p></div><div className="date-stamp"><CalendarDays size={18}/><div>資料交易日<strong>{snapshot.asOf.replaceAll('-','.')}</strong></div></div></div>
  <div className="summary-grid disposition-summary"><div className="summary-card featured"><div className="summary-label">目前處置股</div><div className="summary-number">{items.length}<span>檔</span></div><p>按處置結束日由近至遠排序</p></div><div className="summary-card"><div className="summary-label">報酬計算基準</div><div className="status-value">處置起始日</div><p>起始日收盤價至最新可用收盤價；含價格變動，不含股利及交易成本。</p></div><div className="summary-card"><div className="summary-label">再度處置門檻</div><div className="status-value">30 個營業日</div><p>期間內第二次（含）以上達發布標準，可能採較嚴格措施。</p></div></div>
  {items.length===0?<section className="panel"><div className="empty-state"><ShieldAlert size={32}/><h2>資料日沒有處置中的股票</h2><p>此頁僅列出公告處置期間涵蓋 {snapshot.asOf} 的股票，資料仍以交易所公告為準。</p></div></section>:<section className="panel disposition-panel"><div className="panel-heading"><div><h2>處置期間一覽</h2><p>以下期間及措施取自交易所公告；剩餘天數為曆日估算。</p></div><span className="badge amber">{visibleItems.length} / {items.length} 檔</span></div><div className="disposition-tools"><div className="segmented-control" aria-label="處置次數">{(['all','first','repeat'] as const).map(value=><button key={value} className={tier===value?'active':''} onClick={()=>setTier(value)}>{value==='all'?'全部':value==='first'?'首次處置':'再次處置'}</button>)}</div><div className="segmented-control" aria-label="市場">{(['ALL','TWSE','TPEX'] as const).map(value=><button key={value} className={market===value?'active':''} onClick={()=>setMarket(value)}>{value==='ALL'?'全部':value==='TWSE'?'上市':'上櫃'}</button>)}</div><input className="disposition-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜尋股票代號或名稱" aria-label="搜尋處置股"/><label className="disposition-sort">排序<select value={sort} onChange={event=>setSort(event.target.value as 'end'|'change')}><option value="end">到期時間</option><option value="change">漲幅由高至低</option></select></label><div className="view-toggle" aria-label="檢視方式"><button className={view==='list'?'active':''} aria-label="列表檢視" onClick={()=>setView('list')}>≡</button><button className={view==='grid'?'active':''} aria-label="格狀檢視" onClick={()=>setView('grid')}>▦</button></div></div><div className={`disposition-list ${view==='grid'?'grid-view':''}`}>{visibleItems.map(({disposition:d,stock})=>{
   const startBar=stock?.bars.find(bar=>bar.date===d.start&&bar.close!==null);
   const latest=stock?.bars.filter(bar=>bar.date<=snapshot.asOf&&bar.close!==null).at(-1);
   const startClose=startBar?.close??null,latestClose=latest?.close??stock?.close??null;
   const returnPct=startClose&&latestClose!==null?((latestClose/startClose)-1)*100:null;
   const remaining=daysBetween(snapshot.asOf,d.end!);
   const repeat=/第二次|再次處置|曾發布處置交易資訊/.test(`${d.measure} ${d.content}`);
   return <article className={`disposition-card ${repeat?'repeat-disposition':''}`} key={`${d.code}-${d.start}`}>
    <div className="disposition-card-head"><a href={`#/stocks/${d.code}`} className="disposition-stock"><strong>{d.code}</strong><span>{stock?.name||d.name}</span><small>{stock?.market==='TPEX'?'上櫃':stock?.market==='TWSE'?'上市':'市場未提供'} · 查看個股 ↗</small></a><div className="disposition-status"><span className="disposition-tier-badge">{repeat?'再次處置':'首次處置'}</span><span className="period-badge">{date(d.start)} — {date(d.end)}</span><span className="remaining-badge">剩 {remaining} 天</span></div></div>
    <div className="disposition-metrics"><div><small>處置區間</small><strong>{date(d.start)} — {date(d.end)}</strong></div><div><small>處置措施</small><strong>{d.measure||'依公告內容辦理'}</strong></div><div><small>期間漲跌幅</small><strong className={returnPct===null?'muted':returnPct>0?'up':returnPct<0?'down':''}>{returnPct===null?'—':`${returnPct>0?'+':''}${returnPct.toFixed(2)}%`}</strong><small>{startClose===null?'缺少處置起始日收盤行情':`起始 ${price(startClose)} 元 → 最新 ${price(latestClose)} 元`}</small></div></div>
    <div className="disposition-reason"><strong>本次公告原因</strong><p>{d.condition||d.content||'請查看交易所原始公告。'}</p>{d.content&&d.content!==d.condition&&<details><summary>查看公告補充內容</summary><p>{d.content}</p></details>}</div>
   </article>;
  })}{visibleItems.length===0&&<div className="empty-state"><ShieldAlert size={28}/><h2>沒有符合篩選條件的股票</h2><p>請調整市場、處置次數或搜尋文字。</p></div>}</div><div className="panel-note"><Info size={16}/><p>區間報酬以「處置開始日」當日收盤價為起點；若快照沒有該日行情則顯示 —。最新價格以本頁資料交易日收盤為準。</p></div></section>}
  <section className="panel repeat-rules"><div className="panel-heading"><div><h2>什麼情況可能再次進入處置？</h2><p>是否處置由交易所依公告與監視程序認定，不代表股票會自動進入下一次處置。</p></div></div><div className="repeat-rules-body"><p>處置結束後，若再次達到處置發布標準，交易所可能再次公告處置。主要累計門檻包括：</p><ul><li>連續 3 個營業日，依規定發布第一款注意交易資訊；或</li><li>連續 5 個營業日，或最近 10 個營業日有 6 日，或最近 30 個營業日有 12 日，依規定發布第一至第八款注意交易資訊。</li></ul><p>若最近 30 個營業日內第二次（含）以上依上述標準發布處置，交易所可能採較嚴格措施，例如更嚴格的預收款券範圍。實際措施與期間請以個別公告為準。</p><div className="official-links"><a href="https://twse-regulation.twse.com.tw/tw/law/DOC01.aspx?FLCODE=FL007225&FLNO=6" target="_blank" rel="noreferrer">證交所處置作業要點第六條 <ExternalLink size={14}/></a><a href="https://www.tpex.org.tw/zh-tw/announcement/mainboard/warning.html" target="_blank" rel="noreferrer">櫃買中心累計門檻說明 <ExternalLink size={14}/></a></div></div></section>
 </SiteShell>;
}

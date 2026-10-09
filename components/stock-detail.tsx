'use client';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {SiteShell} from './site-shell';
import type {Stock,MarketSnapshot,Simulation} from '../lib/market-types';
import {AttentionPrediction} from './attention-prediction';
import {fmt,shortDate,ruleNames} from '../lib/format';
import {dispositionTier,dispositionTierLabel} from '../lib/disposition-tier';
import {tradingViewUrl} from '../lib/tradingview-url';

export function StockDetail({stock:s,snapshot,initial}:{stock:Stock;snapshot:MarketSnapshot;initial:Simulation}){
 const result=initial;
 const g=result.gate,hasCompleteNoticeHistory=s.noticeHistoryComplete===true,counts=[['第一款連續注意',g.firstStreak,3],['第 1–8 款連續注意',g.anyStreak,5],['近 10 營業日累計注意',g.nineCount,6],['近 30 營業日累計注意',g.twentyNineCount,12]] as const;
 const chart=s.bars.slice(-30).map(b=>({date:shortDate(b.date),close:b.close}));
 const tier=dispositionTier(s,snapshot.calendar,snapshot.asOf);
 const turnover=s.volume!=null&&s.issuedShares!=null&&s.issuedShares>0?s.volume/s.issuedShares*100:null;
 const deltaLabel=(value:number|null|undefined)=>value==null?'日增減 —':`日增減 ${value>0?'+':''}${fmt(value,0)} 張`;
 return <SiteShell><a href="#/" className="back-link"><ArrowLeft size={16}/> 返回觀測清單</a><div className="page-heading detail-heading"><div><div className="eyebrow">{s.code} · {s.market==='TPEX'?'上櫃':'上市'}普通股 · 推估{dispositionTierLabel[tier]}</div><h1>{s.name}<span className="badge amber">{s.candidateReason?'官方處置候選':'注意條件觀測'}</span></h1><p>以 {snapshot.asOf} 盤後資料，試算 {result.targetDate} 收盤條件。</p><a className="tradingview-link" href={tradingViewUrl(s.market==='TPEX'?'TPEX':'TWSE',s.code)} target="_blank" rel="noopener noreferrer" aria-label={`在 TradingView 查看 ${s.code} ${s.name} K 線圖`}>K 線圖 <ArrowUpRight size={15}/><span>TradingView</span></a></div><div className="quote-block"><strong>{fmt(s.close)}</strong><span className={(s.changePercent||0)>=0?'up':'down'}>{(s.change||0)>0?'+':''}{fmt(s.change)}（{(s.changePercent||0)>0?'+':''}{fmt(s.changePercent)}%）</span></div></div>
 <details className="stock-metrics">
  <summary><strong>個股數據</strong><span>成交量、週轉率、股本、估值與融資融券 · 預設收合</span></summary>
  <div className="stock-metrics-grid">
   <div className="stock-metric"><small>成交量</small><strong>{s.volume==null?'—':`${fmt(s.volume/1000,0)} 張`}</strong><span>{s.volume==null?'當日資料未提供':`${fmt(s.volume,0)} 股 · ${s.quoteDate||snapshot.asOf}`}</span></div>
   <div className="stock-metric"><small>週轉率</small><strong>{turnover==null?'—':`${fmt(turnover,2)}%`}</strong><span>成交股數 ÷ 已發行普通股數</span></div>
   <div className="stock-metric"><small>股本</small><strong>{s.paidInCapital==null?'—':`${fmt(s.paidInCapital/100000000,2)} 億元`}</strong><span>{s.issuedShares==null?'已發行股數未提供':`已發行 ${fmt(s.issuedShares,0)} 股`}</span></div>
   <div className="stock-metric"><small>本益比</small><strong>{s.peNegative?'負 EPS（官方未計算）':s.pe==null?'—':fmt(s.pe,2)}</strong><span>估值日期 {s.valuationDate||'未提供'}</span></div>
   <div className="stock-metric"><small>股價淨值比</small><strong>{s.pb==null?'—':`${fmt(s.pb,2)} 倍`}</strong><span>估值日期 {s.valuationDate||'未提供'}</span></div>
   <div className="stock-metric"><small>融資餘額</small><strong>{s.marginFinanceLots==null?'—':`${fmt(s.marginFinanceLots,0)} 張`}</strong><span>{s.marginTradingDate?`${s.marginTradingDate} · ${deltaLabel(s.marginFinanceChangeLots)}`:'融資資料未提供'}</span></div>
   <div className="stock-metric"><small>融券餘額</small><strong>{s.marginShortLots==null?'—':`${fmt(s.marginShortLots,0)} 張`}</strong><span>{s.marginTradingDate?`${s.marginTradingDate} · ${deltaLabel(s.marginShortChangeLots)}`:'融券資料未提供'}</span></div>
  </div>
 </details>
 <section className="disposition-progress"><h2>處置條件進度</h2><div className="gate-grid">{counts.map(([label,n,total])=>{const pct=hasCompleteNoticeHistory?Math.min(n/total*100,100):0;const tone=!hasCompleteNoticeHistory?'unknown':pct>=100?'reached':pct>=60?'near':pct>=25?'active':'calm';return <div className={`gate-card progress-${tone}`} key={label}><p>{label}</p><strong>{hasCompleteNoticeHistory?`${Math.min(n,total)}/${total}`:'—'}<span> 日</span></strong><div className="thin-progress"><span style={{width:`${pct}%`}}/></div><small>{!hasCompleteNoticeHistory?'資料不足':pct>=100?'已達門檻':pct>=60?'接近門檻':pct>=25?'累計中':'進度低'}</small></div>})}</div></section>
 <div className="detail-grid"><div className="detail-main"><AttentionPrediction stock={s} snapshot={snapshot} result={result}/>
 <section className="panel chart-panel"><div className="panel-heading"><div><h2>近期收盤走勢</h2><p>最近 {chart.length} 個已取得交易日 · 原始收盤價</p></div><span className="badge gray">日資料</span></div><div className="price-chart" role="img" aria-label={`${s.name}近期收盤價走勢，最新收盤${s.close}元`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{top:12,right:24,left:4,bottom:8}}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315bcc" stopOpacity={.2}/><stop offset="100%" stopColor="#315bcc" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" minTickGap={42} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#7a8ba3'}}/><YAxis domain={['auto','auto']} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#7a8ba3'}}/><Tooltip formatter={v=>[fmt(Number(v)),'收盤價']} contentStyle={{borderRadius:8,border:'1px solid #e0e6ef',fontSize:14}}/><Area type="linear" dataKey="close" stroke="#315bcc" strokeWidth={2.5} fill="url(#priceFill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></section>
 <section className="panel"><div className="panel-heading"><div><h2>近期注意紀錄</h2><p>保留官方原因文字，日期與款次可逐筆核對</p></div><a className="text-link" href={s.market==='TPEX'?'https://www.tpex.org.tw/zh-tw/announce/market/attention.html':`https://www.twse.com.tw/announcement/notice?response=html&stockNo=${s.code}`} target="_blank" rel="noreferrer">官方查詢 <ArrowUpRight size={14}/></a></div><div className="notice-history">{s.notices.slice(0,20).map((n,i)=><article key={`${n.date}-${i}`}><div><time>{shortDate(n.date)}</time><span>{n.rules.map(r=>ruleNames[r]).join('、')}</span></div><p>{n.reason}</p></article>)}{!s.notices.length&&<p className="content-padding muted">本批次無注意紀錄。</p>}</div></section>
 {s.dispositions.length>0&&<section className="panel"><div className="panel-heading"><h2>已公告處置紀錄</h2></div><div className="notice-history">{s.dispositions.map((d,i)=><article key={i}><div><time>{d.announced}</time><span>{d.start} — {d.end}</span></div><p>{d.measure}。{d.content}</p></article>)}</div></section>}</div>
 </div></SiteShell>;
}

import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {MarketSnapshot,ScreenerSnapshot} from '../lib/market-types';
import {buildScreenRows} from '../lib/stock-screen';
import {fmt,shortDate} from '../lib/format';
import {industryName} from '../lib/industry';
import {tradingViewUrl} from '../lib/tradingview-url';
import {SiteShell} from './site-shell';

const CandlestickChart=lazy(()=>import('./candlestick-chart').then(module=>({default:module.CandlestickChart})));

const pct=(value:number|null|undefined)=>value===null||value===undefined?'資料不足':`${value>0?'+':''}${fmt(value,2)}%`;

export function ScreenerStockDetailRoute({code,fallback}:{code:string;fallback:MarketSnapshot}){
 const [snapshot,setSnapshot]=useState<ScreenerSnapshot|null>(null);
 useEffect(()=>{let active=true;void fetch('./data/screener.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('全市場行情尚未發布');return response.json() as Promise<ScreenerSnapshot>}).then(value=>{if(active&&Array.isArray(value.stocks))setSnapshot(value)}).catch(()=>{});return()=>{active=false}},[]);
 const stock=snapshot?.stocks.find(item=>item.code===code);
 if(stock&&snapshot)return <ScreenerStockDetail stock={stock} snapshot={snapshot}/>;
 const watched=fallback.stocks.find(item=>item.code===code);
 if(watched&&watched.close)return <SiteShell><section className="panel"><div className="empty-state"><h2>正在載入全市場個股資料…</h2><p>{watched.code} {watched.name}</p></div></section></SiteShell>;
 if(!snapshot)return <SiteShell><section className="panel"><div className="empty-state"><h2>正在載入個股行情…</h2><p>股票篩選資料讀取完成後會顯示個股頁。</p></div></section></SiteShell>;
 return <SiteShell><section className="panel"><div className="empty-state"><h2>找不到這檔股票</h2><p>代號 {code} 不在目前的全市場普通股行情資料中。</p><a href="#/screener" className="primary-link">返回股票篩選</a></div></section></SiteShell>;
}

function ScreenerStockDetail({stock,snapshot}:{stock:ScreenerSnapshot['stocks'][number];snapshot:ScreenerSnapshot}){
 const row=useMemo(()=>buildScreenRows({asOf:snapshot.asOf,generatedAt:snapshot.generatedAt,stocks:[stock]})[0], [stock,snapshot.asOf,snapshot.generatedAt]);
 const bars=stock.bars.filter(bar=>bar.close!==null).slice(-31).map(bar=>({date:shortDate(bar.date),close:bar.close as number}));
 const candles=stock.bars.filter(bar=>bar.open!==null&&bar.high!==null&&bar.low!==null&&bar.close!==null).slice(-31);
 const turnover=stock.volume!==null&&stock.issuedShares!=null&&stock.issuedShares>0?stock.volume/stock.issuedShares*100:null;
 const metrics=[['當日漲跌',pct(stock.changePercent)],['5 日漲跌',pct(row?.change5)],['10 日漲跌',pct(row?.change10)],['30 日漲跌',pct(row?.change30)],['成交量',stock.volume===null?'—':`${fmt(stock.volume/1000,0)} 張`],['週轉率',pct(turnover)],['產業族群',industryName(stock.industry)||'未分類'],['交易市場',stock.market==='TPEX'?'上櫃':'上市']];
 return <SiteShell active="screener"><a href="#/screener" className="back-link"><ArrowLeft size={16}/> 返回股票篩選</a><div className="page-heading detail-heading"><div><div className="eyebrow">{stock.code} · {stock.market==='TPEX'?'上櫃':'上市'}普通股</div><h1>{stock.name}<span className="badge gray">全市場行情</span></h1><p>資料交易日 {snapshot.asOf} · 收錄最近 {bars.length} 個有效收盤價。</p><a className="tradingview-link" href={tradingViewUrl(stock.market==='TPEX'?'TPEX':'TWSE',stock.code)} target="_blank" rel="noopener noreferrer" aria-label={`在 TradingView 查看 ${stock.code} ${stock.name} K 線圖`}>K 線圖 <ArrowUpRight size={15}/><span>TradingView</span></a></div><div className="quote-block"><strong>{fmt(stock.close)}</strong><span className={(stock.changePercent||0)>=0?'up':'down'}>{stock.change===null?'—':`${stock.change>0?'+':''}${fmt(stock.change)}（${pct(stock.changePercent)}）`}</span></div></div><div className="summary-grid screener-stock-metrics">{metrics.map(([label,value])=><div className="summary-card" key={label}><div className="summary-label">{label}</div><div className="status-value">{value}</div></div>)}</div><details className="panel stock-candlestick-panel"><summary><span><strong>K 棒圖</strong><small>{candles.length?`近 ${candles.length} 個交易日`:'等待完整 OHLC 行情'}</small></span><span className="badge gray">展開查看</span></summary><div className="stock-candlestick-content"><Suspense fallback={<div className="empty-state">正在載入圖表…</div>}><CandlestickChart stock={stock}/></Suspense></div></details><section className="panel chart-panel"><div className="panel-heading"><div><h2>近期收盤走勢</h2><p>最近 {bars.length} 個已取得交易日 · 原始收盤價</p></div><span className="badge gray">日資料</span></div>{bars.length>1?<div className="price-chart" role="img" aria-label={`${stock.name}近期收盤價走勢`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={bars} margin={{top:12,right:24,left:4,bottom:8}}><defs><linearGradient id="marketStockPriceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315bcc" stopOpacity={.2}/><stop offset="100%" stopColor="#315bcc" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" minTickGap={42} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#7a8ba3'}}/><YAxis domain={['auto','auto']} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#7a8ba3'}}/><Tooltip formatter={value=>[fmt(Number(value)),'收盤價']}/><Area type="linear" dataKey="close" stroke="#315bcc" strokeWidth={2.5} fill="url(#marketStockPriceFill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>:<div className="empty-state"><h3>歷史收盤資料不足</h3><p>目前只取得 {bars.length} 個有效收盤價。</p></div>}</section><p className="screener-disclaimer">此為一般上市／上櫃個股行情頁，歷史資料由官方公開行情整理。注意股累計及處置風險試算只適用於已納入注意或處置觀測批次的股票；正式資訊以交易所公告為準。</p></SiteShell>;
}

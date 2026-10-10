'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {SiteShell} from './site-shell';
import {fmt,shortDate} from '../lib/format';
import {tradingViewUrl} from '../lib/tradingview-url';

type EtfInfo={stock_id?:string;stock_name?:string;type?:string;date?:string;industry_category?:string};
type EtfPrice={date:string;stock_id:string;close:number;spread?:number};
type EtfRecord={code:string;name:string;market:'TWSE'|'TPEX';asOf:string;close:number;change:number|null;changePercent:number|null;bars:{date:string;close:number}[]};
const API='https://api.finmindtrade.com/api/v4/data';

async function fetchDataset<T,>(dataset:string,params:Record<string,string>={}):Promise<T[]>{
 const query=new URLSearchParams({dataset,...params});
 const response=await fetch(`${API}?${query}`,{cache:'no-store'});
 if(!response.ok)throw new Error(`資料服務回應 ${response.status}`);
 const payload=await response.json() as {status?:number;data?:unknown;msg?:string};
 if(payload.status!==200||!Array.isArray(payload.data))throw new Error(payload.msg||'ETF 資料暫時無法使用');
 return payload.data as T[];
}

export function EtfDetail({code,asOf}:{code:string;asOf:string}){
 const [record,setRecord]=useState<EtfRecord|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const [infoRows]=await Promise.all([fetchDataset<EtfInfo>('TaiwanStockInfo')]);
    const info=infoRows.filter(row=>row.stock_id===code&&row.date&&row.date<=asOf).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    if(!info||!/ETF/i.test(info.industry_category||''))throw new Error('此代號不是目前資料來源認定的 ETF，或尚未取得 ETF 基本資料。');
    const start=new Date(`${asOf}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-210);
    const prices=await fetchDataset<EtfPrice>('TaiwanStockPrice',{data_id:code,start_date:start.toISOString().slice(0,10),end_date:asOf});
    const bars=prices.filter(row=>row.stock_id===code&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(Number(row.close))&&Number(row.close)>0).map(row=>({date:row.date,close:Number(row.close)})).sort((a,b)=>a.date.localeCompare(b.date));
    const latest=bars.at(-1),previous=bars.at(-2);
    if(!latest)throw new Error(`${code} 尚無可用的歷史收盤價。`);
    if(active)setRecord({code,name:info.stock_name||code,market:info.type==='tpex'?'TPEX':'TWSE',asOf:latest.date,close:latest.close,change:previous?latest.close-previous.close:null,changePercent:previous?(latest.close/previous.close-1)*100:null,bars:bars.slice(-120)});
   }catch(reason){if(active)setError(reason instanceof Error?reason.message:'ETF 資料載入失敗');}
  })();
  return()=>{active=false};
 },[code,asOf]);
 return <SiteShell><a href="#/compare" className="back-link"><ArrowLeft size={16}/> 返回股票對比</a>{error?<section className="panel"><div className="empty-state"><h2>ETF 個股資料暫時無法載入</h2><p>{error}</p><p>此頁使用公開歷史行情資料，資料日期以來源提供的最近收盤日為準。</p></div></section>:!record?<section className="panel"><div className="empty-state"><h2>正在載入 ETF 行情…</h2><p>讀取基本資料與歷史收盤價。</p></div></section>:<><div className="page-heading detail-heading"><div><div className="eyebrow">{record.code} · {record.market==='TPEX'?'上櫃':'上市'} ETF</div><h1>{record.name}<span className="badge blue">ETF</span></h1><p>行情截至 {record.asOf}；ETF 不適用個股注意股／處置條件試算。</p><a className="tradingview-link" href={tradingViewUrl(record.market,record.code)} target="_blank" rel="noopener noreferrer">K 線圖 <ArrowUpRight size={15}/><span>TradingView</span></a></div><div className="quote-block"><strong>{fmt(record.close)}</strong>{record.change!==null&&record.changePercent!==null&&<span className={record.change>=0?'up':'down'}>{record.change>0?'+':''}{fmt(record.change)}（{record.changePercent>0?'+':''}{fmt(record.changePercent)}%）</span>}</div></div><section className="panel chart-panel"><div className="panel-heading"><div><h2>ETF 近期收盤走勢</h2><p>最近 {record.bars.length} 個已取得交易日 · 原始收盤價</p></div><span className="badge gray">日資料</span></div><div className="price-chart" role="img" aria-label={`${record.name}近期收盤價走勢`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={record.bars} margin={{top:12,right:24,left:4,bottom:8}}><defs><linearGradient id="etfPriceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315bcc" stopOpacity={.2}/><stop offset="100%" stopColor="#315bcc" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>shortDate(String(value))} minTickGap={42} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#9caab3'}}/><YAxis domain={['auto','auto']} tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#9caab3'}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[fmt(Number(value)),'收盤價']}/><Area type="linear" dataKey="close" stroke="#62adff" strokeWidth={2.5} fill="url(#etfPriceFill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></section></>}</SiteShell>;
}

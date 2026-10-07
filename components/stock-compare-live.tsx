import {useEffect,useMemo,useState} from 'react';
import {CartesianGrid,Legend,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {MarketSnapshot} from '../lib/market-types';
import {compareStocks,type ComparisonStock} from '../lib/stock-comparison';
import {SiteShell} from './site-shell';

type SymbolInfo={code:string;name:string;market:'TWSE'|'TPEX'};
type FinMindRow={date:string;stock_id:string;close:number};
const API='https://api.finmindtrade.com/api/v4/data';
const COMPARISON_SESSIONS=90;
const priceCache=new Map<string,ComparisonStock>();
const percent=(value:number|null)=>value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
const coefficient=(value:number|null)=>value===null?'—':value.toFixed(2);
const priceRatio=(value:number|null)=>value===null?'—':`${value.toFixed(4)} 倍`;
const volatility=(value:number|null)=>value===null?'—':`${(value*100).toFixed(2)}%`;
const codeFromInput=(value:string)=>value.match(/^\s*([1-9]\d{3})/)?.[1]||'';
const direction=(value:number|null)=>value===null?'':value>0?'up':value<0?'down':'';

async function finMind(dataset:string,params:Record<string,string>={}){
 const query=new URLSearchParams({dataset,...params});
 const response=await fetch(`${API}?${query}`,{cache:'no-store'});
 if(!response.ok)throw new Error(`資料服務回應 ${response.status}`);
 const payload=await response.json() as {status?:number;data?:unknown;msg?:string};
 if(payload.status!==200||!Array.isArray(payload.data))throw new Error(payload.msg||'資料服務暫時無法使用');
 return payload.data;
}

async function loadStock(stock:SymbolInfo,asOf:string):Promise<ComparisonStock>{
 const key=`${stock.code}-${asOf}`;
 const cached=priceCache.get(key);
 if(cached)return cached;
 const start=new Date(`${asOf}T00:00:00Z`);
 // A 150-calendar-day request normally contains at least 91 market sessions.
 start.setUTCDate(start.getUTCDate()-150);
 const rows=await finMind('TaiwanStockPrice',{data_id:stock.code,start_date:start.toISOString().slice(0,10),end_date:asOf}) as FinMindRow[];
 const bars=rows.filter(row=>row.stock_id===stock.code&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(Number(row.close))&&Number(row.close)>0).map(row=>({date:row.date,close:Number(row.close)}));
 if(!bars.length)throw new Error(`${stock.code} 沒有可用的歷史收盤價`);
 const result={...stock,bars};
 priceCache.set(key,result);
 return result;
}

export function StockCompare({snapshot}:{snapshot:MarketSnapshot}){
 const [symbols,setSymbols]=useState<SymbolInfo[]>([]);
 const [symbolsError,setSymbolsError]=useState('');
 const [firstInput,setFirstInput]=useState('2330 台積電');
 const [secondInput,setSecondInput]=useState('2317 鴻海');
 const [pair,setPair]=useState<[ComparisonStock,ComparisonStock]|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void finMind('TaiwanStockInfo').then(rows=>{
   const records=rows as {stock_id?:string;stock_name?:string;type?:string;date?:string}[];
   const latest=records.map(row=>row.date||'').filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);
   const unique=new Map<string,SymbolInfo>();
   for(const row of records){
    if(row.date!==latest||!row.stock_id||!row.stock_name||!(/^[1-9]\d{3}$/.test(row.stock_id)))continue;
    if(row.type!=='twse'&&row.type!=='tpex')continue;
    unique.set(row.stock_id,{code:row.stock_id,name:row.stock_name,market:row.type==='twse'?'TWSE':'TPEX'});
   }
   if(unique.size<1000)throw new Error('完整股票名單暫時無法取得');
   if(active)setSymbols([...unique.values()].sort((a,b)=>a.code.localeCompare(b.code,'zh-TW',{numeric:true})));
  }).catch(reason=>{if(active)setSymbolsError(reason instanceof Error?reason.message:'股票名單載入失敗')});
  return()=>{active=false};
 },[]);
 const available=useMemo(()=>symbols.length?symbols:snapshot.stocks.filter(stock=>stock.market==='TWSE'||stock.market==='TPEX').map(stock=>({code:stock.code,name:stock.name,market:stock.market as 'TWSE'|'TPEX'})),[symbols,snapshot]);
 const result=pair?compareStocks(...pair,COMPARISON_SESSIONS):null;
 const sufficient=result!==null&&result.sessionCount>=COMPARISON_SESSIONS;
 async function compare(){
  const first=available.find(stock=>stock.code===codeFromInput(firstInput));
  const second=available.find(stock=>stock.code===codeFromInput(secondInput));
  if(!first||!second){setError('請輸入股票名單中的兩個代號。');setPair(null);return}
  if(first.code===second.code){setError('請選擇兩檔不同股票。');setPair(null);return}
  setLoading(true);setError('');setPair(null);
  try{setPair(await Promise.all([loadStock(first,snapshot.asOf),loadStock(second,snapshot.asOf)]) as [ComparisonStock,ComparisonStock])}
  catch(reason){setError(reason instanceof Error?reason.message:'歷史價格查詢失敗')}
  finally{setLoading(false)}
 }
 return <SiteShell active="compare">
  <div className="page-heading"><div><div className="eyebrow">STOCK PAIR COMPARISON</div><h1>股票對比<span className="heading-dot">.</span></h1><p>比較兩檔上市或上櫃股票最近 150 個曆日內最多 90 個共同交易日的漲跌與同步程度。</p></div></div>
  <section className="panel compare-panel"><div className="panel-heading"><div><h2>選擇兩檔股票</h2><p>輸入代號或從建議清單選擇；查詢至 {snapshot.asOf} 的盤後資料。</p></div><span className="badge blue">{symbols.length?`${symbols.length} 檔可選`:'讀取股票名單中'}</span></div>
   <div className="compare-inputs"><label>股票 A<input list="comparison-stocks" value={firstInput} onChange={event=>setFirstInput(event.target.value)} placeholder="例：2330 台積電"/></label><label>股票 B<input list="comparison-stocks" value={secondInput} onChange={event=>setSecondInput(event.target.value)} placeholder="例：8299 群聯"/></label><datalist id="comparison-stocks">{available.map(stock=><option key={`${stock.market}-${stock.code}`} value={`${stock.code} ${stock.name}`}>{stock.market==='TWSE'?'上市':'上櫃'}</option>)}</datalist><button type="button" className="compare-button" onClick={()=>void compare()} disabled={loading||!symbols.length}>{loading?'查詢中…':'比較近期走勢'}</button></div>
   {symbolsError&&<p className="compare-note">股票名單暫時無法載入：{symbolsError}。請稍後重試。</p>}
   {error&&<p className="compare-note" role="alert">{error}</p>}
   {result&&pair&&<><div className="compare-summary"><div><small>A 股票 · {pair[0].code} {pair[0].name}</small><strong className={direction(result.firstChange)}>{sufficient?percent(result.firstChange):'—'}</strong></div><div><small>B 股票 · {pair[1].code} {pair[1].name}</small><strong className={direction(result.secondChange)}>{sufficient?percent(result.secondChange):'—'}</strong></div><div className="compare-sync-rate"><small>相關係數</small><strong>{sufficient&&result.synchronizationRate!==null?`${result.synchronizationRate}%`:'—'}</strong><span>{sufficient?`以 ${result.smoothedSessionCount} 個平滑報酬點加權計算`:`共同交易日僅 ${result.sessionCount} 日`}</span></div><div><small>A 相對 B 強弱差</small><strong className={direction(result.spread)}>{sufficient?percent(result.spread):'—'}</strong></div></div>
    {sufficient?<div className="compare-chart" role="img" aria-label={`${pair[0].name}與${pair[1].name}最近90個共同交易日的累積漲跌比較`}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.points} margin={{top:12,right:16,left:0,bottom:8}}><CartesianGrid stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>String(value).slice(5)} tick={{fill:'#aab7c0',fontSize:11}} minTickGap={20}/><YAxis tickFormatter={value=>`${value}%`} tick={{fill:'#aab7c0',fontSize:11}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[percent(Number(value)),'累積漲跌']}/><Legend/><Line type="linear" dataKey="first" name={`${pair[0].code} ${pair[0].name}`} stroke="#62adff" dot={false} strokeWidth={2} isAnimationActive={false}/><Line type="linear" dataKey="second" name={`${pair[1].code} ${pair[1].name}`} stroke="#ffba65" dot={false} strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<p className="compare-note">兩檔股票需有至少 91 筆共同日期的有效收盤價，才能比較完整 90 個交易日。</p>}
    <div className="compare-summary compare-ratios"><div><small>90 日平均股價比值（A ÷ B）</small><strong>{priceRatio(result.averagePriceRatio)}</strong><span>{result.averagePriceRatio===null?`共同有效收盤價僅 ${result.priceRatioSessionCount} 日，需滿 90 日`:'最近 90 個共同交易日，每日 A ÷ B 的算術平均'}</span></div><div><small>目前股價比值（A ÷ B）</small><strong>{priceRatio(result.currentPriceRatio)}</strong><span>{result.priceRatioDate?`${result.priceRatioDate} 兩檔共同最近收盤價，非即時報價`:'尚無共同日期的有效收盤價'}</span></div></div>
    {result.averagePriceRatio!==null&&<><div className="compare-ratio-chart-heading"><h3>股價比值趨勢</h3><small>每日 A ÷ B 與 90 日平均</small></div><div className="compare-chart compare-ratio-chart" role="img" aria-label={`A 除以 B 最近 90 個共同交易日的股價比值趨勢，水平線為平均 ${result.averagePriceRatio.toFixed(4)} 倍`}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.priceRatioPoints} margin={{top:16,right:16,left:0,bottom:8}}><CartesianGrid stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>String(value).slice(5)} tick={{fill:'#aab7c0',fontSize:11}} minTickGap={20}/><YAxis domain={['auto','auto']} tickFormatter={value=>Number(value).toFixed(2)} tick={{fill:'#aab7c0',fontSize:11}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[priceRatio(Number(value)),'當日 A ÷ B']}/><ReferenceLine y={result.averagePriceRatio} stroke="#ffba65" strokeDasharray="6 4" strokeWidth={2} label={{value:'90 日平均',position:'insideTopRight',fill:'#ffba65',fontSize:11}}/><Line type="linear" dataKey="ratio" name="當日股價比值" stroke="#62adff" dot={false} activeDot={{r:4}} strokeWidth={2.5} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>}
    <div className="compare-detail-metrics"><div><small>3 日平滑 Pearson（幅度同步）</small><strong>{sufficient?coefficient(result.smoothedPearson):'—'}</strong><span>平滑報酬的線性相關</span></div><div><small>3 日平滑 Spearman（排序同步）</small><strong>{sufficient?coefficient(result.smoothedSpearman):'—'}</strong><span>比較平滑報酬的相對排序</span></div><div><small>3 日平滑報酬差波動度</small><strong>{sufficient?volatility(result.smoothedDifferenceVolatility):'—'}</strong><span>每日平滑報酬 A − B 標準差</span></div><div><small>同向交易日比例</small><strong>{sufficient&&result.sameDirection!==null?`${result.sameDirection.toFixed(0)}%`:'—'}</strong><span>未平滑每日報酬</span></div></div></>}
   <div className="panel-note"><p>同步率以最近 90 個共同日報酬先做 3 日簡單移動平均（最多產生 88 個重疊平滑點），Pearson、Spearman、報酬差波動度相似度分別占 40%、30%、30%。Pearson 與 Spearman 先由 −1～+1 線性轉成 0～100 分；波動度相似度為 max(0, 1 − 平滑報酬差標準差 ÷ 兩檔平滑報酬標準差平均)，再按權重合成。這是本站的比較分數，權重及正規化方式屬分析設計，不是交易所標準或經回測驗證的獲利機率；平滑窗口重疊也可能讓同步程度看起來較高。資料來自 <a href="https://finmindtrade.com/" target="_blank" rel="noreferrer">FinMind 免費公開 API</a> 未還原日收盤價，除權息可能影響結果；歷史同步不代表可獲利的套利訊號。</p></div>
  </section>
 </SiteShell>;
}

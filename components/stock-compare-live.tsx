import {useEffect,useMemo,useState} from 'react';
import {CartesianGrid,Legend,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {MarketSnapshot} from '../lib/market-types';
import {compareStocks,type ComparisonStock} from '../lib/stock-comparison';
import {comparisonCodeFromInput,recentComparisonSymbols,type ComparisonSymbol} from '../lib/comparison-symbols';
import {PositionRatioCalculator} from './position-ratio-calculator';
import {PersonalGroupPicker} from './personal-group-picker';
import {SiteShell} from './site-shell';

type SymbolInfo=ComparisonSymbol;
type FinMindRow={date:string;stock_id:string;close:number};
const API='https://api.finmindtrade.com/api/v4/data';
const COMPARISON_SESSIONS=120;
const priceCache=new Map<string,ComparisonStock>();
const percent=(value:number|null)=>value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
const coefficient=(value:number|null)=>value===null?'—':value.toFixed(2);
const priceRatio=(value:number|null)=>value===null?'—':`${value.toFixed(4)} 倍`;
const volatility=(value:number|null)=>value===null?'—':`${(value*100).toFixed(2)}%`;
const codeFromInput=comparisonCodeFromInput;
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
 // Leave room for weekends, holidays and suspensions when aligning 120 sessions.
 start.setUTCDate(start.getUTCDate()-210);
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
 const [groupPickerOpen,setGroupPickerOpen]=useState(false);
 useEffect(()=>{
  let active=true;
  void finMind('TaiwanStockInfo').then(rows=>{
   const available=recentComparisonSymbols(rows as {stock_id?:string;stock_name?:string;type?:string;date?:string;industry_category?:string}[]);
   if(available.length<1000)throw new Error('完整股票名單暫時無法取得');
   if(active)setSymbols(available);
  }).catch(reason=>{if(active)setSymbolsError(reason instanceof Error?reason.message:'股票名單載入失敗')});
  return()=>{active=false};
 },[]);
 const available=useMemo(()=>symbols.length?symbols:snapshot.stocks.filter(stock=>stock.market==='TWSE'||stock.market==='TPEX').map(stock=>({code:stock.code,name:stock.name,market:stock.market as 'TWSE'|'TPEX',isEtf:false})),[symbols,snapshot]);
 const individualPageHref=(value:string)=>{
  const code=codeFromInput(value);
  return code&&available.some(stock=>stock.code===code)?`#/stocks/${code}`:null;
 };
 const watchGroups=useMemo(()=>{
  const cutoff=new Date(`${snapshot.asOf}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate()-45);
  const cutoffDate=cutoff.toISOString().slice(0,10);
  const attentionCodes=snapshot.stocks.filter(stock=>stock.candidateReason||stock.notices.some(notice=>notice.date>=cutoffDate)).map(stock=>stock.code);
  const dispositionCodes=snapshot.stocks.filter(stock=>stock.dispositions.some(disposition=>disposition.start&&disposition.end&&disposition.start<=snapshot.asOf&&disposition.end>=snapshot.asOf)).map(stock=>stock.code);
  return [
   {id:'attention',name:'注意股',codes:[...new Set(attentionCodes)]},
   {id:'disposition',name:'處置股',codes:[...new Set(dispositionCodes)]},
  ];
 },[snapshot]);
 const result=pair?compareStocks(...pair,COMPARISON_SESSIONS):null;
 const sufficient=result!==null&&result.sessionCount>=COMPARISON_SESSIONS;
 async function compare(){
  const first=available.find(stock=>stock.code===codeFromInput(firstInput));
  const second=available.find(stock=>stock.code===codeFromInput(secondInput));
  if(!first||!second){setError('請輸入股票或 ETF 名單中的兩個代號。');setPair(null);return}
  setLoading(true);setError('');setPair(null);
  try{
   const firstLoaded=await loadStock(first,snapshot.asOf);
   const secondLoaded=first.code===second.code?firstLoaded:await loadStock(second,snapshot.asOf);
   setPair([firstLoaded,secondLoaded]);
  }
  catch(reason){setError(reason instanceof Error?reason.message:'歷史價格查詢失敗')}
  finally{setLoading(false)}
 }
 function swapStocks(){
  setFirstInput(secondInput);
  setSecondInput(firstInput);
  setError('');
  setPair(current=>current&&codeFromInput(firstInput)===current[0].code&&codeFromInput(secondInput)===current[1].code?[current[1],current[0]]:null);
 }
 return <SiteShell active="compare">
  <div className="page-heading"><div><div className="eyebrow">STOCK PAIR COMPARISON</div><h1>股票對比<span className="heading-dot">.</span></h1><p>比較兩檔上市／上櫃股票或 ETF 最近 120 個共同交易日的漲跌與同步程度。</p></div></div>
  <section className="panel compare-panel"><div className="panel-heading"><div><h2>選擇兩檔股票</h2><p>輸入股票或 ETF 代號，或從建議清單選擇；查詢至 {snapshot.asOf} 的盤後資料。</p></div><span className="badge blue">{symbols.length?`${symbols.length} 檔可選`:'讀取股票名單中'}</span></div>
   <div className="compare-inputs"><label>股票 A<input list="comparison-stocks" value={firstInput} onChange={event=>setFirstInput(event.target.value)} placeholder="例：2330 台積電"/>{individualPageHref(firstInput)&&<a className="compare-stock-link" href={individualPageHref(firstInput)!}>查看 A 個股頁面 ↗</a>}</label><button type="button" className="compare-swap" onClick={swapStocks} disabled={loading} aria-label="交換股票 A 與 B" title="交換股票 A 與 B">⇄</button><label>股票 B<input list="comparison-stocks" value={secondInput} onChange={event=>setSecondInput(event.target.value)} placeholder="例：8299 群聯"/>{individualPageHref(secondInput)&&<a className="compare-stock-link" href={individualPageHref(secondInput)!}>查看 B 個股頁面 ↗</a>}</label><button type="button" className="compare-group-button" onClick={()=>setGroupPickerOpen(true)}>細產業選股</button><datalist id="comparison-stocks">{available.map(stock=><option key={`${stock.market}-${stock.code}`} value={`${stock.code} ${stock.name}`}>{stock.market==='TWSE'?'上市':'上櫃'}{stock.isEtf?' ETF':' 股票'}</option>)}</datalist><button type="button" className="compare-button" onClick={()=>void compare()} disabled={loading||!symbols.length}>{loading?'查詢中…':'比較近期走勢'}</button></div>
   {groupPickerOpen&&<PersonalGroupPicker stocks={available} watchGroups={watchGroups} onClose={()=>setGroupPickerOpen(false)} onApply={(first,second)=>{setFirstInput(`${first.code} ${first.name}`);setSecondInput(`${second.code} ${second.name}`);setPair(null);setError('');setGroupPickerOpen(false)}}/>}
   {symbolsError&&<p className="compare-note">股票名單暫時無法載入：{symbolsError}。請稍後重試。</p>}
   {error&&<p className="compare-note" role="alert">{error}</p>}
   {result&&pair&&<><div className="compare-summary"><div><small>A 股票 · {pair[0].code} {pair[0].name}</small><strong className={direction(result.firstChange)}>{sufficient?percent(result.firstChange):'—'}</strong></div><div><small>B 股票 · {pair[1].code} {pair[1].name}</small><strong className={direction(result.secondChange)}>{sufficient?percent(result.secondChange):'—'}</strong></div><div className="compare-sync-rate"><small>相關係數</small><strong>{sufficient&&result.synchronizationRate!==null?`${result.synchronizationRate}%`:'—'}</strong><span>{sufficient?`以 ${result.smoothedSessionCount} 個平滑報酬點加權計算`:`共同交易日僅 ${result.sessionCount} 日`}</span></div><div><small>A 相對 B 強弱差</small><strong className={direction(result.spread)}>{sufficient?percent(result.spread):'—'}</strong></div></div>
    {sufficient?<div className="compare-chart" role="img" aria-label={`${pair[0].name}與${pair[1].name}最近120個共同交易日的累積漲跌比較`}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.points} margin={{top:12,right:16,left:0,bottom:8}}><CartesianGrid stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>String(value).slice(5)} tick={{fill:'#aab7c0',fontSize:11}} minTickGap={20}/><YAxis tickFormatter={value=>`${value}%`} tick={{fill:'#aab7c0',fontSize:11}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[percent(Number(value)),'累積漲跌']}/><Legend/><Line type="linear" dataKey="first" name={`${pair[0].code} ${pair[0].name}`} stroke="#62adff" dot={false} strokeWidth={2} isAnimationActive={false}/><Line type="linear" dataKey="second" name={`${pair[1].code} ${pair[1].name}`} stroke="#ffba65" dot={false} strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<p className="compare-note">兩檔股票需有至少 121 筆共同日期的有效收盤價，才能比較完整 120 個交易日。</p>}
    <div className="compare-summary compare-ratios"><div><small>120 日平均股價比值（A ÷ B）</small><strong>{priceRatio(result.averagePriceRatio)}</strong><span>{result.averagePriceRatio===null?`共同有效收盤價僅 ${result.priceRatioSessionCount} 日，需滿 120 日`:'最近 120 個共同交易日，每日 A ÷ B 的算術平均'}</span></div><div><small>目前股價比值（A ÷ B）</small><strong>{priceRatio(result.currentPriceRatio)}</strong><span>{result.priceRatioDate?`${result.priceRatioDate} 兩檔共同最近收盤價，非即時報價`:'尚無共同日期的有效收盤價'}</span></div></div>
    {result.averagePriceRatio!==null&&<><div className="compare-ratio-chart-heading"><h3>股價比值趨勢</h3><small>每日 A ÷ B 與 120 日平均</small></div><div className="compare-chart compare-ratio-chart" role="img" aria-label={`A 除以 B 最近 120 個共同交易日的股價比值趨勢，水平線為平均 ${result.averagePriceRatio.toFixed(4)} 倍`}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.priceRatioPoints} margin={{top:16,right:16,left:0,bottom:8}}><CartesianGrid stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>String(value).slice(5)} tick={{fill:'#aab7c0',fontSize:11}} minTickGap={20}/><YAxis domain={['auto','auto']} tickFormatter={value=>Number(value).toFixed(2)} tick={{fill:'#aab7c0',fontSize:11}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[priceRatio(Number(value)),'當日 A ÷ B']}/><ReferenceLine y={result.averagePriceRatio} stroke="#ffba65" strokeDasharray="6 4" strokeWidth={2} label={{value:'120 日平均',position:'insideTopRight',fill:'#ffba65',fontSize:11}}/><Line type="linear" dataKey="ratio" name="當日股價比值" stroke="#62adff" dot={false} activeDot={{r:4}} strokeWidth={2.5} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>}
    <PositionRatioCalculator pair={pair} date={result.priceRatioDate} currentRatio={result.currentPriceRatio} averageRatio={result.averagePriceRatio}/>
    <div className="compare-detail-metrics"><div><small>3 日平滑 Pearson（幅度同步）</small><strong>{sufficient?coefficient(result.smoothedPearson):'—'}</strong><span>平滑報酬的線性相關</span></div><div><small>3 日平滑 Spearman（排序同步）</small><strong>{sufficient?coefficient(result.smoothedSpearman):'—'}</strong><span>比較平滑報酬的相對排序</span></div><div><small>3 日平滑報酬差波動度</small><strong>{sufficient?volatility(result.smoothedDifferenceVolatility):'—'}</strong><span>每日平滑報酬 A − B 標準差</span></div><div><small>同向交易日比例</small><strong>{sufficient&&result.sameDirection!==null?`${result.sameDirection.toFixed(0)}%`:'—'}</strong><span>未平滑每日報酬</span></div></div></>}
   <div className="panel-note"><p>同步率以最近 120 個共同交易日計算：同向交易日比例占 45%，3 日平滑 Pearson 占 25%、Spearman 占 20%、報酬差波動度相似度占 10%。同向比例採平方曲線 min(1, (比例 ÷ 85%)²)，80% 時約得此項的 89 分，85% 起此項滿分；整體仍由四項加權並以 100% 封頂。Pearson 與 Spearman 由 −1～+1 轉為 0～100 分，波動度相似度為 max(0, 1 − 平滑報酬差標準差 ÷ 兩檔平滑報酬標準差平均)。這是本站的比較分數，並非統計學的單一相關係數或經回測驗證的獲利機率。資料來自 <a href="https://finmindtrade.com/" target="_blank" rel="noreferrer">FinMind 免費公開 API</a> 未還原日收盤價；除權息與停牌可能影響結果，歷史同步不代表可獲利的套利訊號。</p></div>
  </section>
 </SiteShell>;
}

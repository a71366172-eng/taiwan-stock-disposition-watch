import {useEffect,useMemo,useState} from 'react';
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {MarketSnapshot} from '../lib/market-types';
import {compareStocks,type ComparisonSnapshot,type ComparisonStock} from '../lib/stock-comparison';
import {SiteShell} from './site-shell';

const percent=(value:number|null)=>value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
const codeFromInput=(value:string)=>value.match(/^\s*([1-9]\d{3})/)?.[1]||'';
const direction=(value:number|null)=>value===null?'':value>0?'up':value<0?'down':'';

export function StockCompare({snapshot}:{snapshot:MarketSnapshot}){
 const [comparison,setComparison]=useState<ComparisonSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [firstInput,setFirstInput]=useState('');
 const [secondInput,setSecondInput]=useState('');
 useEffect(()=>{
  let active=true;
  void fetch('./data/comparison.json',{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw new Error('比較資料暫時無法載入');
   const data=await response.json() as ComparisonSnapshot;
   if(!Array.isArray(data.stocks))throw new Error('比較資料格式不正確');
   if(active)setComparison(data);
  }).catch(()=>{}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const available=useMemo(()=>{
  const byCode=new Map<string,ComparisonStock>();
  for(const stock of comparison?.stocks||[])byCode.set(stock.code,stock);
  for(const stock of snapshot.stocks){
   if(stock.market!=='TWSE'&&stock.market!=='TPEX')continue;
   const previous=byCode.get(stock.code);
   const bars=new Map(previous?.bars.map(bar=>[bar.date,bar.close])||[]);
   for(const bar of stock.bars)if(bar.close!==null)bars.set(bar.date,bar.close);
   byCode.set(stock.code,{code:stock.code,name:stock.name,market:stock.market,bars:[...bars].map(([date,close])=>({date,close})).sort((a,b)=>a.date.localeCompare(b.date))});
  }
  return [...byCode.values()].sort((a,b)=>a.code.localeCompare(b.code,'zh-TW',{numeric:true}));
 },[comparison,snapshot]);
 const firstCode=firstInput.trim()?codeFromInput(firstInput):'2330';
 const secondCode=secondInput.trim()?codeFromInput(secondInput):'2317';
 const first=available.find(stock=>stock.code===firstCode);
 const second=available.find(stock=>stock.code===secondCode);
 const result=first&&second&&first.code!==second.code?compareStocks(first,second):null;
 const sufficient=result!==null&&result.sessionCount>=30;
 const correlation=result?.correlation??null;
 const strength=correlation===null?'資料不足':correlation>=0.7?'高度同向':correlation>=0.4?'中度同向':correlation<=-0.7?'高度反向':correlation<=-0.4?'中度反向':'同步程度偏低';
 return <SiteShell active="compare">
  <div className="page-heading"><div><div className="eyebrow">STOCK PAIR COMPARISON</div><h1>股票對比<span className="heading-dot">.</span></h1><p>比較兩檔上市或上櫃股票最近 30 個共同交易日的漲跌與同步程度。</p></div></div>
  <section className="panel compare-panel"><div className="panel-heading"><div><h2>選擇兩檔股票</h2><p>輸入代號或從建議清單選擇；資料截至 {comparison?.asOf||snapshot.asOf}。</p></div><span className="badge blue">{available.length} 檔可選</span></div>
   <div className="compare-inputs"><label>股票 A<input list="comparison-stocks" value={firstInput} onChange={event=>setFirstInput(event.target.value)} placeholder="例：2330 台積電"/></label><label>股票 B<input list="comparison-stocks" value={secondInput} onChange={event=>setSecondInput(event.target.value)} placeholder="例：2317 鴻海"/></label><datalist id="comparison-stocks">{available.map(stock=><option key={`${stock.market}-${stock.code}`} value={`${stock.code} ${stock.name}`}>{stock.market==='TWSE'?'上市':'上櫃'}</option>)}</datalist></div>
   {loading&&<p className="compare-note">正在讀取全市場比較資料…</p>}
   {!loading&&(!first||!second)&&<p className="compare-note">{!comparison?'全市場比較資料尚未發布，目前僅能選擇觀測清單中的股票。':'請輸入清單中可用的兩個股票代號。'}</p>}
   {first&&second&&first.code===second.code&&<p className="compare-note">請選擇兩檔不同股票。</p>}
   {result&&<><div className="compare-summary"><div><small>股票 A · {first?.code} {first?.name}</small><strong className={direction(result.firstChange)}>{percent(result.firstChange)}</strong></div><div><small>股票 B · {second?.code} {second?.name}</small><strong className={direction(result.secondChange)}>{percent(result.secondChange)}</strong></div><div><small>每日報酬相關係數</small><strong>{sufficient&&correlation!==null?correlation.toFixed(2):'—'}</strong><span>{sufficient?strength:`共同交易日僅 ${result.sessionCount} 日`}</span></div><div><small>同向交易日比例</small><strong>{sufficient&&result.sameDirection!==null?`${result.sameDirection.toFixed(0)}%`:'—'}</strong></div><div><small>A 相對 B 強弱差</small><strong className={direction(result.spread)}>{sufficient?`${percent(result.spread)} 點`:'—'}</strong></div></div>
    {sufficient?<div className="compare-chart" role="img" aria-label={`${first?.name}與${second?.name}最近30個共同交易日的累積漲跌比較`}><ResponsiveContainer width="100%" height="100%"><LineChart data={result.points} margin={{top:12,right:16,left:0,bottom:8}}><CartesianGrid stroke="#465159" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={value=>String(value).slice(5)} tick={{fill:'#aab7c0',fontSize:11}} minTickGap={20}/><YAxis tickFormatter={value=>`${value}%`} tick={{fill:'#aab7c0',fontSize:11}}/><Tooltip labelFormatter={value=>String(value)} formatter={value=>[percent(Number(value)), '累積漲跌']}/><Legend/><Line type="linear" dataKey="first" name={`${first?.code} ${first?.name}`} stroke="#62adff" dot={false} strokeWidth={2} isAnimationActive={false}/><Line type="linear" dataKey="second" name={`${second?.code} ${second?.name}`} stroke="#ffba65" dot={false} strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<p className="compare-note">兩檔股票需有至少 31 筆共同日期的有效收盤價，才能比較完整 30 個交易日。</p>}</>}
   <div className="panel-note"><p>相關係數以共同日期的每日收盤報酬計算，範圍 −1 至 +1；接近 +1 表示同向波動較一致，接近 −1 表示反向。圖表將共同起點設為 0%，強弱差為 A 的累積漲跌幅減 B 的累積漲跌幅。資料採未還原收盤價，除權息可能影響結果；相似度只描述歷史同步，不代表可獲利的套利訊號。</p></div>
  </section>
 </SiteShell>;
}

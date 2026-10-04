import {useEffect,useMemo,useState} from 'react';
import {ArrowDownRight,ArrowUpRight,ChartNoAxesCombined,Search} from 'lucide-react';
import type {ScreenerSnapshot} from '../lib/market-types';
import {findSimilarStocks,type ComparisonStock} from '../lib/stock-comparison';
import {SiteShell} from './site-shell';

function symbolCode(value:string){return value.match(/^\s*([1-9]\d{3})(?:\s|$)/)?.[1]||''}
function pct(value:number|null){return value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`}
function similarity(value:number|null){return value===null?'—':`${value}%`}

type SymbolInfo={code:string;name:string;market:'TWSE'|'TPEX'};
type FinMindRow={date:string;stock_id:string;close:number};
const API='https://api.finmindtrade.com/api/v4/data';
const priceCache=new Map<string,ComparisonStock>();

async function loadStock(stock:SymbolInfo,asOf:string):Promise<ComparisonStock>{
 const key=`${stock.code}-${asOf}`;
 const cached=priceCache.get(key);
 if(cached)return cached;
 const start=new Date(`${asOf}T00:00:00Z`);
 start.setUTCDate(start.getUTCDate()-95);
 const query=new URLSearchParams({dataset:'TaiwanStockPrice',data_id:stock.code,start_date:start.toISOString().slice(0,10),end_date:asOf});
 const response=await fetch(`${API}?${query}`,{cache:'no-store'});
 if(!response.ok)throw new Error(`歷史價格服務回應 ${response.status}`);
 const payload=await response.json() as {status?:number;data?:unknown;msg?:string};
 if(payload.status!==200||!Array.isArray(payload.data))throw new Error(payload.msg||'歷史價格服務暫時無法使用');
 const bars=(payload.data as FinMindRow[]).filter(row=>row.stock_id===stock.code&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isFinite(Number(row.close))&&Number(row.close)>0).map(row=>({date:row.date,close:Number(row.close)}));
 const result={...stock,bars};
 priceCache.set(key,result);
 return result;
}

export function SimilarStocks(){
 const [snapshot,setSnapshot]=useState<ScreenerSnapshot|null>(null);
 const [error,setError]=useState('');
 const [input,setInput]=useState('');
 const [liveSymbols,setLiveSymbols]=useState<SymbolInfo[]>([]);
 const [liveLoading,setLiveLoading]=useState(false);
 const [liveError,setLiveError]=useState('');
 useEffect(()=>{let active=true;void fetch('./data/screener.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('全市場歷史快照尚未發布');return response.json() as Promise<ScreenerSnapshot>}).then(value=>{if(active&&Array.isArray(value.stocks))setSnapshot(value);else if(active)setError('篩選資料格式不完整')}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'無法載入股票歷史資料')});return()=>{active=false}},[]);
 const stocks=useMemo<ComparisonStock[]>(()=>snapshot?.stocks.filter(stock=>(stock.market==='TWSE'||stock.market==='TPEX')&&Array.isArray(stock.bars)).map(stock=>({code:stock.code,name:stock.name,market:stock.market as 'TWSE'|'TPEX',bars:stock.bars.filter(bar=>Number.isFinite(bar.close)&&Number(bar.close)>0).map(bar=>({date:bar.date,close:Number(bar.close)}))}))||[],[snapshot]);
 const symbols=useMemo(()=>liveSymbols.length?liveSymbols:stocks.map(({code,name,market})=>({code,name,market})),[liveSymbols,stocks]);
 const chosenCode=symbolCode(input);
 const chosen=symbols.find(stock=>stock.code===chosenCode);
 const selected=stocks.find(stock=>stock.code===chosenCode&&stock.bars.length>=31);
 const candidates=useMemo(()=>stocks.filter(stock=>stock.bars.length>=31),[stocks]);
 const ranked=useMemo(()=>selected?findSimilarStocks(selected,candidates,5):[],[selected,candidates]);
 const completeCount=liveSymbols.length||candidates.length;
 useEffect(()=>{let active=true;void (async()=>{
  try{
   const response=await fetch(`${API}?${new URLSearchParams({dataset:'TaiwanStockInfo'})}`,{cache:'no-store'});
   if(!response.ok)throw new Error(`股票名單服務回應 ${response.status}`);
   const payload=await response.json() as {status?:number;data?:unknown;msg?:string};
   if(payload.status!==200||!Array.isArray(payload.data))throw new Error(payload.msg||'股票名單暫時無法取得');
   const records=payload.data as {stock_id?:string;stock_name?:string;type?:string;date?:string}[];
   const latest=records.map(row=>row.date||'').filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);
   const unique=new Map<string,SymbolInfo>();
   for(const row of records){
    if(row.date!==latest||!row.stock_id||!row.stock_name||!(/^[1-9]\d{3}$/.test(row.stock_id)))continue;
    if(row.type!=='twse'&&row.type!=='tpex')continue;
    unique.set(row.stock_id,{code:row.stock_id,name:row.stock_name,market:row.type==='twse'?'TWSE':'TPEX'});
   }
   if(unique.size<1000)throw new Error('完整股票名單暫時無法取得');
   if(active)setLiveSymbols([...unique.values()].sort((a,b)=>a.code.localeCompare(b.code,'zh-TW',{numeric:true})));
  }catch(reason){if(active)setLiveError(reason instanceof Error?reason.message:'股票名單載入失敗')}
 })();return()=>{active=false}},[]);
 useEffect(()=>{let active=true;
  if(!chosen||selected||!snapshot)return;
  void Promise.resolve().then(()=>{if(active){setLiveLoading(true);setLiveError('')}return loadStock(chosen,snapshot.asOf)}).then(value=>{if(active&&value.bars.length>=31){setSnapshot(current=>current?{...current,stocks:[...current.stocks.filter(stock=>stock.code!==value.code),{code:value.code,name:value.name,market:value.market,industry:'',close:null,change:null,changePercent:null,volume:null,bars:value.bars}]}:current)}}).catch(reason=>{if(active)setLiveError(reason instanceof Error?reason.message:'無法載入 A 股票歷史資料')}).finally(()=>{if(active)setLiveLoading(false)});
  return()=>{active=false};
 },[chosen,selected,snapshot]);
 return <SiteShell active="compare">
  <div className="page-heading"><div><div className="eyebrow">FIND SIMILAR STOCKS</div><h1>相似股票<span className="heading-dot">.</span></h1><p>選擇 A 股票，自動從上市與上櫃股票找出最近 30 個交易日走勢最相似的前五名。</p></div><ChartNoAxesCombined size={30}/></div>
  <nav className="compare-subnav" aria-label="股票對比子頁面"><a href="#/compare">雙股對比</a><a className="active" href="#/compare/similar">相似股票</a></nav>
  <section className="panel similar-panel">
   <div className="panel-heading"><div><h2>選擇 A 股票</h2><p>以 {snapshot?.asOf||'最新交易日'} 為資料基準；切換股票後會自動重算，不需再按查詢。</p></div><span className="badge blue">{completeCount?`${completeCount.toLocaleString()} 檔股票名單`: '讀取股票名單中'}</span></div>
   <div className="similar-picker"><label htmlFor="similar-stock-input">A 股票代號或名稱</label><div className="similar-search"><Search size={18}/><input id="similar-stock-input" list="similar-stock-options" value={input} onChange={event=>setInput(event.target.value)} placeholder="輸入代號或名稱，例如 2330 台積電" autoComplete="off"/><datalist id="similar-stock-options">{symbols.map(stock=><option key={`${stock.market}-${stock.code}`} value={`${stock.code} ${stock.name}`}/>)}</datalist></div>
    <p className="compare-note">使用與雙股對比相同的全市場股票名單；A 股歷史不足時會從 FinMind 補抓。候選股票只採用具備完整 30 日資料者，官方快照補資料時優先處理有權證標的。</p>
   </div>
   {error&&<p className="compare-note" role="alert">{error}</p>}
   {selected&&<div className="similar-selection"><span>A 股票</span><strong>{selected.code} {selected.name}</strong><small>{selected.market==='TWSE'?'上市':'上櫃'} · 有效收盤 {selected.bars.length} 筆</small></div>}
   {input&&!selected&&<div className="similar-empty"><Search size={22}/><p>{liveLoading?'正在載入該股票的完整歷史收盤資料…':chosen?(liveError||'這檔股票的歷史收盤資料不足 31 筆。'):'請輸入股票名單中的代號或名稱。'}</p></div>}
   {liveError&&selected&&<p className="compare-note" role="status">{liveError}</p>}
   {selected&&liveLoading&&<p className="compare-note" role="status">正在補抓全市場價格歷史並更新前五名…</p>}
   {selected&&ranked.length>0&&<div className="similar-results" aria-live="polite"><div className="similar-results-heading"><div><h2>相似度前五名</h2><p>依 30 日同步分數由高至低排序，DTW 距離用於同分排序。</p></div><span>{ranked.length} 檔</span></div>{ranked.map((result,index)=><article className="similar-result" key={result.stock.code}><div className="similar-rank">{String(index+1).padStart(2,'0')}</div><div className="similar-stock-name"><a href={`#/stocks/${result.stock.code}`}><strong>{result.stock.code}</strong><span>{result.stock.name}</span><ArrowUpRight size={14}/></a><small>{result.stock.market==='TWSE'?'上市':'上櫃'} · {result.sessionCount} 個共同交易日</small></div><div className="similar-score"><small>相似度</small><strong>{similarity(result.synchronizationRate)}</strong></div><div className="similar-metric"><small>A 30 日漲幅</small><strong>{pct(result.firstChange)}</strong></div><div className="similar-metric"><small>相似股 30 日漲幅</small><strong>{pct(result.secondChange)}</strong></div><div className="similar-metric"><small>A 相對強弱差</small><strong>{pct(result.spread)}</strong></div><div className="similar-metric"><small>DTW 距離</small><strong>{result.dtwDistance===null?'—':result.dtwDistance.toFixed(4)}</strong></div><div className="similar-link"><a href={`#/stocks/${result.stock.code}`} aria-label={`查看 ${result.stock.code} ${result.stock.name} 個股頁`}>{result.spread!==null&&result.spread>=0?<ArrowUpRight size={18}/>:<ArrowDownRight size={18}/>}</a></div></article>)}</div>}
   {selected&&!ranked.length&&<div className="similar-empty"><Search size={22}/><p>目前找不到有足夠共同交易日且可計算同步分數的相似股票。</p></div>}
   {!selected&&!input&&<div className="similar-empty"><ChartNoAxesCombined size={25}/><p>選擇 A 股票後會立即列出五檔最相似的股票。</p></div>}
   <div className="panel-note similar-method"><p>相似度使用股票對比頁相同的 3 日平滑 Pearson、Spearman、2 日累積對數報酬差與同向交易比例，總權重固定為 100%，轉換成 0～100 的本站同步分數；它不是傳統 Pearson 相關係數或獲利機率。若分數相同，優先列出 Min-Max 標準化後 DTW 距離較低的股票。歷史同步不代表未來走勢或套利結果。</p></div>
  </section>
 </SiteShell>;
}

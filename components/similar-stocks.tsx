import {useEffect,useMemo,useState} from 'react';
import {ArrowDownRight,ArrowUpRight,ChartNoAxesCombined,Search} from 'lucide-react';
import type {ScreenerSnapshot} from '../lib/market-types';
import {findSimilarStocks,type ComparisonStock} from '../lib/stock-comparison';
import {SiteShell} from './site-shell';

function symbolCode(value:string){return value.match(/^\s*([1-9]\d{3})(?:\s|$)/)?.[1]||''}
function pct(value:number|null){return value===null?'—':`${value>0?'+':''}${value.toFixed(2)}%`}
function similarity(value:number|null){return value===null?'—':`${value}%`}

export function SimilarStocks(){
 const [snapshot,setSnapshot]=useState<ScreenerSnapshot|null>(null);
 const [error,setError]=useState('');
 const [input,setInput]=useState('');
 useEffect(()=>{let active=true;void fetch('./data/screener.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('全市場歷史快照尚未發布');return response.json() as Promise<ScreenerSnapshot>}).then(value=>{if(active&&Array.isArray(value.stocks))setSnapshot(value);else if(active)setError('篩選資料格式不完整')}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'無法載入股票歷史資料')});return()=>{active=false}},[]);
 const stocks=useMemo<ComparisonStock[]>(()=>snapshot?.stocks.filter(stock=>(stock.market==='TWSE'||stock.market==='TPEX')&&Array.isArray(stock.bars)).map(stock=>({code:stock.code,name:stock.name,market:stock.market as 'TWSE'|'TPEX',bars:stock.bars.filter(bar=>Number.isFinite(bar.close)&&Number(bar.close)>0).map(bar=>({date:bar.date,close:Number(bar.close)}))}))||[],[snapshot]);
 const chosen=stocks.find(stock=>stock.code===symbolCode(input));
 const selected=chosen&&chosen.bars.length>=31?chosen:undefined;
 const ranked=useMemo(()=>selected?findSimilarStocks(selected,stocks,5):[],[selected,stocks]);
 const completeCount=stocks.filter(stock=>stock.bars.length>=31).length;
 return <SiteShell active="compare">
  <div className="page-heading"><div><div className="eyebrow">FIND SIMILAR STOCKS</div><h1>相似股票<span className="heading-dot">.</span></h1><p>選擇 A 股票，自動從上市與上櫃股票找出最近 30 個交易日走勢最相似的前五名。</p></div><ChartNoAxesCombined size={30}/></div>
  <nav className="compare-subnav" aria-label="股票對比子頁面"><a href="#/compare">雙股對比</a><a className="active" href="#/compare/similar">相似股票</a></nav>
  <section className="panel similar-panel">
   <div className="panel-heading"><div><h2>選擇 A 股票</h2><p>以 {snapshot?.asOf||'最新交易日'} 為資料基準；切換股票後會自動重算，不需再按查詢。</p></div><span className="badge blue">{snapshot?`${completeCount.toLocaleString()} 檔可選`:'讀取全市場資料中'}</span></div>
   <div className="similar-picker"><label htmlFor="similar-stock-input">A 股票代號或名稱</label><div className="similar-search"><Search size={18}/><input id="similar-stock-input" list="similar-stock-options" value={input} onChange={event=>setInput(event.target.value)} placeholder="輸入代號或名稱，例如 2330 台積電" autoComplete="off"/><datalist id="similar-stock-options">{stocks.filter(stock=>stock.bars.length>=31).map(stock=><option key={`${stock.market}-${stock.code}`} value={`${stock.code} ${stock.name}`}/>)}</datalist></div>
    <p className="compare-note">共有 {completeCount.toLocaleString()} 檔具有至少 31 個有效收盤價可供選擇。僅將與 A 股重疊滿 30 個交易日的股票納入排名。</p>
   </div>
   {error&&<p className="compare-note" role="alert">{error}</p>}
   {selected&&<div className="similar-selection"><span>A 股票</span><strong>{selected.code} {selected.name}</strong><small>{selected.market==='TWSE'?'上市':'上櫃'} · 有效收盤 {selected.bars.length} 筆</small></div>}
   {input&&!selected&&<div className="similar-empty"><Search size={22}/><p>{chosen?'這檔股票的歷史收盤資料不足 31 筆，請選擇完整 30 日資料的 A 股票。':'請從建議清單選擇具有完整 30 日資料的股票代號。'}</p></div>}
   {selected&&ranked.length>0&&<div className="similar-results" aria-live="polite"><div className="similar-results-heading"><div><h2>相似度前五名</h2><p>依 30 日同步分數由高至低排序，DTW 距離用於同分排序。</p></div><span>{ranked.length} 檔</span></div>{ranked.map((result,index)=><article className="similar-result" key={result.stock.code}><div className="similar-rank">{String(index+1).padStart(2,'0')}</div><div className="similar-stock-name"><a href={`#/stocks/${result.stock.code}`}><strong>{result.stock.code}</strong><span>{result.stock.name}</span><ArrowUpRight size={14}/></a><small>{result.stock.market==='TWSE'?'上市':'上櫃'} · {result.sessionCount} 個共同交易日</small></div><div className="similar-score"><small>相似度</small><strong>{similarity(result.synchronizationRate)}</strong></div><div className="similar-metric"><small>A 30 日漲幅</small><strong>{pct(result.firstChange)}</strong></div><div className="similar-metric"><small>相似股 30 日漲幅</small><strong>{pct(result.secondChange)}</strong></div><div className="similar-metric"><small>A 相對強弱差</small><strong>{pct(result.spread)}</strong></div><div className="similar-metric"><small>DTW 距離</small><strong>{result.dtwDistance===null?'—':result.dtwDistance.toFixed(4)}</strong></div><div className="similar-link"><a href={`#/stocks/${result.stock.code}`} aria-label={`查看 ${result.stock.code} ${result.stock.name} 個股頁`}>{result.spread!==null&&result.spread>=0?<ArrowUpRight size={18}/>:<ArrowDownRight size={18}/>}</a></div></article>)}</div>}
   {selected&&!ranked.length&&<div className="similar-empty"><Search size={22}/><p>目前找不到有足夠共同交易日且可計算同步分數的相似股票。</p></div>}
   {!selected&&!input&&<div className="similar-empty"><ChartNoAxesCombined size={25}/><p>選擇 A 股票後會立即列出五檔最相似的股票。</p></div>}
   <div className="panel-note similar-method"><p>相似度使用股票對比頁相同的 3 日平滑 Pearson、Spearman、2 日累積對數報酬差與同向交易比例，總權重固定為 100%，轉換成 0～100 的本站同步分數；它不是傳統 Pearson 相關係數或獲利機率。若分數相同，優先列出 Min-Max 標準化後 DTW 距離較低的股票。歷史同步不代表未來走勢或套利結果。</p></div>
  </section>
 </SiteShell>;
}

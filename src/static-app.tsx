import {useEffect,useState} from 'react';
import type {MarketSnapshot,ScreenerSnapshot} from '../lib/market-types';
import {simulate} from '../lib/rules';
import {loadLatestSnapshot} from '../lib/static-data';
import {Dashboard} from '../components/dashboard';
import {DispositionStocks} from '../components/disposition-stocks';
import {StockDetail} from '../components/stock-detail';
import {StockCompare} from '../components/stock-compare-live';
import {StockScreener} from '../components/stock-screener';
import Methodology from '../app/methodology/page';
import {SiteShell} from '../components/site-shell';
import {listLocalSimulations} from '../lib/local-simulations';
import {fmt,shortDate,timestamp} from '../lib/format';
import {publicSourceUrl} from '../lib/public-source';
import {History,ArrowUpRight} from 'lucide-react';

function currentPath(){return (location.hash.slice(1)||'/').replace(/\?.*$/,'');}

export function StaticApp(){
 const [path,setPath]=useState(currentPath),[snapshot,setSnapshot]=useState<MarketSnapshot|null>(null),[storage,setStorage]=useState('snapshot'),[error,setError]=useState('');
 useEffect(()=>{const onHash=()=>setPath(currentPath());addEventListener('hashchange',onHash);void loadLatestSnapshot().then(value=>{setSnapshot(value.snapshot);setStorage(value.storage);}).catch(reason=>setError(reason instanceof Error?reason.message:'資料載入失敗'));return()=>removeEventListener('hashchange',onHash);},[]);
 if(!snapshot)return <SiteShell><section className="panel"><div className="empty-state"><h2>{error||'正在載入最新市場快照…'}</h2><p>{error?'請確認 public/data/market.json 已隨網站發布。':'將優先讀取 Supabase，失敗時改用靜態快照。'}</p></div></section></SiteShell>;
 if(path==='/methodology')return <Methodology/>;
 if(path==='/status')return <Status snapshot={snapshot} storage={storage}/>;
 if(path==='/compare')return <StockCompare snapshot={snapshot}/>;
 if(path==='/screener')return <ScreenerRoute fallback={snapshot}/>;
 if(path==='/history')return <StaticHistory/>;
 if(path==='/dispositions')return <DispositionStocks snapshot={snapshot}/>;
 const match=path.match(/^\/stocks\/(\d{4})$/),stock=match?snapshot.stocks.find(item=>item.code===match[1]):undefined;
 if(stock&&stock.close)return <StockDetail stock={stock} snapshot={snapshot} initial={simulate(stock,snapshot)}/>;
 return <Dashboard key={`${snapshot.generatedAt}-${storage}`} initial={snapshot} storage={storage} servedAt={Date.parse(snapshot.generatedAt)}/>;
}

function StaticHistory(){const rows=listLocalSimulations();return <SiteShell active="history"><div className="page-heading"><div><div className="eyebrow">保留假設・僅此瀏覽器</div><h1>試算紀錄<span className="heading-dot">.</span></h1><p>靜態站不公開個人試算；最近 30 次只保存在這個瀏覽器。</p></div><History size={30}/></div><section className="panel">{!rows.length?<div className="empty-state"><History size={32}/><h2>還沒有保存的試算</h2><p>進入個股頁，調整假設後按「試算並保存」。</p><a href="#/" className="primary-link">前往觀測清單 <ArrowUpRight size={16}/></a></div>:<div className="history-list">{rows.map(r=><article key={r.id}><div className="history-item-title"><a href={`#/stocks/${r.code}`}><strong>{r.code}</strong><ArrowUpRight size={16}/></a><time>{timestamp(r.created_at)}</time></div><p>預測 {r.target_date} · 資料 {r.payload.asOf} · 參考價 {fmt(r.payload.reference)} 元</p></article>)}</div>}</section></SiteShell>}

function ScreenerRoute({fallback}:{fallback:MarketSnapshot}){const [snapshot,setSnapshot]=useState<ScreenerSnapshot|null>(null),[error,setError]=useState('');useEffect(()=>{let active=true;void fetch('./data/screener.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('全市場篩選資料尚未發布');return response.json() as Promise<ScreenerSnapshot>}).then(value=>{if(active&&Array.isArray(value.stocks))setSnapshot(value);else if(active)setError('篩選資料格式不完整')}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'無法載入全市場篩選資料')});return()=>{active=false}},[]);if(snapshot)return <StockScreener snapshot={snapshot}/>;return <StockScreener notice={error||'正在讀取篩選專用的精簡歷史資料。'} snapshot={{asOf:fallback.asOf,generatedAt:fallback.generatedAt,stocks:fallback.stocks.map(({bars,...stock})=>({...stock,bars:bars.map(({date,close})=>({date,close}))}))}}/>}

function Status({snapshot:s,storage}:{snapshot:MarketSnapshot;storage:string}){return <SiteShell><div className="page-heading"><div><div className="eyebrow">DATA TRANSPARENCY</div><h1>資料來源與狀態<span className="heading-dot">.</span></h1><p>GitHub Actions 更新官方公開資料，靜態站唯讀顯示。</p></div></div><div className="summary-grid"><div className="summary-card"><div className="summary-label">資料交易日</div><div className="status-value">{s.asOf}</div><p>批次取得：{timestamp(s.generatedAt)}</p></div><div className="summary-card"><div className="summary-label">快照來源</div><div className="status-value">{storage==='supabase'?'Supabase':'靜態快照'}</div><p>資料庫讀取失敗時自動使用隨站發布版本</p></div><div className="summary-card"><div className="summary-label">觀測起始日</div><div className="status-value">{s.targetDate}</div><p>{s.calendarVerified?'已套用官方年度休市表':'僅依平日推估'}</p></div></div><section className="panel prose-card"><h2>市場覆蓋</h2><p>目前收錄 {s.stocks.length} 檔上市與上櫃普通股。注意股與官方處置候選的歷史資料每次批次更新；股票篩選頁的 30 日資料依完整收盤紀錄逐檔計算，歷史不足者會標示資料不足。</p><p>資料截至 {shortDate(s.asOf)}；風險日期為條件式推估，正式處置仍以證交所或櫃買中心公告為準。</p><h2>本批次來源</h2><div className="source-list">{s.sources.map((source,i)=>{const url=publicSourceUrl(source.url);return <div key={`${source.url}-${i}`}>{url?<a href={url} target="_blank" rel="noreferrer">{url}</a>:<span>來源端點未公開</span>}<small>{timestamp(source.observedAt)}</small></div>})}</div></section></SiteShell>}

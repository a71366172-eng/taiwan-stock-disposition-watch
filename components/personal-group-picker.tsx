import {useEffect,useMemo,useRef,useState} from 'react';

type Group={id:string;name:string;codes:string[]};
type GroupSource={id:string;label:string;source:string;groups:Group[]};
type GroupFile={sources:GroupSource[]};
type StockOption={code:string;name:string};

export function PersonalGroupPicker({stocks,watchGroups,onClose,onApply}:{stocks:StockOption[];watchGroups:Group[];onClose:()=>void;onApply:(first:StockOption,second:StockOption)=>void}){
 const [sources,setSources]=useState<GroupSource[]>([]);
 const [sourceId,setSourceId]=useState('original');
 const [error,setError]=useState('');
 const [groupId,setGroupId]=useState('');
 const [groupQuery,setGroupQuery]=useState('');
 const [stockQuery,setStockQuery]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const searchRef=useRef<HTMLInputElement>(null);
 const stockByCode=useMemo(()=>new Map(stocks.map(stock=>[stock.code,stock])),[stocks]);
 useEffect(()=>{
  let active=true;
  void fetch('./data/personal-groups.json').then(async response=>{
   if(!response.ok)throw new Error(`分類資料載入失敗（${response.status}）`);
   return response.json() as Promise<GroupFile>;
  }).then(data=>{
   if(!Array.isArray(data.sources)||!data.sources.length||data.sources.some(source=>!Array.isArray(source.groups)))throw new Error('分類資料格式不正確');
   if(active){setSources(data.sources);setGroupId(data.sources[0].groups[0]?.id||'')}
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'分類資料載入失敗')});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[onClose]);
 const allSources=[...sources,{id:'attention_disposition',label:'注意股和處置股',source:'注意股含近 45 個日曆日有公告或官方候選；處置股以資料快照日仍在處置期間判定。',groups:watchGroups}];
 const currentSource=allSources.find(source=>source.id===sourceId);
 const groups=currentSource?.groups||[];
 useEffect(()=>{if(sources.length)searchRef.current?.focus()},[sources.length]);
 const visibleGroups=groups.filter(group=>group.name.toLocaleLowerCase().includes(groupQuery.trim().toLocaleLowerCase()));
 const currentGroup=groups.find(group=>group.id===groupId);
 const visibleStocks=(currentGroup?.codes||[]).filter(code=>{
  const stock=stockByCode.get(code);
  return stock&&`${code} ${stock.name}`.toLocaleLowerCase().includes(stockQuery.trim().toLocaleLowerCase());
 });
 function toggle(code:string){setSelected(current=>current.includes(code)?current.filter(item=>item!==code):current.length<2?[...current,code]:current)}
 function apply(){
  const first=stockByCode.get(selected[0]);
  const second=stockByCode.get(selected[1]);
  if(first&&second)onApply(first,second);
 }
 return <div className="personal-group-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="personal-group-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-group-title">
   <header><div><h2 id="personal-group-title">股票清單選股</h2><p>勾選兩檔股票，依勾選順序帶入 A、B。</p></div><button type="button" className="personal-group-close" onClick={onClose} aria-label="關閉分類選股">×</button></header>
   {error?<p className="compare-note" role="alert">{error}</p>:!sources.length?<p className="compare-note">正在載入分類…</p>:<>
    <nav className="personal-group-source-tabs" aria-label="選擇股票清單">{allSources.map(source=><button type="button" key={source.id} className={source.id===sourceId?'active':''} onClick={()=>{setSourceId(source.id);setGroupId(source.groups[0]?.id||'');setGroupQuery('');setStockQuery('')}}>{source.label}</button>)}</nav>
    <p className="personal-group-source-note">{currentSource?.source}</p>
    <div className="personal-group-body">
    <aside className="personal-group-categories"><label>搜尋分類<input ref={searchRef} value={groupQuery} onChange={event=>setGroupQuery(event.target.value)} placeholder="例如 PCB、矽光子"/></label><div className="personal-group-category-list">{visibleGroups.map(group=><button type="button" key={group.id} className={group.id===groupId?'active':''} onClick={()=>{setGroupId(group.id);setStockQuery('')}}>{group.name}<small>{group.codes.length}</small></button>)}{!visibleGroups.length&&<p>找不到分類</p>}</div></aside>
    <div className="personal-group-stocks"><label>搜尋 {currentGroup?.name||''} 股票<input value={stockQuery} onChange={event=>setStockQuery(event.target.value)} placeholder="輸入代號或名稱"/></label><div className="personal-group-stock-list">{visibleStocks.map(code=>{const stock=stockByCode.get(code)!;const checked=selected.includes(code);return <label key={code} className={checked?'selected':''}><input type="checkbox" checked={checked} disabled={!checked&&selected.length>=2} onChange={()=>toggle(code)}/><strong>{code}</strong><span>{stock.name}</span><small>{checked?selected.indexOf(code)===0?'A':'B':''}</small></label>})}{!visibleStocks.length&&<p>這個分類沒有目前可比較的上市／上櫃股票。</p>}</div></div>
    </div></>}
   <footer><span>已選：{selected.map((code,index)=>`${index===0?'A':'B'} ${code} ${stockByCode.get(code)?.name||''}`).join('、')||'請選兩檔股票'}</span><div><button type="button" onClick={onClose}>取消</button><button type="button" className="compare-button" onClick={apply} disabled={selected.length!==2}>帶入股票 A、B</button></div></footer>
  </section>
 </div>;
}

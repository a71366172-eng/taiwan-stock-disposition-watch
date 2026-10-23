import type {MarketSnapshot,Simulation,Stock} from '../lib/market-types';
import {attentionCheckState,attentionOverallState,attentionPrediction,attentionQuickSummary} from '../lib/attention-prediction';
import {fmt} from '../lib/format';
import {attentionLawUrl,attentionLegalDetails} from '../lib/attention-law';

export function AttentionPrediction({stock,snapshot,result}:{stock:Stock;snapshot:MarketSnapshot;result:Simulation}){
 const rows=attentionPrediction(stock,snapshot,result);
 const quickSummary=attentionQuickSummary(rows);
 const labels={partial:'基本條件候選',outside:'價格範圍未達',missing:'待補資料',exempt:'不適用／已除外',manual:'公告認定'};
 const checkLabel={safe:'無風險',near:'可能觸發',triggered:'已達條件',unknown:'待補資料'};
 const groupLabel={safe:'無風險',near:'可能觸發',triggered:'必觸發',unknown:'待補資料'};
 const detailState=(status:string):'safe'|'near'|'unknown'=>status==='outside'||status==='exempt'?'safe':status==='partial'?'near':'unknown';
 const groups=[{title:'第 1–8 款｜計入處置',start:0,end:8},{title:'第 9–14 款',start:8,end:14}];
 return <section className="panel attention-prediction">
  <div className="panel-heading"><div><h2>下個交易日注意預測 <small>{result.targetDate}</small></h2></div></div>
  <div className="attention-overview"><span>參考價 <strong>{fmt(result.reference)}</strong></span><span>漲停 {fmt(result.limits.high)}</span><span>跌停 {fmt(result.limits.low)}</span></div>
  <div className="attention-quick-summary" aria-label="主要注意條件速覽">{quickSummary.map(line=><div className="attention-quick-line" key={line.label}><strong>{line.label}</strong><div className="attention-quick-content"><span className={`badge attention-state-${line.state}`}>{line.badge}</span><span>{line.summary}</span></div></div>)}</div>
  {groups.map(group=><details className="attention-group" key={group.start}>
   <summary>{group.title}</summary>
   <div>{rows.slice(group.start,group.end).map(row=>{
    const state=row.status==='outside'||row.status==='exempt'?'safe':row.checks?attentionOverallState(row.checks):row.status==='partial'?'near':'unknown';
    const detailGroups=row.checks?[{title:'標準一',checks:row.checks.slice(0,2)},{title:'標準二',checks:row.checks.slice(2)}].filter(item=>item.checks.length>0):[];
    const priceState=detailState(row.status);
    const rowBadge=row.rule===2&&row.status==='outside'?'情境條件未達':labels[row.status];
    return <details className={`attention-row attention-${row.status}`} key={row.rule}>
     <summary><strong>第 {row.rule} 款 <span>{row.name}</span></strong><span className="attention-threshold">{row.summary}</span><span className={`badge attention-state-${state}`}>{rowBadge}</span></summary>
     <div className="attention-explanation">
      {detailGroups.length>0&&<div className="attention-check-groups">{detailGroups.map(item=>{
       const groupRisk=attentionCheckState(item.checks);
       return <section className={`attention-check-group attention-state-${groupRisk}`} key={item.title}>
        <strong>{item.title}<span>{groupLabel[groupRisk]}</span></strong>
        {item.checks.map(check=><div className={`attention-check attention-state-${check.state}`} key={`${item.title}-${check.label}`}><span>{check.label}</span><span>{check.value}</span><b>{checkLabel[check.state]}</b></div>)}
       </section>;
      })}</div>}
      {!row.checks&&row.rule<=8&&<div className="attention-clause-details">
       <div className={`attention-clause-check attention-state-${priceState}`}><strong>價格條件</strong><span>{row.rule===1&&row.conditionSummary?row.conditionSummary:row.summary}</span><b>{row.status==='exempt'?'除外':row.status==='outside'&&row.rule===2?'情境未達':row.status==='outside'?'價格未達':row.status==='partial'?'情境試算':'待核對'}</b></div>
       {row.details.map((value,index)=><div className="attention-clause-check attention-state-unknown" key={`${row.rule}-${index}`}><strong>{row.rule===2&&index<3?`${[30,60,90][index]} 日`:index===0?'判斷依據':'其他條件'}</strong><span>{value}</span><b>{/缺|待核|未確定|未知|尚未/.test(value)?'待核對':'條件說明'}</b></div>)}
      </div>}
      {!row.checks&&row.rule>8&&row.details.length>0&&<ul>{row.details.map(text=><li key={text}>{text}</li>)}</ul>}
      {row.rule<=8&&<details className="attention-legal-details">
       <summary>法定除外、免比較與計算調整 <small>（{stock.market==='TPEX'?'上櫃':'上市'}第 {row.rule} 款）</small></summary>
       <p>以下列出法規效果；「待核對」項目不代表本股已符合除外條件。</p>
       <div className="attention-legal-list">{attentionLegalDetails(stock,row.rule).map((item,index)=><div className="attention-legal-item" key={`${row.rule}-${index}`}><b>{item.effect}</b><span>{item.text}</span></div>)}</div>
       <a href={attentionLawUrl(stock.market)} target="_blank" rel="noopener noreferrer">查看現行法規 ↗</a>
      </details>}
     </div>
    </details>;
   })}</div>
  </details>)}
 </section>;
}

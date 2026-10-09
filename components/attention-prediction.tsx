import type {MarketSnapshot,Simulation,Stock} from '../lib/market-types';
import {attentionCheckState,attentionOverallState,attentionPrediction} from '../lib/attention-prediction';
import {fmt} from '../lib/format';

export function AttentionPrediction({stock,snapshot,result}:{stock:Stock;snapshot:MarketSnapshot;result:Simulation}){
 const rows=attentionPrediction(stock,snapshot,result);
 const labels={partial:'條件式預測',outside:'價格未達',missing:'待補資料',exempt:'不適用／除外',manual:'公告認定'};
 const checkLabel={safe:'無風險',near:'可能觸發',triggered:'已達條件',unknown:'待補資料'};
 const groupLabel={safe:'無風險',near:'可能觸發',triggered:'必觸發',unknown:'待補資料'};
 return <section className="panel attention-prediction"><div className="panel-heading"><div><h2>下個交易日注意預測 <small>{result.targetDate}</small></h2></div></div>
 <div className="attention-overview"><span>參考價 <strong>{fmt(result.reference)}</strong></span><span>漲停 {fmt(result.limits.high)}</span><span>跌停 {fmt(result.limits.low)}</span></div>
 {[{title:'第 1–8 款｜計入處置',start:0,end:8},{title:'第 9–14 款',start:8,end:14}].map(group=><details className="attention-group" key={group.start}><summary>{group.title}</summary><div>{rows.slice(group.start,group.end).map(row=><details className={`attention-row attention-${row.status}${row.checks?' attention-has-checks':''}`} key={row.rule}><summary><strong>第 {row.rule} 款 <span>{row.name}</span></strong><span className="attention-threshold">{row.summary}</span><span className={`badge attention-state-${row.checks?attentionOverallState(row.checks):row.status==='outside'?'safe':row.status==='partial'?'near':'unknown'}`}>{row.checks?row.summary:labels[row.status]}</span></summary><div className="attention-explanation">{row.checks&&<div className="attention-check-groups">{[{title:'標準一',checks:row.checks.slice(0,2)},{title:'標準二',checks:row.checks.slice(2)}].filter(group=>group.checks.length>0).map(group=>{const state=attentionCheckState(group.checks);return <section className={`attention-check-group attention-state-${state}`} key={group.title}><strong>{group.title}<span>{groupLabel[state]}</span></strong>{group.checks.map(check=><div className={`attention-check attention-state-${check.state}`} key={`${group.title}-${check.label}`}><span>{check.label}</span><span>{check.value}</span><b>{checkLabel[check.state]}</b></div>)}</section>})}</div>}{row.details.length>0&&<ul>{row.details.map(text=><li key={text}>{text}</li>)}</ul>}</div></details>)}</div></details>)}</section>;
}

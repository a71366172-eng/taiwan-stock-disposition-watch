import type {MarketSnapshot,Simulation,Stock} from '../lib/market-types';
import {attentionPrediction} from '../lib/attention-prediction';
import {fmt} from '../lib/format';

export function AttentionPrediction({stock,snapshot,result}:{stock:Stock;snapshot:MarketSnapshot;result:Simulation}){
 const rows=attentionPrediction(stock,snapshot,result);
 const labels={partial:'條件式預測',outside:'價格未達',missing:'待補資料',exempt:'不適用／除外',manual:'公告認定'};
 return <section className="panel attention-prediction"><div className="panel-heading"><div><h2>下個交易日注意預測 <small>{result.targetDate}</small></h2></div></div>
 <div className="attention-overview"><span>參考價 <strong>{fmt(result.reference)}</strong></span><span>漲停 {fmt(result.limits.high)}</span><span>跌停 {fmt(result.limits.low)}</span></div>
 {[{title:'第 1–8 款｜計入處置',start:0,end:8},{title:'第 9–14 款',start:8,end:14}].map(group=><details className="attention-group" key={group.start}><summary>{group.title}</summary><div>{rows.slice(group.start,group.end).map(row=><details className={`attention-row attention-${row.status}`} key={row.rule}><summary><strong>第 {row.rule} 款 <span>{row.name}</span></strong><span className="attention-threshold">{row.summary}</span><span className="badge gray">{labels[row.status]}</span></summary><div className="attention-explanation">{row.details.length>0&&<ul>{row.details.map(text=><li key={text}>{text}</li>)}</ul>}</div></details>)}</div></details>)}</section>;
}

import type {MarketSnapshot,Simulation,Stock} from '../lib/market-types';
import {attentionPrediction} from '../lib/attention-prediction';
import {fmt} from '../lib/format';

export function AttentionPrediction({stock,snapshot,result}:{stock:Stock;snapshot:MarketSnapshot;result:Simulation}){
 const rows=attentionPrediction(stock,snapshot,result);
 const labels={partial:'條件式預測',outside:'價格未達',missing:'待補資料',exempt:'不適用／除外',manual:'公告認定'};
 return <section className="panel attention-prediction"><div className="panel-heading"><div><h2>下個交易日注意預測 <small>{result.targetDate}</small></h2><p>逐款檢查注意條件；第 1–8 款才納入一般累計處置計次。</p></div></div>
 <div className="attention-overview"><p>目前價格：<strong>{fmt(result.reference)}</strong>（預估漲停 {fmt(result.limits.high)}／跌停 {fmt(result.limits.low)}）</p><p><b>第 1 款</b> {rows[0].summary}</p><p><b>第 2–8 款</b> 各款價格與量能條件不同，詳見下方。</p><small>價格條件採目前情境；達到價格仍須同時符合該款其餘條件。</small></div>
 <p className="attention-count">14 款：{rows.filter(r=>r.status==='partial').length} 款有條件式門檻／{rows.filter(r=>r.status==='missing').length} 款待補資料</p>
 {[{title:'第 1–8 款詳細條件（一般處置計次）',start:0,end:8},{title:'第 9–14 款詳細條件',start:8,end:14}].map(group=><details className="attention-group" open key={group.start}><summary>{group.title}</summary><div>{rows.slice(group.start,group.end).map(row=><details className={`attention-row attention-${row.status}`} key={row.rule}><summary><strong>第 {row.rule} 款 <span>{row.name}</span></strong><span className="attention-threshold">{row.summary}</span><span className="badge gray">{labels[row.status]}</span></summary><div className="attention-explanation"><p>{row.summary}</p>{row.details.length>0&&<ul>{row.details.map(text=><li key={text}>{text}</li>)}</ul>}</div></details>)}</div></details>)}
 <p className="attention-count">參考價以上次收盤推估；除權息、停復牌與市場／產業比較可能改變結果。此處預測注意條件，正式注意及處置以公告為準。</p></section>;
}

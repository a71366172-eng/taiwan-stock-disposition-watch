import {useState} from 'react';
import margins from '../data/futures-margins.json';
import type {ComparisonStock} from '../lib/stock-comparison';
import {calculateMixedEntryCosts,calculateMixedPosition,type PositionInstrument,type PositionSide} from '../lib/position-ratio';

const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;
const sideLabel=(side:PositionSide)=>side==='long'?'做多':'做空';
const instrumentLabel=(type:PositionInstrument)=>type==='stock'?'股票':type==='standard'?'一般個股期':'小型個股期';
type MarginRecord={initialMarginPercent:number;standard:boolean;mini:boolean};
const officialMargins=margins.stocks as Record<string,MarginRecord>;

export function PositionRatioCalculator({pair,date}:{pair:[ComparisonStock,ComparisonStock];date:string|null}){
 const [firstSide,setFirstSide]=useState<PositionSide>('long');
 const [secondSide,setSecondSide]=useState<PositionSide>('short');
 const [firstInstrument,setFirstInstrument]=useState<PositionInstrument>('stock');
 const [secondInstrument,setSecondInstrument]=useState<PositionInstrument>('stock');
 const [firstUnits,setFirstUnits]=useState('1');
 const [targetRatio,setTargetRatio]=useState('1');
 const [firstFuturesPrice,setFirstFuturesPrice]=useState('');
 const [secondFuturesPrice,setSecondFuturesPrice]=useState('');
 const [commission,setCommission]=useState('0.1425');
 const [sellTax,setSellTax]=useState('0.3');
 const [futuresFee,setFuturesFee]=useState('18');
 const [futuresTax,setFuturesTax]=useState('0.002');
 const [otherFees,setOtherFees]=useState('0');
 if(!date)return null;
 const firstClose=pair[0].bars.find(bar=>bar.date===date)?.close;
 const secondClose=pair[1].bars.find(bar=>bar.date===date)?.close;
 if(!firstClose||!secondClose)return null;
 const firstMargin=officialMargins[pair[0].code];
 const secondMargin=officialMargins[pair[1].code];
 const firstAvailable=firstInstrument==='stock'||Boolean(firstMargin?.[firstInstrument]);
 const secondAvailable=secondInstrument==='stock'||Boolean(secondMargin?.[secondInstrument]);
 const firstPrice=firstInstrument==='stock'?firstClose:firstFuturesPrice===''?firstClose:Number(firstFuturesPrice);
 const secondPrice=secondInstrument==='stock'?secondClose:secondFuturesPrice===''?secondClose:Number(secondFuturesPrice);
 const position=firstAvailable&&secondAvailable?calculateMixedPosition(firstPrice,secondPrice,Number(firstUnits),Number(targetRatio),firstInstrument,secondInstrument,firstMargin?.initialMarginPercent??null,secondMargin?.initialMarginPercent??null,firstSide,secondSide):null;
 const costs=position?calculateMixedEntryCosts(position,firstInstrument,secondInstrument,firstSide,secondSide,Number(commission),Number(sellTax),Number(futuresFee),Number(futuresTax),Number(otherFees)):null;
 const instrumentOptions=(record:MarginRecord|undefined)=><><option value="stock">股票 · 每張 1,000 股</option><option value="standard" disabled={!record?.standard}>一般個股期 · 每口 2,000 股</option><option value="mini" disabled={!record?.mini}>小型個股期 · 每口 100 股</option></>;
 return <section className="position-calculator" aria-label="持倉資金比例與成本計算機">
  <div className="position-calculator-heading"><h3>持倉資金比例與成本計算機</h3><small>以 {date} 共同收盤價為現股基準；期貨價格可自行調整</small></div>
  <div className="position-calculator-inputs"><label>A · {pair[0].code} {pair[0].name} 工具<select value={firstInstrument} onChange={event=>setFirstInstrument(event.target.value as PositionInstrument)}>{instrumentOptions(firstMargin)}</select></label><label>B · {pair[1].code} {pair[1].name} 工具<select value={secondInstrument} onChange={event=>setSecondInstrument(event.target.value as PositionInstrument)}>{instrumentOptions(secondMargin)}</select></label><label>A 方向<select value={firstSide} onChange={event=>setFirstSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><label>B 方向<select value={secondSide} onChange={event=>setSecondSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><label>A 數量（股票張數或期貨口數）<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={firstUnits} onChange={event=>setFirstUnits(event.target.value)}/></label><label>目標 A／B 投入資金比<input type="number" min="0.001" max="100" step="0.01" inputMode="decimal" value={targetRatio} onChange={event=>setTargetRatio(event.target.value)}/></label>{firstInstrument!=='stock'&&<label>A 期貨價格（預設現股收盤）<input type="number" min="0.01" step="0.01" inputMode="decimal" value={firstFuturesPrice} placeholder={String(firstClose)} onChange={event=>setFirstFuturesPrice(event.target.value)}/></label>}{secondInstrument!=='stock'&&<label>B 期貨價格（預設現股收盤）<input type="number" min="0.01" step="0.01" inputMode="decimal" value={secondFuturesPrice} placeholder={String(secondClose)} onChange={event=>setSecondFuturesPrice(event.target.value)}/></label>}</div>
  {position?<><div className="position-calculator-results"><div><small>A · {sideLabel(firstSide)} · {instrumentLabel(firstInstrument)}</small><strong>{position.firstUnits.toLocaleString('zh-TW')} {firstInstrument==='stock'?'張':'口'}</strong><span>表彰 {position.firstShares.toLocaleString('zh-TW')} 股；名目 {money(position.firstNotional)}</span></div><div><small>B · {sideLabel(secondSide)} · {instrumentLabel(secondInstrument)}</small><strong>{position.secondUnits.toLocaleString('zh-TW')} {secondInstrument==='stock'?'張':'口'}</strong><span>表彰 {position.secondShares.toLocaleString('zh-TW')} 股；名目 {money(position.secondNotional)}</span></div><div><small>實際投入資金比 A／B</small><strong>{position.capitalRatio.toFixed(3)} : 1</strong><span>目標 {Number(targetRatio).toFixed(3)} : 1；按整數單位取整</span></div><div><small>方向性名目曝險</small><strong>{money(position.netExposure)}</strong><span>占雙邊名目金額 {position.netExposurePercent.toFixed(2)}%；多為正、空為負</span></div></div><div className="position-calculator-results"><div><small>A 投入資金</small><strong>{money(position.firstCapital)}</strong><span>{firstInstrument==='stock'?'現股部位金額（放空擔保另計）':`原始保證金 ${firstMargin.initialMarginPercent}%`}</span></div><div><small>B 投入資金</small><strong>{money(position.secondCapital)}</strong><span>{secondInstrument==='stock'?'現股部位金額（放空擔保另計）':`原始保證金 ${secondMargin.initialMarginPercent}%`}</span></div></div><div className="position-calculator-costs"><h4>建立部位成本估算</h4><div className="position-calculator-inputs"><label>股票手續費率（%）<input type="number" min="0" max="100" step="0.0001" inputMode="decimal" value={commission} onChange={event=>setCommission(event.target.value)}/></label><label>股票做空賣出稅率（%）<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={sellTax} onChange={event=>setSellTax(event.target.value)}/></label><label>期貨手續費（每口／元）<input type="number" min="0" step="1" inputMode="decimal" value={futuresFee} onChange={event=>setFuturesFee(event.target.value)}/></label><label>期貨交易稅率（%）<input type="number" min="0" max="100" step="0.0001" inputMode="decimal" value={futuresTax} onChange={event=>setFuturesTax(event.target.value)}/></label><label>其他費用（元）<input type="number" min="0" step="1" inputMode="decimal" value={otherFees} onChange={event=>setOtherFees(event.target.value)}/></label></div>{costs?<div className="position-calculator-results"><div><small>A 建倉費稅</small><strong>{money(costs.first.fee+costs.first.tax)}</strong><span>手續費 {money(costs.first.fee)}；稅 {money(costs.first.tax)}</span></div><div><small>B 建倉費稅</small><strong>{money(costs.second.fee+costs.second.tax)}</strong><span>手續費 {money(costs.second.fee)}；稅 {money(costs.second.tax)}</span></div><div><small>合計建立費用</small><strong>{money(costs.totalFees)}</strong><span>含其他費用 {money(costs.totalFees-costs.first.fee-costs.first.tax-costs.second.fee-costs.second.tax)}</span></div><div><small>投入資金＋建立費用</small><strong>{money(costs.totalCapital)}</strong><span>股票以部位金額、期貨以原始保證金；放空擔保另計</span></div></div>:<p className="position-calculator-note" role="alert">請輸入有效的非負費率與費用。</p>}</div><p className="position-calculator-note">B 股票張數或期貨口數按目標投入資金比換算為最接近的整數；股票 1 張為 1,000 股。期貨原始保證金以期交所公布的標的適用比例乘上價格與契約股數估算，契約調整、期貨市價與期貨商加收金額可能不同；不提供尚無官方契約的期貨選項。預設期貨價格借用現股收盤，請按實際期貨成交價修正。賣空款項不可視為可動用資金；未計平倉費稅及持有期間費用。</p></>:<p className="position-calculator-note" role="alert">請檢查契約供應情況，以及正數價格、整數單位與目標比例。</p>}
 </section>;
}

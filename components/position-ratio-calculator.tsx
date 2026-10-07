import {useState} from 'react';
import type {ComparisonStock} from '../lib/stock-comparison';
import {calculateEntryCosts,calculatePositionRatio,type PositionSide} from '../lib/position-ratio';

const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;
const sideLabel=(side:PositionSide)=>side==='long'?'做多':'做空';

export function PositionRatioCalculator({pair,date}:{pair:[ComparisonStock,ComparisonStock];date:string|null}){
 const [firstSide,setFirstSide]=useState<PositionSide>('long');
 const [secondSide,setSecondSide]=useState<PositionSide>('short');
 const [firstUnits,setFirstUnits]=useState('1');
 const [targetRatio,setTargetRatio]=useState('1');
 const [commission,setCommission]=useState('0.1425');
 const [sellTax,setSellTax]=useState('0.3');
 const [otherFees,setOtherFees]=useState('0');
 if(!date)return null;
 const firstPrice=pair[0].bars.find(bar=>bar.date===date)?.close;
 const secondPrice=pair[1].bars.find(bar=>bar.date===date)?.close;
 if(!firstPrice||!secondPrice)return null;
 const position=calculatePositionRatio(firstPrice,secondPrice,Number(firstUnits),Number(targetRatio),firstSide,secondSide);
 const costs=position?calculateEntryCosts(position.firstAmount,position.secondAmount,firstSide,secondSide,Number(commission),Number(sellTax),Number(otherFees)):null;
 return <section className="position-calculator" aria-label="持倉資金比例與成本計算機">
  <div className="position-calculator-heading"><h3>持倉資金比例與成本計算機</h3><small>以 {date} 共同收盤價估算，每單位 100 股</small></div>
  <div className="position-calculator-inputs"><label>A · {pair[0].code} {pair[0].name} 方向<select value={firstSide} onChange={event=>setFirstSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><label>B · {pair[1].code} {pair[1].name} 方向<select value={secondSide} onChange={event=>setSecondSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><label>A 持股單位（每單位 100 股）<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={firstUnits} onChange={event=>setFirstUnits(event.target.value)}/></label><label>目標 A／B 資金比<input type="number" min="0.001" max="100" step="0.01" inputMode="decimal" value={targetRatio} onChange={event=>setTargetRatio(event.target.value)}/></label></div>
  {position?<><div className="position-calculator-results"><div><small>A · {sideLabel(firstSide)} · {pair[0].code}</small><strong>{position.firstShares.toLocaleString('zh-TW')} 股</strong><span>部位 {money(position.firstAmount)}</span></div><div><small>B · {sideLabel(secondSide)} · {pair[1].code}</small><strong>{position.secondShares.toLocaleString('zh-TW')} 股</strong><span>部位 {money(position.secondAmount)}</span></div><div><small>實際 A／B 資金比</small><strong>{position.capitalRatio.toFixed(3)} : 1</strong><span>目標 {Number(targetRatio).toFixed(3)} : 1；按百股取整</span></div><div><small>方向性淨曝險</small><strong>{money(position.netExposure)}</strong><span>占雙邊名目金額 {position.netExposurePercent.toFixed(2)}%；多為正、空為負</span></div></div><div className="position-calculator-costs"><h4>建立部位成本估算</h4><div className="position-calculator-inputs"><label>每邊手續費率（%）<input type="number" min="0" max="100" step="0.0001" inputMode="decimal" value={commission} onChange={event=>setCommission(event.target.value)}/></label><label>做空賣出交易稅率（%）<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={sellTax} onChange={event=>setSellTax(event.target.value)}/></label><label>其他費用（元）<input type="number" min="0" step="1" inputMode="decimal" value={otherFees} onChange={event=>setOtherFees(event.target.value)}/></label></div>{costs?<div className="position-calculator-results"><div><small>A 建倉現金流</small><strong>{money(costs.firstCashFlow)}</strong><span>手續費 {money(costs.firstCommission)}；交易稅 {money(costs.firstTax)}</span></div><div><small>B 建倉現金流</small><strong>{money(costs.secondCashFlow)}</strong><span>手續費 {money(costs.secondCommission)}；交易稅 {money(costs.secondTax)}</span></div><div><small>合計建立費用</small><strong>{money(costs.totalFees)}</strong><span>雙邊手續費、做空賣出稅與其他費用</span></div><div><small>雙邊名目金額＋費用</small><strong>{money(costs.grossExposureWithFees)}</strong><span>總建倉現金流 {money(costs.entryCashFlow)}；非保證金需求</span></div></div>:<p className="position-calculator-note" role="alert">請輸入有效的非負費率與費用。</p>}</div><p className="position-calculator-note">B 股數按目標 A／B 資金比換算為最接近的整數百股，至少 100 股。預設手續費率可依券商折扣調整；其他費用可填融券或借券相關費用。現金流為買入支出負、賣空收款正；賣空款項可能受擔保限制，並非可動用資金。本估算未計平倉費稅、持有期間費用與保證金需求。</p></>:<p className="position-calculator-note" role="alert">請輸入 1 至 1,000,000 的整數持股單位，以及大於 0、至多 100 的目標資金比。</p>}
 </section>;
}

import {useState} from 'react';
import type {ComparisonStock} from '../lib/stock-comparison';
import {calculatePositionRatio} from '../lib/position-ratio';

const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;

export function PositionRatioCalculator({pair,date}:{pair:[ComparisonStock,ComparisonStock];date:string|null}){
 const [longSide,setLongSide]=useState<'A'|'B'>('A');
 const [units,setUnits]=useState('1');
 if(!date)return null;
 const firstPrice=pair[0].bars.find(bar=>bar.date===date)?.close;
 const secondPrice=pair[1].bars.find(bar=>bar.date===date)?.close;
 if(!firstPrice||!secondPrice)return null;
 const long=longSide==='A'?pair[0]:pair[1];
 const short=longSide==='A'?pair[1]:pair[0];
 const longPrice=longSide==='A'?firstPrice:secondPrice;
 const shortPrice=longSide==='A'?secondPrice:firstPrice;
 const ratio=calculatePositionRatio(longPrice,shortPrice,Number(units));
 return <section className="position-calculator" aria-label="持倉資金多空比計算機">
  <div className="position-calculator-heading"><h3>持倉資金多空比計算機</h3><small>以 {date} 共同收盤價估算，每單位 100 股</small></div>
  <div className="position-calculator-inputs"><label>做多股票<select value={longSide} onChange={event=>setLongSide(event.target.value as 'A'|'B')}><option value="A">A · {pair[0].code} {pair[0].name}</option><option value="B">B · {pair[1].code} {pair[1].name}</option></select></label><label>多方持股單位（每單位 100 股）<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={units} onChange={event=>setUnits(event.target.value)}/></label></div>
  {ratio?<><div className="position-calculator-results"><div><small>多方 · {long.code} {long.name}</small><strong>{ratio.longShares.toLocaleString('zh-TW')} 股</strong><span>{money(ratio.longAmount)}</span></div><div><small>空方 · {short.code} {short.name}</small><strong>{ratio.shortShares.toLocaleString('zh-TW')} 股</strong><span>{money(ratio.shortAmount)}</span></div><div><small>多空資金比</small><strong>{ratio.capitalRatio.toFixed(3)} : 1</strong><span>多方金額 ÷ 空方金額</span></div><div><small>淨曝險（多方 − 空方）</small><strong>{money(ratio.netExposure)}</strong><span>占雙邊名目金額 {ratio.netExposurePercent.toFixed(2)}%</span></div></div><p className="position-calculator-note">空方股數按最接近等額資金的整數百股計算，至少 100 股；未計交易成本、融券限制、保證金與即時價格。</p></>:<p className="position-calculator-note" role="alert">請輸入 1 至 1,000,000 的整數單位。</p>}
 </section>;
}

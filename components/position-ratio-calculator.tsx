import {useState} from 'react';
import margins from '../data/futures-margins.json';
import type {ComparisonStock} from '../lib/stock-comparison';
import {PositionScenarioCalculator} from './position-scenario-calculator';
import {calculateMixedEntryCosts,calculateMixedPosition,firstUnitsForTarget,ratioStrategySides,type PositionInstrument,type PositionSide,type RatioStrategy} from '../lib/position-ratio';

const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;
const sideLabel=(side:PositionSide)=>side==='long'?'做多':'做空';
const instrumentLabel=(type:PositionInstrument,isEtf?:boolean)=>type==='stock'?(isEtf?'ETF':'股票'):type==='standard'?(isEtf?'一般 ETF 期':'一般個股期'):(isEtf?'小型 ETF 期':'小型個股期');
type MarginRecord={initialMarginPercent:number;standard:boolean;mini:boolean};
type EtfContract={initialMargin:number;shares:number};
type EtfMarginRecord={standard?:EtfContract;mini?:EtfContract};
const officialMargins=margins.stocks as Record<string,MarginRecord>;
const officialEtfMargins=margins.etfs as Record<string,EtfMarginRecord>;

export function PositionRatioCalculator({pair,date,currentRatio,averageRatio}:{pair:[ComparisonStock,ComparisonStock];date:string|null;currentRatio:number|null;averageRatio:number|null}){
 const [firstSide,setFirstSide]=useState<PositionSide>('long');
 const [secondSide,setSecondSide]=useState<PositionSide>('short');
 const [firstInstrument,setFirstInstrument]=useState<PositionInstrument>('stock');
 const [secondInstrument,setSecondInstrument]=useState<PositionInstrument>('stock');
 const [firstUnits,setFirstUnits]=useState('1');
 const [firstUnitsAnchor,setFirstUnitsAnchor]=useState('1');
 const [secondUnits,setSecondUnits]=useState('1');
 const [ratioDriver,setRatioDriver]=useState<'target'|'second'>('target');
 const [targetRatio,setTargetRatio]=useState('1');
 const [firstPriceOverride,setFirstPriceOverride]=useState<{key:string;value:string}|null>(null);
 const [secondPriceOverride,setSecondPriceOverride]=useState<{key:string;value:string}|null>(null);
 const [commission,setCommission]=useState('0.1425');
 const [sellTax,setSellTax]=useState('0.3');
 const [etfSellTax,setEtfSellTax]=useState('0.1');
 const [futuresFee,setFuturesFee]=useState('18');
 const [futuresTax,setFuturesTax]=useState('0.002');
 const [otherFees,setOtherFees]=useState('0');
 if(!date)return null;
 const firstClose=pair[0].bars.find(bar=>bar.date===date)?.close;
 const secondClose=pair[1].bars.find(bar=>bar.date===date)?.close;
 if(!firstClose||!secondClose)return null;
 const firstMargin=officialMargins[pair[0].code];
 const secondMargin=officialMargins[pair[1].code];
 const firstEtfMargin=officialEtfMargins[pair[0].code];
 const secondEtfMargin=officialEtfMargins[pair[1].code];
 const firstEtfContract=firstInstrument==='stock'?undefined:firstEtfMargin?.[firstInstrument];
 const secondEtfContract=secondInstrument==='stock'?undefined:secondEtfMargin?.[secondInstrument];
 const firstAvailable=firstInstrument==='stock'||Boolean(pair[0].isEtf?firstEtfContract:firstMargin?.[firstInstrument]);
 const secondAvailable=secondInstrument==='stock'||Boolean(pair[1].isEtf?secondEtfContract:secondMargin?.[secondInstrument]);
 const firstPriceKey=`${pair[0].code}:${date}`;
 const secondPriceKey=`${pair[1].code}:${date}`;
 const firstPriceInput=firstPriceOverride?.key===firstPriceKey?firstPriceOverride.value:String(firstClose);
 const secondPriceInput=secondPriceOverride?.key===secondPriceKey?secondPriceOverride.value:String(secondClose);
 const firstPrice=Number(firstPriceInput);
 const secondPrice=Number(secondPriceInput);
 const position=firstAvailable&&secondAvailable?calculateMixedPosition(firstPrice,secondPrice,Number(firstUnits),ratioDriver==='second'?1:Number(targetRatio),firstInstrument,secondInstrument,firstMargin?.initialMarginPercent??null,secondMargin?.initialMarginPercent??null,firstSide,secondSide,{firstShares:firstEtfContract?.shares,secondShares:secondEtfContract?.shares,firstFixedMargin:firstEtfContract?.initialMargin,secondFixedMargin:secondEtfContract?.initialMargin},ratioDriver==='second'?Number(secondUnits):undefined):null;
 const displayedRatio=ratioDriver==='second'&&position?String(Number(position.capitalRatio.toFixed(6))):targetRatio;
 const displayedSecondUnits=ratioDriver==='second'?secondUnits:position?String(position.secondUnits):'';
 const costs=position?calculateMixedEntryCosts(position,firstInstrument,secondInstrument,firstSide,secondSide,Number(commission),Number(sellTax),Number(futuresFee),Number(futuresTax),Number(otherFees),pair[0].isEtf,pair[1].isEtf,Number(etfSellTax)):null;
 const convergence=ratioStrategySides(currentRatio,averageRatio,'convergence');
 const divergence=ratioStrategySides(currentRatio,averageRatio,'divergence');
 const applyStrategy=(strategy:RatioStrategy)=>{
  const sides=ratioStrategySides(currentRatio,averageRatio,strategy);
  if(sides){setFirstSide(sides[0]);setSecondSide(sides[1]);}
 };
 const instrumentOptions=(record:MarginRecord|undefined,isEtf:boolean|undefined,etfRecord:EtfMarginRecord|undefined)=><><option value="stock">{isEtf?'ETF · 每張 1,000 單位':'股票 · 每張 1,000 股'}</option><option value="standard" disabled={isEtf?!etfRecord?.standard:!record?.standard}>{isEtf?'一般 ETF 期 · 每口 10,000 單位':'一般個股期 · 每口 2,000 股'}</option><option value="mini" disabled={isEtf?!etfRecord?.mini:!record?.mini}>{isEtf?'小型 ETF 期 · 每口 1,000 單位':'小型個股期 · 每口 100 股'}</option></>;
 return <section className="position-calculator" aria-label="持倉資金比例與成本計算機">
  <div className="position-calculator-heading"><h3>持倉資金比例與成本計算機</h3><small>A／B 價格預設為 {date} 共同收盤價，可直接調整後試算</small></div>
  <div className="position-strategies"><span>比值方向快速設定</span><button type="button" onClick={()=>applyStrategy('convergence')} disabled={!convergence}>收斂策略</button><button type="button" onClick={()=>applyStrategy('divergence')} disabled={!divergence}>發散策略</button><small>{convergence?`目前 A／B ${currentRatio!==null&&averageRatio!==null&&currentRatio>averageRatio?'高於':'低於'}平均；收斂：A ${sideLabel(convergence[0])}／B ${sideLabel(convergence[1])}，發散方向相反。`:'需有完整平均比值，且目前比值與平均不同，才能套用。'}</small></div>
  <div className="position-calculator-inputs"><label>A · {pair[0].code} {pair[0].name} 工具<select value={firstInstrument} onChange={event=>setFirstInstrument(event.target.value as PositionInstrument)}>{instrumentOptions(firstMargin,pair[0].isEtf,firstEtfMargin)}</select></label><label>B · {pair[1].code} {pair[1].name} 工具<select value={secondInstrument} onChange={event=>setSecondInstrument(event.target.value as PositionInstrument)}>{instrumentOptions(secondMargin,pair[1].isEtf,secondEtfMargin)}</select></label><label>A 方向<select value={firstSide} onChange={event=>setFirstSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><label>B 方向<select value={secondSide} onChange={event=>setSecondSide(event.target.value as PositionSide)}><option value="long">做多</option><option value="short">做空</option></select></label><div className="position-calculator-quantities"><label>A 數量（股票張數或期貨口數）<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={firstUnits} onChange={event=>{setTargetRatio(displayedRatio);setRatioDriver('target');setFirstUnits(event.target.value);setFirstUnitsAnchor(event.target.value)}}/></label><label>目標 A／B 投入資金比<input type="number" min="0.001" max="1000000" step="any" inputMode="decimal" value={displayedRatio} onChange={event=>{const next=event.target.value;setTargetRatio(next);setRatioDriver('target');if(firstAvailable&&secondAvailable){const units=firstUnitsForTarget(Number(next),Number(firstUnitsAnchor),quantity=>calculateMixedPosition(firstPrice,secondPrice,quantity,Number(next),firstInstrument,secondInstrument,firstMargin?.initialMarginPercent??null,secondMargin?.initialMarginPercent??null,firstSide,secondSide,{firstShares:firstEtfContract?.shares,secondShares:secondEtfContract?.shares,firstFixedMargin:firstEtfContract?.initialMargin,secondFixedMargin:secondEtfContract?.initialMargin}));setFirstUnits(String(units))}}}/></label><label>B 數量（股票張數或期貨口數）<input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={displayedSecondUnits} onChange={event=>{setSecondUnits(event.target.value);setFirstUnitsAnchor(firstUnits);setRatioDriver('second')}}/></label></div><label>A 價格（預設 {date} 收盤）<input type="number" min="0.01" step="0.01" inputMode="decimal" value={firstPriceInput} onChange={event=>setFirstPriceOverride({key:firstPriceKey,value:event.target.value})}/></label><label>B 價格（預設 {date} 收盤）<input type="number" min="0.01" step="0.01" inputMode="decimal" value={secondPriceInput} onChange={event=>setSecondPriceOverride({key:secondPriceKey,value:event.target.value})}/></label></div>
  {position?<><div className="position-calculator-results"><div><small>A · {sideLabel(firstSide)} · {instrumentLabel(firstInstrument,pair[0].isEtf)}</small><strong>{position.firstUnits.toLocaleString('zh-TW')} {firstInstrument==='stock'?'張':'口'}</strong><span>表彰 {position.firstShares.toLocaleString('zh-TW')} {pair[0].isEtf?'單位':'股'}；名目 {money(position.firstNotional)}</span></div><div><small>B · {sideLabel(secondSide)} · {instrumentLabel(secondInstrument,pair[1].isEtf)}</small><strong>{position.secondUnits.toLocaleString('zh-TW')} {secondInstrument==='stock'?'張':'口'}</strong><span>表彰 {position.secondShares.toLocaleString('zh-TW')} {pair[1].isEtf?'單位':'股'}；名目 {money(position.secondNotional)}</span></div><div><small>實際投入資金比 A／B</small><strong>{position.capitalRatio.toFixed(3)} : 1</strong><span>{ratioDriver==='second'?'依 B 數量計算':`目標 ${Number(targetRatio).toFixed(3)} : 1；按整數單位取整`}</span></div><div><small>方向性名目曝險</small><strong>{money(position.netExposure)}</strong><span>占雙邊名目金額 {position.netExposurePercent.toFixed(2)}%；多為正、空為負</span></div></div><div className="position-calculator-results"><div><small>A 投入資金</small><strong>{money(position.firstCapital)}</strong><span>{firstInstrument==='stock'?'現股部位金額（放空擔保另計）':pair[0].isEtf?`期交所原始保證金 ${money(firstEtfContract!.initialMargin)}／口`:`原始保證金 ${firstMargin.initialMarginPercent}%`}</span></div><div><small>B 投入資金</small><strong>{money(position.secondCapital)}</strong><span>{secondInstrument==='stock'?'現股部位金額（放空擔保另計）':pair[1].isEtf?`期交所原始保證金 ${money(secondEtfContract!.initialMargin)}／口`:`原始保證金 ${secondMargin.initialMarginPercent}%`}</span></div></div><div className="position-calculator-costs"><h4>建立部位成本估算</h4><div className="position-calculator-inputs"><label>股票手續費率（%）<input type="number" min="0" max="100" step="0.0001" inputMode="decimal" value={commission} onChange={event=>setCommission(event.target.value)}/></label><label>股票做空賣出稅率（%）<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={sellTax} onChange={event=>setSellTax(event.target.value)}/></label><label>ETF 做空賣出稅率（%）<input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={etfSellTax} onChange={event=>setEtfSellTax(event.target.value)}/></label><label>期貨手續費（每口／元）<input type="number" min="0" step="1" inputMode="decimal" value={futuresFee} onChange={event=>setFuturesFee(event.target.value)}/></label><label>期貨交易稅率（%）<input type="number" min="0" max="100" step="0.0001" inputMode="decimal" value={futuresTax} onChange={event=>setFuturesTax(event.target.value)}/></label><label>其他費用（元）<input type="number" min="0" step="1" inputMode="decimal" value={otherFees} onChange={event=>setOtherFees(event.target.value)}/></label></div>{costs?<div className="position-calculator-results"><div><small>A 建倉費稅</small><strong>{money(costs.first.fee+costs.first.tax)}</strong><span>手續費 {money(costs.first.fee)}；稅 {money(costs.first.tax)}</span></div><div><small>B 建倉費稅</small><strong>{money(costs.second.fee+costs.second.tax)}</strong><span>手續費 {money(costs.second.fee)}；稅 {money(costs.second.tax)}</span></div><div><small>合計建立費用</small><strong>{money(costs.totalFees)}</strong><span>含其他費用 {money(costs.totalFees-costs.first.fee-costs.first.tax-costs.second.fee-costs.second.tax)}</span></div><div><small>投入資金＋建立費用</small><strong>{money(costs.totalCapital)}</strong><span>股票以部位金額、期貨以原始保證金；放空擔保另計</span></div></div>:<p className="position-calculator-note" role="alert">請輸入有效的非負費率與費用。</p>}</div>{costs&&<PositionScenarioCalculator position={position} entry={costs} legs={[{instrument:firstInstrument,side:firstSide,isEtf:Boolean(pair[0].isEtf)},{instrument:secondInstrument,side:secondSide,isEtf:Boolean(pair[1].isEtf)}]} rates={{commissionPercent:Number(commission),stockSellTaxPercent:Number(sellTax),etfSellTaxPercent:Number(etfSellTax),futuresFee:Number(futuresFee),futuresTaxPercent:Number(futuresTax),otherFees:Number(otherFees)}} currentRatio={currentRatio} averageRatio={averageRatio}/>}<p className="position-calculator-note">可直接調整 A 數量、B 數量或目標投入資金比；調整 B 數量時計算實際比例，調整 A 數量時將 B 換算為最接近的整數；調整目標比例時，若固定 A 無法接近目標，也會調整 A 數量以尋找整數組合；股票／ETF 1 張為 1,000 股／單位。個股期原始保證金依期交所公布比例估算；ETF 期貨採期交所公告的每口原始保證金，契約調整、期貨市價與期貨商加收金額可能不同；只提供有官方契約與保證金資料的期貨選項。價格預設為現股收盤；選期貨時請輸入實際期貨價格。ETF 賣出稅率預設 0.1%，免稅債券 ETF 可調為 0%；賣空款項不可視為可動用資金；未計平倉費稅及持有期間費用。</p></>:<p className="position-calculator-note" role="alert">請檢查契約供應情況，以及正數價格、整數單位與目標比例。</p>}
 </section>;
}

import {useState} from 'react';
import type {calculateMixedEntryCosts,calculateMixedPosition} from '../lib/position-ratio';
import {calculatePositionScenarioForReturns,scenarioReturns,type ScenarioLeg,type ScenarioMode,type ScenarioRates} from '../lib/position-scenario';

type Position=NonNullable<ReturnType<typeof calculateMixedPosition>>;
type EntryCosts=NonNullable<ReturnType<typeof calculateMixedEntryCosts>>;
const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;
const valueClass=(value:number)=>value>0?'up':value<0?'down':'';

export function PositionScenarioCalculator({position,entry,legs,rates,currentRatio,averageRatio}:{position:Position;entry:EntryCosts;legs:[ScenarioLeg,ScenarioLeg];rates:ScenarioRates;currentRatio:number|null;averageRatio:number|null}){
 const [mode,setMode]=useState<ScenarioMode>('convergence');
 const [returns,setReturns]=useState<[number,number]>(()=>scenarioReturns('convergence',3,currentRatio,averageRatio)??[3,3]);
 const [holdingDays,setHoldingDays]=useState('1');
 const [ivChangePoints,setIvChangePoints]=useState('0');
 const ratioAvailable=currentRatio!==null&&averageRatio!==null&&currentRatio>0&&averageRatio>0&&currentRatio!==averageRatio;
 const effectiveMode=!ratioAvailable&&(mode==='convergence'||mode==='divergence')?'sync-up':mode;
 const scenarioRates={...rates,holdingDays:Number(holdingDays),ivChangePoints:Number(ivChangePoints)};
 const result=calculatePositionScenarioForReturns(position,entry,legs,scenarioRates,returns);
 const reverse=result?calculatePositionScenarioForReturns(position,entry,legs,scenarioRates,[-returns[0],-returns[1]]):null;
 const riskReward=result&&reverse&&result.totalNetProfit>0&&reverse.totalNetProfit<0?result.totalNetProfit/-reverse.totalNetProfit:null;
 const updateMode=(nextMode:ScenarioMode)=>{setMode(nextMode);const nextReturns=scenarioReturns(nextMode,3,currentRatio,averageRatio);if(nextReturns)setReturns(nextReturns)};
 return <div className="position-scenario">
  <h4>預估情境報酬</h4>
  <div className="position-scenario-inputs">
   <label>策略走勢<select value={effectiveMode} onChange={event=>updateMode(event.target.value as ScenarioMode)}><option value="convergence" disabled={!ratioAvailable}>股價比值收斂</option><option value="divergence" disabled={!ratioAvailable}>股價比值發散</option><option value="sync-up">同步上漲</option><option value="sync-down">同步下跌</option></select></label>
   <label>A 漲跌幅度（%）<input type="range" min="-99.9" max="1000" step="0.1" value={returns[0]*100} onChange={event=>setReturns([Number(event.target.value)/100,returns[1]])}/><output>{returns[0]>=0?'+':''}{(returns[0]*100).toFixed(1)}%</output></label>
   <label>B 漲跌幅度（%）<input type="range" min="-99.9" max="1000" step="0.1" value={returns[1]*100} onChange={event=>setReturns([returns[0],Number(event.target.value)/100])}/><output>{returns[1]>=0?'+':''}{(returns[1]*100).toFixed(1)}%</output></label>
   <div className="position-scenario-profit"><small>A 淨損益（自動計算）</small><strong className={result?valueClass(result.first.netProfit):''}>{result?money(result.first.netProfit):'—'}</strong></div>
   <div className="position-scenario-profit"><small>B 淨損益（自動計算）</small><strong className={result?valueClass(result.second.netProfit):''}>{result?money(result.second.netProfit):'—'}</strong></div>
   {legs.some(leg=>leg.instrument==='warrant')&&<><label>預計持有日數（供 Theta）<input type="number" min="0" max="3650" step="1" value={holdingDays} onChange={event=>setHoldingDays(event.target.value)}/></label><label>IV 變化（百分點，供 Vega）<input type="number" min="-100" max="100" step="0.1" value={ivChangePoints} onChange={event=>setIvChangePoints(event.target.value)}/></label></>}
  </div>
  {result?<><p className="position-calculator-note">預估 A 價格 {result.first.returnPercent>=0?'+':''}{result.first.returnPercent.toFixed(2)}%、B 價格 {result.second.returnPercent>=0?'+':''}{result.second.returnPercent.toFixed(2)}%；淨損益含建倉與平倉估計費稅。</p><div className="position-calculator-results position-scenario-results"><div><small>總淨報酬</small><strong className={valueClass(result.totalNetProfit)}>{money(result.totalNetProfit)}</strong><span>A {money(result.first.netProfit)}＋B {money(result.second.netProfit)}－其他費用 {money(rates.otherFees)}</span></div><div><small>投入報酬率</small><strong className={valueClass(result.returnOnCapitalPercent)}>{result.returnOnCapitalPercent.toFixed(2)}%</strong><span>總淨報酬 ÷ 投入資金及建倉費用</span></div><div><small>風險報酬比</small><strong>{riskReward===null?'—':`${riskReward.toFixed(2)} : 1`}</strong><span>同幅度反向情境的預估虧損作風險；無虧損時不計</span></div></div></>:<p className="position-calculator-note" role="alert">請輸入有效的情境幅度與費率。</p>}
  <p className="position-calculator-note">收斂／發散的百分比是 A／B 價格比值的變化，假設兩檔價格以相反方向對稱變動；同步模式假設兩檔各自同幅度漲跌。權證以 Delta、Gamma、Theta、Vega 做近似估算（忽略高階變化）；此處不預測實際走勢，原始保證金與部位資金不等於最大可能損失。</p>
 </div>;
}

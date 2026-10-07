import {useState} from 'react';
import type {calculateMixedEntryCosts,calculateMixedPosition,PositionInstrument,PositionSide} from '../lib/position-ratio';
import {calculatePositionScenario,percentForLegProfit,type ScenarioLeg,type ScenarioMode,type ScenarioRates} from '../lib/position-scenario';

type Position=NonNullable<ReturnType<typeof calculateMixedPosition>>;
type EntryCosts=NonNullable<ReturnType<typeof calculateMixedEntryCosts>>;
const money=(value:number)=>`${Math.round(value).toLocaleString('zh-TW')} 元`;
const valueClass=(value:number)=>value>0?'up':value<0?'down':'';
const opposite=(mode:ScenarioMode):ScenarioMode=>mode==='convergence'?'divergence':mode==='divergence'?'convergence':mode==='sync-up'?'sync-down':'sync-up';

export function PositionScenarioCalculator({position,entry,legs,rates,currentRatio,averageRatio}:{position:Position;entry:EntryCosts;legs:[ScenarioLeg,ScenarioLeg];rates:ScenarioRates;currentRatio:number|null;averageRatio:number|null}){
 const [mode,setMode]=useState<ScenarioMode>('convergence');
 const [percent,setPercent]=useState('3');
 const [editing,setEditing]=useState<{leg:'first'|'second';value:string}|null>(null);
 const [error,setError]=useState('');
 const ratioAvailable=currentRatio!==null&&averageRatio!==null&&currentRatio>0&&averageRatio>0&&currentRatio!==averageRatio;
 const effectiveMode=!ratioAvailable&&(mode==='convergence'||mode==='divergence')?'sync-up':mode;
 const evaluate=(value:number)=>calculatePositionScenario(position,entry,legs,rates,effectiveMode,value,currentRatio,averageRatio);
 const result=evaluate(Number(percent));
 const reverse=result?calculatePositionScenario(position,entry,legs,rates,opposite(effectiveMode),Number(percent),currentRatio,averageRatio):null;
 const riskReward=result&&reverse&&result.totalNetProfit>0&&reverse.totalNetProfit<0?result.totalNetProfit/-reverse.totalNetProfit:null;
 const editProfit=(leg:'first'|'second',value:string)=>{
  setEditing({leg,value});
  if(value.trim()===''){setError('');return;}
  const target=Number(value);
  const solved=percentForLegProfit(target,leg,evaluate,effectiveMode==='sync-up'?1000:99.9);
  if(solved===null){setError('此淨損益無法由目前情境方向與幅度達成。');return;}
  setPercent(String(Number(solved.toFixed(6))));
  setError('');
 };
 return <div className="position-scenario">
  <h4>預估情境報酬</h4>
  <div className="position-scenario-inputs">
   <label>策略走勢<select value={effectiveMode} onChange={event=>{setMode(event.target.value as ScenarioMode);setEditing(null);setError('')}}><option value="convergence" disabled={!ratioAvailable}>股價比值收斂</option><option value="divergence" disabled={!ratioAvailable}>股價比值發散</option><option value="sync-up">同步上漲</option><option value="sync-down">同步下跌</option></select></label>
   <label>預期變動（%）<input type="number" min="0" max={effectiveMode==='sync-up'?'1000':'99.9'} step="0.1" inputMode="decimal" value={percent} onChange={event=>{setPercent(event.target.value);setEditing(null);setError('')}}/></label>
   <label>A 淨損益（元）<input type="number" step="1" inputMode="decimal" value={editing?.leg==='first'?editing.value:result?String(Math.round(result.first.netProfit)):''} onChange={event=>editProfit('first',event.target.value)} onBlur={()=>setEditing(null)}/></label>
   <label>B 淨損益（元）<input type="number" step="1" inputMode="decimal" value={editing?.leg==='second'?editing.value:result?String(Math.round(result.second.netProfit)):''} onChange={event=>editProfit('second',event.target.value)} onBlur={()=>setEditing(null)}/></label>
  </div>
  {error&&<p className="position-calculator-note" role="alert">{error}</p>}
  {result?<><p className="position-calculator-note">預估 A 價格 {result.first.returnPercent>=0?'+':''}{result.first.returnPercent.toFixed(2)}%、B 價格 {result.second.returnPercent>=0?'+':''}{result.second.returnPercent.toFixed(2)}%；淨損益含建倉與平倉估計費稅。</p><div className="position-calculator-results position-scenario-results"><div><small>總淨報酬</small><strong className={valueClass(result.totalNetProfit)}>{money(result.totalNetProfit)}</strong><span>A {money(result.first.netProfit)}＋B {money(result.second.netProfit)}－其他費用 {money(rates.otherFees)}</span></div><div><small>投入報酬率</small><strong className={valueClass(result.returnOnCapitalPercent)}>{result.returnOnCapitalPercent.toFixed(2)}%</strong><span>總淨報酬 ÷ 投入資金及建倉費用</span></div><div><small>風險報酬比</small><strong>{riskReward===null?'—':`${riskReward.toFixed(2)} : 1`}</strong><span>同幅度反向情境的預估虧損作風險；無虧損時不計</span></div></div></>:<p className="position-calculator-note" role="alert">請輸入有效的情境幅度與費率。</p>}
  <p className="position-calculator-note">收斂／發散的百分比是 A／B 價格比值的變化，假設兩檔價格以相反方向對稱變動；同步模式假設兩檔各自同幅度漲跌。此處按目前選定的多空方向估算，不預測實際走勢；原始保證金與部位資金不等於最大可能損失。</p>
 </div>;
}

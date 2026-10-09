import type {PositionInstrument,PositionSide,WarrantTerms,calculateMixedPosition,calculateMixedEntryCosts} from './position-ratio';

export type ScenarioMode='convergence'|'divergence'|'sync-up'|'sync-down';
type Position=NonNullable<ReturnType<typeof calculateMixedPosition>>;
type EntryCosts=NonNullable<ReturnType<typeof calculateMixedEntryCosts>>;
export type ScenarioRates={commissionPercent:number;stockSellTaxPercent:number;etfSellTaxPercent:number;futuresFee:number;futuresTaxPercent:number;otherFees:number;warrantSellTaxPercent?:number;holdingDays?:number;ivChangePoints?:number};
export type ScenarioLeg={instrument:PositionInstrument;side:PositionSide;isEtf:boolean;warrant?:WarrantTerms;underlyingPrice?:number};

export function scenarioReturns(mode:ScenarioMode,percent:number,currentRatio:number|null,averageRatio:number|null):[number,number]|null{
 if(!Number.isFinite(percent)||percent<0||percent>1000)return null;
 if(mode==='sync-up'||mode==='sync-down'){
  if(mode==='sync-down'&&percent>=100)return null;
  const change=(mode==='sync-up'?1:-1)*percent/100;
  return [change,change];
 }
 if(currentRatio===null||averageRatio===null||!Number.isFinite(currentRatio)||!Number.isFinite(averageRatio)||currentRatio<=0||averageRatio<=0||currentRatio===averageRatio||percent>=100)return null;
 const ratioDirection=(currentRatio>averageRatio?-1:1)*(mode==='convergence'?1:-1);
 const multiplier=1+ratioDirection*percent/100;
 const firstChange=(multiplier-1)/(multiplier+1);
 return [firstChange,-firstChange];
}

export function calculatePositionScenario(position:Position,entry:EntryCosts,legs:[ScenarioLeg,ScenarioLeg],rates:ScenarioRates,mode:ScenarioMode,percent:number,currentRatio:number|null,averageRatio:number|null){
 const returns=scenarioReturns(mode,percent,currentRatio,averageRatio);
 if(!returns||[rates.commissionPercent,rates.stockSellTaxPercent,rates.etfSellTaxPercent,rates.futuresFee,rates.futuresTaxPercent,rates.otherFees,rates.warrantSellTaxPercent??.1,rates.holdingDays??0].some(value=>!Number.isFinite(value)||value<0)||!Number.isFinite(rates.ivChangePoints??0))return null;
 const calculateLeg=(notional:number,units:number,entryFee:number,entryTax:number,leg:ScenarioLeg,change:number)=>{
  const warrant=leg.warrant;
  const underlyingMove=(leg.underlyingPrice??0)*change;
  const warrantMove=warrant?warrant.exerciseRatio*(warrant.delta*underlyingMove+(warrant.gamma??0)*underlyingMove*underlyingMove/2+(warrant.theta??0)*(rates.holdingDays??0)+(warrant.vega??0)*(rates.ivChangePoints??0)):0;
  const exitNotional=warrant?(warrant.price+warrantMove)*1000*units:notional*(1+change);
  if(exitNotional<=0)return null;
  const exitFee=leg.instrument==='stock'||warrant?Math.round(exitNotional*rates.commissionPercent/100+1e-9):units*rates.futuresFee;
  const exitTax=Math.round(exitNotional*(warrant?(leg.side==='long'?(rates.warrantSellTaxPercent??.1):0):leg.instrument==='stock'?(leg.side==='long'?(leg.isEtf?rates.etfSellTaxPercent:rates.stockSellTaxPercent):0):rates.futuresTaxPercent)/100+1e-9);
  const grossProfit=warrant?(leg.side==='long'?1:-1)*warrantMove*1000*units:(leg.side==='long'?1:-1)*notional*change;
  return {returnPercent:change*100,netProfit:grossProfit-entryFee-entryTax-exitFee-exitTax,exitFee,exitTax};
 };
 const first=calculateLeg(position.firstNotional,position.firstUnits,entry.first.fee,entry.first.tax,legs[0],returns[0]);
 const second=calculateLeg(position.secondNotional,position.secondUnits,entry.second.fee,entry.second.tax,legs[1],returns[1]);
 if(!first||!second)return null;
 const totalNetProfit=first.netProfit+second.netProfit-rates.otherFees;
 return {first,second,totalNetProfit,returnOnCapitalPercent:totalNetProfit/entry.totalCapital*100};
}

export function percentForLegProfit(target:number,leg:'first'|'second',evaluate:(percent:number)=>ReturnType<typeof calculatePositionScenario>,maxPercent:number){
 if(!Number.isFinite(target))return null;
 const start=evaluate(0)?.[leg].netProfit;
 const end=evaluate(maxPercent)?.[leg].netProfit;
 if(start===undefined||end===undefined||target<Math.min(start,end)||target>Math.max(start,end))return null;
 let low=0,high=maxPercent;
 for(let i=0;i<48;i++){
  const mid=(low+high)/2;
  const value=evaluate(mid)?.[leg].netProfit;
  if(value===undefined)return null;
  if((value<target)===(start<end))low=mid;else high=mid;
 }
 return (low+high)/2;
}

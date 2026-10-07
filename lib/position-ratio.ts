export type PositionSide='long'|'short';
export type PositionInstrument='stock'|'standard'|'mini';
export type RatioStrategy='convergence'|'divergence';

export function ratioStrategySides(currentRatio:number|null,averageRatio:number|null,strategy:RatioStrategy):[PositionSide,PositionSide]|null{
 if(currentRatio===null||averageRatio===null||!Number.isFinite(currentRatio)||!Number.isFinite(averageRatio)||currentRatio<=0||averageRatio<=0||Math.abs(currentRatio-averageRatio)<1e-9)return null;
 const firstLong=strategy==='convergence'?currentRatio<averageRatio:currentRatio>averageRatio;
 return firstLong?['long','short']:['short','long'];
}

const contractShares=(instrument:PositionInstrument)=>instrument==='standard'?2000:instrument==='stock'?1000:100;

export function calculateMixedPosition(firstPrice:number,secondPrice:number,firstUnits:number,targetCapitalRatio:number,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstMarginPercent:number|null,secondMarginPercent:number|null,firstSide:PositionSide,secondSide:PositionSide,contracts?:{firstShares?:number;secondShares?:number;firstFixedMargin?:number;secondFixedMargin?:number},secondUnitsOverride?:number){
 if([firstPrice,secondPrice,targetCapitalRatio].some(value=>!Number.isFinite(value)||value<=0)||!Number.isSafeInteger(firstUnits)||firstUnits<1||firstUnits>1000000||targetCapitalRatio>1000000)return null;
 if(secondUnitsOverride!==undefined&&(!Number.isSafeInteger(secondUnitsOverride)||secondUnitsOverride<1||secondUnitsOverride>1000000))return null;
 if((firstInstrument!=='stock'&&(!firstMarginPercent||firstMarginPercent<=0)&&(!contracts?.firstFixedMargin||contracts.firstFixedMargin<=0))||(secondInstrument!=='stock'&&(!secondMarginPercent||secondMarginPercent<=0)&&(!contracts?.secondFixedMargin||contracts.secondFixedMargin<=0)))return null;
 const firstContractShares=contracts?.firstShares??contractShares(firstInstrument);
 const secondContractShares=contracts?.secondShares??contractShares(secondInstrument);
 if(!Number.isSafeInteger(firstContractShares)||firstContractShares<=0||!Number.isSafeInteger(secondContractShares)||secondContractShares<=0)return null;
 const firstUnitNotional=firstPrice*firstContractShares;
 const secondUnitNotional=secondPrice*secondContractShares;
 const firstUnitCapital=firstInstrument==='stock'?firstUnitNotional:contracts?.firstFixedMargin??Math.round(firstUnitNotional*firstMarginPercent!/100);
 const secondUnitCapital=secondInstrument==='stock'?secondUnitNotional:contracts?.secondFixedMargin??Math.round(secondUnitNotional*secondMarginPercent!/100);
 if(firstUnitCapital<=0||secondUnitCapital<=0)return null;
 const secondUnits=secondUnitsOverride??Math.max(1,Math.round(firstUnits*firstUnitCapital/(targetCapitalRatio*secondUnitCapital)));
 const firstNotional=firstUnits*firstUnitNotional;
 const secondNotional=secondUnits*secondUnitNotional;
 const firstCapital=firstUnits*firstUnitCapital;
 const secondCapital=secondUnits*secondUnitCapital;
 const netExposure=(firstSide==='long'?firstNotional:-firstNotional)+(secondSide==='long'?secondNotional:-secondNotional);
 return {firstUnits,secondUnits,firstShares:firstUnits*firstContractShares,secondShares:secondUnits*secondContractShares,firstNotional,secondNotional,firstCapital,secondCapital,capitalRatio:firstCapital/secondCapital,netExposure,netExposurePercent:netExposure/(firstNotional+secondNotional)*100};
}

export function firstUnitsForTarget(targetRatio:number,startingUnits:number,calculate:(firstUnits:number)=>ReturnType<typeof calculateMixedPosition>){
 if(!Number.isFinite(targetRatio)||targetRatio<=0||!Number.isSafeInteger(startingUnits)||startingUnits<1)return startingUnits;
 let best=calculate(startingUnits);
 if(!best)return startingUnits;
 let bestError=Math.abs(best.capitalRatio/targetRatio-1);
 if(bestError<=.01)return startingUnits;
 let bestUnits=startingUnits;
 for(let units=startingUnits+1;units<=Math.min(1000000,startingUnits+100);units++){
  const candidate=calculate(units);
  if(!candidate)break;
  const error=Math.abs(candidate.capitalRatio/targetRatio-1);
  if(error<bestError){best=candidate;bestError=error;bestUnits=units;}
  if(bestError<=.01)break;
 }
 return bestUnits;
}

export function calculateMixedEntryCosts(position:NonNullable<ReturnType<typeof calculateMixedPosition>>,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstSide:PositionSide,secondSide:PositionSide,stockCommissionPercent:number,stockSellTaxPercent:number,futuresFeePerContract:number,futuresTaxPercent:number,otherFees:number,firstIsEtf=false,secondIsEtf=false,etfSellTaxPercent=.1){
 if([stockCommissionPercent,stockSellTaxPercent,futuresFeePerContract,futuresTaxPercent,otherFees,etfSellTaxPercent].some(value=>!Number.isFinite(value)||value<0)||stockCommissionPercent>100||stockSellTaxPercent>100||futuresTaxPercent>100||etfSellTaxPercent>100)return null;
 const leg=(notional:number,units:number,instrument:PositionInstrument,side:PositionSide,isEtf:boolean)=>{
  const fee=instrument==='stock'?Math.round(notional*stockCommissionPercent/100+1e-9):units*futuresFeePerContract;
  const tax=Math.round(notional*(instrument==='stock'?(side==='short'?(isEtf?etfSellTaxPercent:stockSellTaxPercent):0):futuresTaxPercent)/100+1e-9);
  return {fee,tax,cashFlow:instrument==='stock'?(side==='long'?-notional-fee-tax:notional-fee-tax):-(fee+tax)};
 };
 const first=leg(position.firstNotional,position.firstUnits,firstInstrument,firstSide,firstIsEtf);
 const second=leg(position.secondNotional,position.secondUnits,secondInstrument,secondSide,secondIsEtf);
 return {first,second,totalFees:first.fee+first.tax+second.fee+second.tax+otherFees,totalCapital:position.firstCapital+position.secondCapital+first.fee+first.tax+second.fee+second.tax+otherFees,entryCashFlow:first.cashFlow+second.cashFlow-otherFees};
}

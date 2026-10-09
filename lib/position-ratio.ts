export type PositionSide='long'|'short';
export type PositionInstrument='stock'|'standard'|'mini'|'warrant';
export type PositionRatioBasis='capital'|'position';
export type RatioStrategy='convergence'|'divergence';
export type WarrantTerms={price:number;delta:number;exerciseRatio:number;theta?:number|null;gamma?:number|null;vega?:number|null;impliedVolatility?:number|null};

export function ratioStrategySides(currentRatio:number|null,averageRatio:number|null,strategy:RatioStrategy):[PositionSide,PositionSide]|null{
 if(currentRatio===null||averageRatio===null||!Number.isFinite(currentRatio)||!Number.isFinite(averageRatio)||currentRatio<=0||averageRatio<=0||Math.abs(currentRatio-averageRatio)<1e-9)return null;
 const firstLong=strategy==='convergence'?currentRatio<averageRatio:currentRatio>averageRatio;
 return firstLong?['long','short']:['short','long'];
}

export function warrantLotsForLinkedStockLots(stockLots:number,delta:number,exerciseRatio:number){
 if(!Number.isFinite(stockLots)||stockLots<=0||!Number.isFinite(delta)||delta===0||!Number.isFinite(exerciseRatio)||exerciseRatio<=0)return null;
 return Math.max(1,Math.round(stockLots/(Math.abs(delta)*exerciseRatio)));
}

const contractShares=(instrument:PositionInstrument)=>instrument==='standard'?2000:instrument==='stock'||instrument==='warrant'?1000:100;

export function calculateMixedPosition(firstPrice:number,secondPrice:number,firstUnits:number,targetCapitalRatio:number,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstMarginPercent:number|null,secondMarginPercent:number|null,firstSide:PositionSide,secondSide:PositionSide,contracts?:{firstShares?:number;secondShares?:number;firstFixedMargin?:number;secondFixedMargin?:number},secondUnitsOverride?:number,warrants?:{first?:WarrantTerms;second?:WarrantTerms},ratioBasis:PositionRatioBasis='capital'){
 if([firstPrice,secondPrice,targetCapitalRatio].some(value=>!Number.isFinite(value)||value<=0)||!Number.isSafeInteger(firstUnits)||firstUnits<1||firstUnits>1000000||targetCapitalRatio>1000000)return null;
 if(secondUnitsOverride!==undefined&&(!Number.isSafeInteger(secondUnitsOverride)||secondUnitsOverride<1||secondUnitsOverride>1000000))return null;
 if((firstInstrument!=='stock'&&firstInstrument!=='warrant'&&(!firstMarginPercent||firstMarginPercent<=0)&&(!contracts?.firstFixedMargin||contracts.firstFixedMargin<=0))||(secondInstrument!=='stock'&&secondInstrument!=='warrant'&&(!secondMarginPercent||secondMarginPercent<=0)&&(!contracts?.secondFixedMargin||contracts.secondFixedMargin<=0)))return null;
 const firstContractShares=contracts?.firstShares??contractShares(firstInstrument);
 const secondContractShares=contracts?.secondShares??contractShares(secondInstrument);
 const firstWarrant=firstInstrument==='warrant'?warrants?.first:null;
 const secondWarrant=secondInstrument==='warrant'?warrants?.second:null;
 if((firstInstrument==='warrant'&&(!firstWarrant||!Number.isFinite(firstWarrant.price)||firstWarrant.price<=0||!Number.isFinite(firstWarrant.delta)||firstWarrant.delta===0||Math.abs(firstWarrant.delta)>1||!Number.isFinite(firstWarrant.exerciseRatio)||firstWarrant.exerciseRatio<=0))||(secondInstrument==='warrant'&&(!secondWarrant||!Number.isFinite(secondWarrant.price)||secondWarrant.price<=0||!Number.isFinite(secondWarrant.delta)||secondWarrant.delta===0||Math.abs(secondWarrant.delta)>1||!Number.isFinite(secondWarrant.exerciseRatio)||secondWarrant.exerciseRatio<=0)))return null;
 if(!Number.isSafeInteger(firstContractShares)||firstContractShares<=0||!Number.isSafeInteger(secondContractShares)||secondContractShares<=0)return null;
 const firstUnitNotional=firstPrice*firstContractShares*(firstWarrant?Math.abs(firstWarrant.delta*firstWarrant.exerciseRatio):1);
 const secondUnitNotional=secondPrice*secondContractShares*(secondWarrant?Math.abs(secondWarrant.delta*secondWarrant.exerciseRatio):1);
 const firstUnitCapital=firstWarrant?firstWarrant.price*firstContractShares:firstInstrument==='stock'?firstUnitNotional:contracts?.firstFixedMargin??Math.round(firstUnitNotional*firstMarginPercent!/100);
 const secondUnitCapital=secondWarrant?secondWarrant.price*secondContractShares:secondInstrument==='stock'?secondUnitNotional:contracts?.secondFixedMargin??Math.round(secondUnitNotional*secondMarginPercent!/100);
 if(firstUnitCapital<=0||secondUnitCapital<=0)return null;
 const firstUnitRatioValue=ratioBasis==='position'?firstUnitNotional:firstUnitCapital;
 const secondUnitRatioValue=ratioBasis==='position'?secondUnitNotional:secondUnitCapital;
 const secondUnits=secondUnitsOverride??Math.max(1,Math.round(firstUnits*firstUnitRatioValue/(targetCapitalRatio*secondUnitRatioValue)));
 const firstNotional=firstUnits*firstUnitNotional;
 const secondNotional=secondUnits*secondUnitNotional;
 const firstCapital=firstUnits*firstUnitCapital;
 const secondCapital=secondUnits*secondUnitCapital;
 const firstDirectionalExposure=(firstSide==='long'?1:-1)*firstNotional*(firstWarrant?Math.sign(firstWarrant.delta):1);
 const secondDirectionalExposure=(secondSide==='long'?1:-1)*secondNotional*(secondWarrant?Math.sign(secondWarrant.delta):1);
 const netExposure=firstDirectionalExposure+secondDirectionalExposure;
 return {firstUnits,secondUnits,firstShares:firstUnits*firstContractShares*(firstWarrant?Math.abs(firstWarrant.delta*firstWarrant.exerciseRatio):1),secondShares:secondUnits*secondContractShares*(secondWarrant?Math.abs(secondWarrant.delta*secondWarrant.exerciseRatio):1),firstNotional,secondNotional,firstCapital,secondCapital,capitalRatio:firstCapital/secondCapital,positionSizeRatio:firstNotional/secondNotional,firstDirectionalExposure,secondDirectionalExposure,grossExposure:firstNotional+secondNotional,netExposure,netExposurePercent:netExposure/(firstNotional+secondNotional)*100};
}

export function firstUnitsForTarget(targetRatio:number,startingUnits:number,calculate:(firstUnits:number)=>ReturnType<typeof calculateMixedPosition>,basis:PositionRatioBasis='capital'){
 if(!Number.isFinite(targetRatio)||targetRatio<=0||!Number.isSafeInteger(startingUnits)||startingUnits<1)return startingUnits;
 let best=calculate(startingUnits);
 if(!best)return startingUnits;
 const ratio=(position:NonNullable<typeof best>)=>basis==='position'?position.positionSizeRatio:position.capitalRatio;
 let bestError=Math.abs(ratio(best)/targetRatio-1);
 if(bestError<=.01)return startingUnits;
 let bestUnits=startingUnits;
 for(let units=startingUnits+1;units<=Math.min(1000000,startingUnits+100);units++){
  const candidate=calculate(units);
  if(!candidate)break;
  const error=Math.abs(ratio(candidate)/targetRatio-1);
  if(error<bestError){best=candidate;bestError=error;bestUnits=units;}
  if(bestError<=.01)break;
 }
 return bestUnits;
}

export function positionLeverage(position:NonNullable<ReturnType<typeof calculateMixedPosition>>){
 const capital=position.firstCapital+position.secondCapital;
 if(capital<=0)return null;
 return {net:position.netExposure/capital,gross:position.grossExposure/capital};
}

export function calculateMixedEntryCosts(position:NonNullable<ReturnType<typeof calculateMixedPosition>>,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstSide:PositionSide,secondSide:PositionSide,stockCommissionPercent:number,stockSellTaxPercent:number,futuresFeePerContract:number,futuresTaxPercent:number,otherFees:number,firstIsEtf=false,secondIsEtf=false,etfSellTaxPercent=.1,warrants?:{first?:WarrantTerms;second?:WarrantTerms},warrantSellTaxPercent=.1){
 if([stockCommissionPercent,stockSellTaxPercent,futuresFeePerContract,futuresTaxPercent,otherFees,etfSellTaxPercent,warrantSellTaxPercent].some(value=>!Number.isFinite(value)||value<0)||stockCommissionPercent>100||stockSellTaxPercent>100||futuresTaxPercent>100||etfSellTaxPercent>100||warrantSellTaxPercent>100)return null;
 const leg=(notional:number,units:number,instrument:PositionInstrument,side:PositionSide,isEtf:boolean,warrant?:WarrantTerms)=>{
  const tradedValue=warrant?warrant.price*1000*units:notional;
  const fee=instrument==='stock'||warrant?Math.round(tradedValue*stockCommissionPercent/100+1e-9):units*futuresFeePerContract;
  const tax=Math.round(tradedValue*(warrant?(side==='short'?warrantSellTaxPercent:0):instrument==='stock'?(side==='short'?(isEtf?etfSellTaxPercent:stockSellTaxPercent):0):futuresTaxPercent)/100+1e-9);
  return {fee,tax,cashFlow:instrument==='stock'||warrant?(side==='long'?-tradedValue-fee-tax:tradedValue-fee-tax):-(fee+tax)};
 };
 const first=leg(position.firstNotional,position.firstUnits,firstInstrument,firstSide,firstIsEtf,warrants?.first);
 const second=leg(position.secondNotional,position.secondUnits,secondInstrument,secondSide,secondIsEtf,warrants?.second);
 return {first,second,totalFees:first.fee+first.tax+second.fee+second.tax+otherFees,totalCapital:position.firstCapital+position.secondCapital+first.fee+first.tax+second.fee+second.tax+otherFees,entryCashFlow:first.cashFlow+second.cashFlow-otherFees};
}

export type PositionSide='long'|'short';
export type PositionInstrument='stock'|'standard'|'mini';

const contractShares=(instrument:PositionInstrument)=>instrument==='standard'?2000:instrument==='stock'?1000:100;

export function calculateMixedPosition(firstPrice:number,secondPrice:number,firstUnits:number,targetCapitalRatio:number,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstMarginPercent:number|null,secondMarginPercent:number|null,firstSide:PositionSide,secondSide:PositionSide){
 if([firstPrice,secondPrice,targetCapitalRatio].some(value=>!Number.isFinite(value)||value<=0)||!Number.isSafeInteger(firstUnits)||firstUnits<1||firstUnits>1000000||targetCapitalRatio>100)return null;
 if((firstInstrument!=='stock'&&(!firstMarginPercent||firstMarginPercent<=0))||(secondInstrument!=='stock'&&(!secondMarginPercent||secondMarginPercent<=0)))return null;
 const firstUnitNotional=firstPrice*contractShares(firstInstrument);
 const secondUnitNotional=secondPrice*contractShares(secondInstrument);
 const firstUnitCapital=firstInstrument==='stock'?firstUnitNotional:Math.round(firstUnitNotional*firstMarginPercent!/100);
 const secondUnitCapital=secondInstrument==='stock'?secondUnitNotional:Math.round(secondUnitNotional*secondMarginPercent!/100);
 if(firstUnitCapital<=0||secondUnitCapital<=0)return null;
 const secondUnits=Math.max(1,Math.round(firstUnits*firstUnitCapital/(targetCapitalRatio*secondUnitCapital)));
 const firstNotional=firstUnits*firstUnitNotional;
 const secondNotional=secondUnits*secondUnitNotional;
 const firstCapital=firstUnits*firstUnitCapital;
 const secondCapital=secondUnits*secondUnitCapital;
 const netExposure=(firstSide==='long'?firstNotional:-firstNotional)+(secondSide==='long'?secondNotional:-secondNotional);
 return {firstUnits,secondUnits,firstShares:firstUnits*contractShares(firstInstrument),secondShares:secondUnits*contractShares(secondInstrument),firstNotional,secondNotional,firstCapital,secondCapital,capitalRatio:firstCapital/secondCapital,netExposure,netExposurePercent:netExposure/(firstNotional+secondNotional)*100};
}

export function calculateMixedEntryCosts(position:NonNullable<ReturnType<typeof calculateMixedPosition>>,firstInstrument:PositionInstrument,secondInstrument:PositionInstrument,firstSide:PositionSide,secondSide:PositionSide,stockCommissionPercent:number,stockSellTaxPercent:number,futuresFeePerContract:number,futuresTaxPercent:number,otherFees:number){
 if([stockCommissionPercent,stockSellTaxPercent,futuresFeePerContract,futuresTaxPercent,otherFees].some(value=>!Number.isFinite(value)||value<0)||stockCommissionPercent>100||stockSellTaxPercent>100||futuresTaxPercent>100)return null;
 const leg=(notional:number,units:number,instrument:PositionInstrument,side:PositionSide)=>{
  const fee=instrument==='stock'?Math.round(notional*stockCommissionPercent/100+1e-9):units*futuresFeePerContract;
  const tax=Math.round(notional*(instrument==='stock'?(side==='short'?stockSellTaxPercent:0):futuresTaxPercent)/100+1e-9);
  return {fee,tax,cashFlow:instrument==='stock'?(side==='long'?-notional-fee-tax:notional-fee-tax):-(fee+tax)};
 };
 const first=leg(position.firstNotional,position.firstUnits,firstInstrument,firstSide);
 const second=leg(position.secondNotional,position.secondUnits,secondInstrument,secondSide);
 return {first,second,totalFees:first.fee+first.tax+second.fee+second.tax+otherFees,totalCapital:position.firstCapital+position.secondCapital+first.fee+first.tax+second.fee+second.tax+otherFees,entryCashFlow:first.cashFlow+second.cashFlow-otherFees};
}

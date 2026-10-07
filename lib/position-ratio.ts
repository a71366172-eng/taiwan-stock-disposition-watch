export type PositionSide='long'|'short';

export function calculatePositionRatio(firstPrice:number,secondPrice:number,firstHundreds:number,targetCapitalRatio=1,firstSide:PositionSide='long',secondSide:PositionSide='short'){
 if(!Number.isFinite(firstPrice)||firstPrice<=0||!Number.isFinite(secondPrice)||secondPrice<=0||!Number.isSafeInteger(firstHundreds)||firstHundreds<1||firstHundreds>1000000||!Number.isFinite(targetCapitalRatio)||targetCapitalRatio<=0||targetCapitalRatio>100)return null;
 const firstShares=firstHundreds*100;
 const firstAmount=firstShares*firstPrice;
 const secondHundreds=Math.max(1,Math.round(firstAmount/(targetCapitalRatio*secondPrice*100)));
 const secondShares=secondHundreds*100;
 const secondAmount=secondShares*secondPrice;
 const grossAmount=firstAmount+secondAmount;
 const netExposure=(firstSide==='long'?firstAmount:-firstAmount)+(secondSide==='long'?secondAmount:-secondAmount);
 return {firstShares,secondShares,firstAmount,secondAmount,secondHundreds,capitalRatio:firstAmount/secondAmount,netExposure,netExposurePercent:netExposure/grossAmount*100,grossAmount};
}

export function calculateEntryCosts(firstAmount:number,secondAmount:number,firstSide:PositionSide,secondSide:PositionSide,commissionPercent:number,sellTaxPercent:number,otherFees:number){
 if([firstAmount,secondAmount,commissionPercent,sellTaxPercent,otherFees].some(value=>!Number.isFinite(value)||value<0)||firstAmount<=0||secondAmount<=0||commissionPercent>100||sellTaxPercent>100)return null;
 const firstCommission=Math.round(firstAmount*commissionPercent/100);
 const secondCommission=Math.round(secondAmount*commissionPercent/100);
 const firstTax=firstSide==='short'?Math.round(firstAmount*sellTaxPercent/100):0;
 const secondTax=secondSide==='short'?Math.round(secondAmount*sellTaxPercent/100):0;
 const totalFees=firstCommission+secondCommission+firstTax+secondTax+otherFees;
 const firstCashFlow=(firstSide==='long'?-firstAmount:firstAmount)-firstCommission-firstTax;
 const secondCashFlow=(secondSide==='long'?-secondAmount:secondAmount)-secondCommission-secondTax;
 return {firstCommission,secondCommission,firstTax,secondTax,otherFees,totalFees,firstCashFlow,secondCashFlow,entryCashFlow:firstCashFlow+secondCashFlow-otherFees,grossExposureWithFees:firstAmount+secondAmount+totalFees};
}

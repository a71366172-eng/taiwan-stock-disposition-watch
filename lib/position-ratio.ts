export function calculatePositionRatio(longPrice:number,shortPrice:number,longHundreds:number){
 if(!Number.isFinite(longPrice)||longPrice<=0||!Number.isFinite(shortPrice)||shortPrice<=0||!Number.isSafeInteger(longHundreds)||longHundreds<1||longHundreds>1000000)return null;
 const longShares=longHundreds*100;
 const longAmount=longShares*longPrice;
 const shortHundreds=Math.max(1,Math.round(longAmount/(shortPrice*100)));
 const shortShares=shortHundreds*100;
 const shortAmount=shortShares*shortPrice;
 return {longShares,shortShares,longAmount,shortAmount,shortHundreds,capitalRatio:longAmount/shortAmount,netExposure:longAmount-shortAmount,netExposurePercent:(longAmount-shortAmount)/(longAmount+shortAmount)*100};
}

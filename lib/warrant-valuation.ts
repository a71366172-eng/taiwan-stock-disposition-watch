export type WarrantValuationInput={
 spot:number;
 strike:number;
 expiry:string;
 valuationDate:string;
 riskFreeRatePercent:number;
 impliedVolatilityPercent:number;
 exerciseRatio:number;
 isCall:boolean;
 delta:number;
 warrantPrice:number;
};

export type WarrantValuation={
 theoreticalPrice:number;
 intrinsicValue:number;
 timeValue:number;
 thetaPerDay:number;
 gamma:number;
 vegaPerIvPoint:number;
 rhoPerRatePoint:number;
 costLeverage:number;
 effectiveLeverage:number;
};

const normalPdf=(x:number)=>Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
function normalCdf(x:number){
 const sign=x<0?-1:1;
 const z=Math.abs(x)/Math.sqrt(2);
 const t=1/(1+0.3275911*z);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-z*z);
 return 0.5*(1+sign*erf);
}

/** Black–Scholes estimates for a European-style warrant; rates and IV are entered in percent. */
export function calculateWarrantValuation(input:WarrantValuationInput):WarrantValuation|null{
 const {spot,strike,expiry,valuationDate,riskFreeRatePercent,impliedVolatilityPercent,exerciseRatio,warrantPrice,isCall,delta}=input;
 if(!Number.isFinite(spot)||spot<=0||!Number.isFinite(strike)||strike<=0||!Number.isFinite(exerciseRatio)||exerciseRatio<=0||!Number.isFinite(warrantPrice)||warrantPrice<=0||!Number.isFinite(delta)||delta===0||Math.abs(delta)>1||!Number.isFinite(riskFreeRatePercent)||!Number.isFinite(impliedVolatilityPercent)||impliedVolatilityPercent<=0||!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!/^\d{4}-\d{2}-\d{2}$/.test(valuationDate))return null;
 const expiryMs=Date.parse(`${expiry}T00:00:00Z`),valuationMs=Date.parse(`${valuationDate}T00:00:00Z`);
 const remainingDays=(expiryMs-valuationMs)/86400000;
 if(!Number.isFinite(remainingDays)||remainingDays<0)return null;
 const intrinsicPerShare=isCall?Math.max(spot-strike,0):Math.max(strike-spot,0);
 const intrinsicValue=intrinsicPerShare*exerciseRatio;
 const sigma=impliedVolatilityPercent/100,r=riskFreeRatePercent/100,T=remainingDays/365;
 if(T===0){const costLeverage=spot*exerciseRatio/warrantPrice;return {theoreticalPrice:intrinsicValue,intrinsicValue,timeValue:0,thetaPerDay:0,gamma:0,vegaPerIvPoint:0,rhoPerRatePoint:0,costLeverage,effectiveLeverage:costLeverage*Math.abs(delta)}}
 const sqrtT=Math.sqrt(T),d1=(Math.log(spot/strike)+(r+sigma*sigma/2)*T)/(sigma*sqrtT),d2=d1-sigma*sqrtT;
 const discount=Math.exp(-r*T),n1=normalPdf(d1);
 const unitPrice=isCall?spot*normalCdf(d1)-strike*discount*normalCdf(d2):strike*discount*normalCdf(-d2)-spot*normalCdf(-d1);
 const theoreticalPrice=unitPrice*exerciseRatio;
 const thetaAnnual=isCall?-(spot*n1*sigma)/(2*sqrtT)-r*strike*discount*normalCdf(d2):-(spot*n1*sigma)/(2*sqrtT)+r*strike*discount*normalCdf(-d2);
 const thetaPerDay=thetaAnnual/365*exerciseRatio;
 const gamma=n1/(spot*sigma*sqrtT)*exerciseRatio;
 const vegaPerIvPoint=spot*n1*sqrtT/100*exerciseRatio;
 const rhoPerRatePoint=(isCall?strike*T*discount*normalCdf(d2):-strike*T*discount*normalCdf(-d2))/100*exerciseRatio;
 const costLeverage=spot*exerciseRatio/warrantPrice;
 const effectiveLeverage=costLeverage*Math.abs(delta);
 const result={theoreticalPrice,intrinsicValue,timeValue:Math.max(0,theoreticalPrice-intrinsicValue),thetaPerDay,gamma,vegaPerIvPoint,rhoPerRatePoint,costLeverage,effectiveLeverage};
 return Object.values(result).every(Number.isFinite)?result:null;
}

import type {Stock} from './market-types';

export function isCurrentlyDisposed(stock:Stock,asOf:string){
  return stock.dispositions.some(item=>Boolean(item.start&&item.end&&item.start<=asOf&&item.end>=asOf));
}

export function wasNoticedDuringCurrentDisposition(stock:Stock,asOf:string){
  return stock.dispositions.some(item=>Boolean(item.start&&item.end&&item.start<=asOf&&item.end>=asOf&&stock.notices.some(notice=>notice.date>=item.start!&&notice.date<=asOf&&notice.rules.some(rule=>rule>=1&&rule<=8))));
}

export function isRiskWatchEligible(stock:Stock,asOf:string,hasForecast:boolean,is30DayObservation:boolean,include30DayObservation:boolean,onlyTreatedAndRenoticed:boolean){
  const active=isCurrentlyDisposed(stock,asOf),renoticed=wasNoticedDuringCurrentDisposition(stock,asOf);
  if(onlyTreatedAndRenoticed)return active&&renoticed&&hasForecast;
  if(active)return renoticed&&hasForecast;
  if(hasForecast)return true;
  return include30DayObservation&&is30DayObservation;
}

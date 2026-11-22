import type {Simulation,Stock} from './market-types';
import {legalPrices} from './rules.ts';

/** The caller checks next-session timing; every legal closing price must satisfy clause one. */
export function isGuaranteedDispositionNextSession(stock:Stock,simulation?:Simulation):boolean{
  if(!simulation||simulation.code!==stock.code)return false;
  const rule=simulation.rules.find(item=>item.rule===1);
  if(!rule?.intervals.length||rule.status!=='conditional')return false;
  const prices=legalPrices(simulation.reference);
  return prices.length>0&&prices.every(price=>rule.intervals.some(interval=>price>=interval.from&&price<=interval.to));
}

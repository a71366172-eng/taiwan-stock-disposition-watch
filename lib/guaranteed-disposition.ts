import type {Simulation,Stock} from './market-types';
import {legalPrices} from './rules.ts';

/**
 * Conservative next-session tag. An official accumulation candidate must also meet
 * the supported first-clause price threshold across every legal ±10% closing price.
 */
export function isGuaranteedDispositionNextSession(stock:Stock,simulation?:Simulation):boolean{
  if(!stock.candidateReason||!simulation)return false;
  const rule=simulation.rules.find(item=>item.rule===1);
  if(!rule?.intervals.length)return false;
  return legalPrices(simulation.reference).every(price=>rule.intervals.some(interval=>price>=interval.from&&price<=interval.to));
}

import type {Simulation,Stock} from './market-types';

/**
 * Marks a next-session disposition forecast when the first-clause price condition
 * is met at the simulation's reference close. The caller separately checks that
 * the disposition accumulation path reaches its threshold on the next session.
 */
export function isGuaranteedDispositionNextSession(stock:Stock,simulation?:Simulation):boolean{
  if(!simulation||simulation.code!==stock.code)return false;
  const rule=simulation.rules.find(item=>item.rule===1);
  if(!rule?.intervals.length)return false;
  return rule.intervals.some(interval=>simulation.reference>=interval.from&&simulation.reference<=interval.to);
}

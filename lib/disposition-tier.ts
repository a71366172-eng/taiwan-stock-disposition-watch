import type {MarketSnapshot,Stock} from './market-types';

export type DispositionTier='first'|'repeat';

/** Estimate next disposition tier from prior announcements in 30 known sessions. */
export function dispositionTier(stock:Stock,calendar:MarketSnapshot['calendar'],asOf:string):DispositionTier{
  const sessions=calendar.filter(date=>date<=asOf);
  const windowStart=sessions.at(-30);
  if(!windowStart)return 'first';
  return stock.dispositions.some(item=>item.announced>=windowStart&&item.announced<=asOf)?'repeat':'first';
}

export const dispositionTierLabel:Record<DispositionTier,string>={first:'首次處置',repeat:'再次處置'};

import type {MarketSnapshot,Stock} from './market-types';

export type DispositionTier='first'|'repeat';

/** Estimate the next disposition tier only while the stock is currently under treatment. */
export function dispositionTier(stock:Stock,calendar:MarketSnapshot['calendar'],asOf:string):DispositionTier{
  const currentlyDisposed=stock.dispositions.some(item=>Boolean(item.start&&item.end&&item.start<=asOf&&item.end>=asOf));
  if(!currentlyDisposed)return 'first';
  const sessions=calendar.filter(date=>date<=asOf);
  const windowStart=sessions.at(-30);
  if(!windowStart)return 'first';
  return stock.dispositions.some(item=>item.announced>=windowStart&&item.announced<=asOf)?'repeat':'first';
}

export const dispositionTierLabel:Record<DispositionTier,string>={first:'首次處置',repeat:'再次處置'};

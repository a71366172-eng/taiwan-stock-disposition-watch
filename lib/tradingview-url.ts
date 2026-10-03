/** Centralized TradingView URL builder so a changed chart route is easy to update. */
export function tradingViewUrl(market: 'TWSE' | 'TPEX', code: string): string {
  const url = new URL('https://tw.tradingview.com/chart/JMV15wTL/');
  url.searchParams.set('symbol', `${market}:${code}`);
  return url.toString();
}

/** Centralized TradingView URL builder so a changed chart route is easy to update. */
export function tradingViewUrl(market: 'TWSE' | 'TPEX', code: string): string {
  const url = new URL('https://tw.tradingview.com/chart/');
  url.searchParams.set('symbol', `${market}:${code}`);
  url.searchParams.set('interval', '1D');
  return url.toString();
}

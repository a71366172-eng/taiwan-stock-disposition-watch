const officialHosts = new Set(['www.twse.com.tw', 'openapi.twse.com.tw', 'www.tpex.org.tw', 'mopsfin.twse.com.tw']);
const publicQueryKeys = new Set(['cate', 'code', 'd', 'date', 'endDate', 'id', 'l', 'o', 'order', 'response', 's', 'se', 'selectType', 'startDate', 'stockNo', 't', 'type']);

export function publicSourceUrl(value:string):string|null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !officialHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    if ([...url.searchParams.keys()].some(key => !publicQueryKeys.has(key))) return null;
    return url.href;
  } catch {
    return null;
  }
}

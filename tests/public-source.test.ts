import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicSourceUrl} from '../lib/public-source.ts';

test('published official source links stay available', () => {
  assert.equal(publicSourceUrl('https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20261001&stockNo=2330'), 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20261001&stockNo=2330');
  assert.equal(publicSourceUrl('https://www.tpex.org.tw/www/zh-tw/bulletin/attention?cate=&code=6538&endDate=20261002&order=date&response=json&startDate=20260619&type=code'), 'https://www.tpex.org.tw/www/zh-tw/bulletin/attention?cate=&code=6538&endDate=20261002&order=date&response=json&startDate=20260619&type=code');
  assert.equal(publicSourceUrl('https://isin.twse.com.tw/isin/C_public.jsp?strMode=3'), 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=3');
});

test('source links reject credentials, unexpected parameters, and unapproved hosts', () => {
  assert.equal(publicSourceUrl('https://www.twse.com.tw/data?api_key=private'), null);
  assert.equal(publicSourceUrl('https://user:password@www.twse.com.tw/data'), null);
  assert.equal(publicSourceUrl('javascript:alert(1)'), null);
  assert.equal(publicSourceUrl('https://example.com/data'), null);
});

test('all published source links remain visible after applying the allowlist', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../public/data/market.json', import.meta.url), 'utf8')) as {sources:{url:string}[]};
  assert.ok(snapshot.sources.length > 0);
  assert.ok(snapshot.sources.every(source => publicSourceUrl(source.url) !== null));
});

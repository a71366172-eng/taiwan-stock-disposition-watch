import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonCodeFromInput,eligibleComparisonCode,isEtfCategory,recentComparisonSymbols} from '../lib/comparison-symbols.ts';

test('Taiwan listed and OTC ETF codes, including leading zero and letter suffixes, are eligible',()=>{
 assert.equal(eligibleComparisonCode('0050','ETF'),true);
 assert.equal(eligibleComparisonCode('006208','ETF'),true);
 assert.equal(eligibleComparisonCode('00687B','上櫃ETF'),true);
 assert.equal(eligibleComparisonCode('2330','半導體業'),true);
 assert.equal(eligibleComparisonCode('006208','權證'),false);
 assert.equal(isEtfCategory('上櫃ETF'),true);
 assert.equal(comparisonCodeFromInput('00687b 國泰20年美債'),'00687B');
 assert.equal(comparisonCodeFromInput(' 0050 元大台灣50'),'0050');
});

test('recently suspended stocks stay selectable while stale listings are excluded',()=>{
 const symbols=recentComparisonSymbols([
  {stock_id:'2330',stock_name:'台積電',type:'twse',date:'2026-10-08',industry_category:'半導體業'},
  {stock_id:'6173',stock_name:'信昌電',type:'tpex',date:'2026-10-07',industry_category:'電子零組件業'},
  {stock_id:'9999',stock_name:'舊資料',type:'twse',date:'2026-08-01',industry_category:'其他'},
 ]);
 assert.deepEqual(symbols.map(symbol=>symbol.code),['2330','6173']);
});

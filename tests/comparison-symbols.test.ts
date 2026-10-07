import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonCodeFromInput,eligibleComparisonCode,isEtfCategory} from '../lib/comparison-symbols.ts';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePositionRatio} from '../lib/position-ratio.ts';

test('rounds hedge quantity to whole 100-share units and reports actual capital imbalance',()=>{
 const result=calculatePositionRatio(250,75,3)!;
 assert.equal(result.longShares,300);
 assert.equal(result.shortShares,1000);
 assert.equal(result.longAmount,75000);
 assert.equal(result.shortAmount,75000);
 assert.equal(result.capitalRatio,1);
 assert.equal(result.netExposure,0);
});

test('keeps a minimum one-unit short and rejects invalid inputs',()=>{
 const result=calculatePositionRatio(10,1000,1)!;
 assert.equal(result.shortShares,100);
 assert.equal(result.netExposure,-99000);
 assert.equal(calculatePositionRatio(10,1000,1.5),null);
 assert.equal(calculatePositionRatio(0,1000,1),null);
});

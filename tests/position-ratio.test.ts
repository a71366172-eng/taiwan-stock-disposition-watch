import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMixedEntryCosts,calculateMixedPosition} from '../lib/position-ratio.ts';

test('stock units are whole 1,000-share lots and B is rounded to whole lots',()=>{
 const result=calculateMixedPosition(250,75,1,1,'stock','stock',null,null,'long','short')!;
 assert.equal(result.firstShares,1000);
 assert.equal(result.secondUnits,3);
 assert.equal(result.secondShares,3000);
 assert.equal(result.firstCapital,250000);
 assert.equal(result.secondCapital,225000);
 assert.equal(result.capitalRatio,250000/225000);
 assert.equal(result.netExposure,25000);
});

test('target ratios and independent directions use the actual rounded position size',()=>{
 const bothLong=calculateMixedPosition(250,75,1,1.5,'stock','stock',null,null,'long','long')!;
 assert.equal(bothLong.secondUnits,2);
 assert.equal(bothLong.netExposure,400000);
 const bothShort=calculateMixedPosition(250,75,1,1.5,'stock','stock',null,null,'short','short')!;
 assert.equal(bothShort.netExposure,-400000);
 assert.equal(calculateMixedPosition(250,75,1.5,1,'stock','stock',null,null,'long','short'),null);
 assert.equal(calculateMixedPosition(250,75,1,0,'stock','stock',null,null,'long','short'),null);
});

test('stock and standard futures target ratio uses one stock lot versus original margin',()=>{
 const position=calculateMixedPosition(100,100,2,1,'stock','standard',null,13.5,'long','short')!;
 assert.equal(position.firstShares,2000);
 assert.equal(position.firstCapital,200000);
 assert.equal(position.secondUnits,7);
 assert.equal(position.secondCapital,189000);
 assert.equal(position.secondNotional,1400000);
 assert.equal(position.netExposure,-1200000);
 const costs=calculateMixedEntryCosts(position,'stock','standard','long','short',.1425,.3,30,.002,0)!;
 assert.equal(costs.first.fee,285);
 assert.equal(costs.second.fee,210);
 assert.equal(costs.second.tax,28);
 assert.equal(costs.totalCapital,389523);
});

test('mini futures use 100 shares per contract and original margin on both sides',()=>{
 const position=calculateMixedPosition(200,100,10,1,'mini','mini',13.5,16.2,'long','long')!;
 assert.equal(position.firstCapital,27000);
 assert.equal(position.secondUnits,17);
 assert.equal(position.secondCapital,27540);
 assert.equal(position.secondShares,1700);
 assert.equal(calculateMixedPosition(200,100,10,1,'mini','mini',null,16.2,'long','long'),null);
});

test('stock short sale tax applies only to the short side',()=>{
 const position=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','short')!;
 const costs=calculateMixedEntryCosts(position,'stock','stock','long','short',.1425,.3,0,.002,100)!;
 assert.equal(costs.first.fee,143);
 assert.equal(costs.first.tax,0);
 assert.equal(costs.second.tax,300);
 assert.equal(costs.totalFees,686);
 assert.equal(calculateMixedEntryCosts(position,'stock','stock','long','long',.1425,.3,0,.002,0)?.second.tax,0);
});

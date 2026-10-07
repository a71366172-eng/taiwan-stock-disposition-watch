import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEntryCosts,calculateMixedEntryCosts,calculateMixedPosition,calculatePositionRatio} from '../lib/position-ratio.ts';

test('rounds B quantity to whole 100-share units and reports actual capital ratio',()=>{
 const result=calculatePositionRatio(250,75,3)!;
 assert.equal(result.firstShares,300);
 assert.equal(result.secondShares,1000);
 assert.equal(result.firstAmount,75000);
 assert.equal(result.secondAmount,75000);
 assert.equal(result.capitalRatio,1);
 assert.equal(result.netExposure,0);
});

test('keeps a minimum one-unit B position and rejects invalid inputs',()=>{
 const result=calculatePositionRatio(10,1000,1)!;
 assert.equal(result.secondShares,100);
 assert.equal(result.netExposure,-99000);
 assert.equal(calculatePositionRatio(10,1000,1.5),null);
 assert.equal(calculatePositionRatio(0,1000,1),null);
 assert.equal(calculatePositionRatio(10,1000,1,0),null);
});

test('custom long-to-short capital target rounds the short leg and exposes actual ratio',()=>{
 const result=calculatePositionRatio(250,75,3,1.5)!;
 assert.equal(result.secondShares,700);
 assert.equal(result.capitalRatio,75000/52500);
 assert.equal(result.netExposure,22500);
 assert.equal(calculatePositionRatio(250,75,3,1.5,'long','long')?.netExposure,127500);
 assert.equal(calculatePositionRatio(250,75,3,1.5,'short','short')?.netExposure,-127500);
});

test('entry costs include buy and short-sale commissions, sale tax and custom fees',()=>{
 const costs=calculateEntryCosts(75000,75000,'long','short',.1425,.3,100)!;
 assert.deepEqual(costs,{firstCommission:107,secondCommission:107,firstTax:0,secondTax:225,otherFees:100,totalFees:539,firstCashFlow:-75107,secondCashFlow:74668,entryCashFlow:-539,grossExposureWithFees:150539});
 assert.equal(calculateEntryCosts(75000,75000,'long','long',.1425,.3,0)?.secondTax,0);
 assert.equal(calculateEntryCosts(75000,75000,'long','short',-1,.3,0),null);
});

test('stock and standard futures target ratio uses stock outlay versus original margin',()=>{
 const position=calculateMixedPosition(100,100,20,1,'stock','standard',null,13.5,'long','short')!;
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

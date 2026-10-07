import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEntryCosts,calculatePositionRatio} from '../lib/position-ratio.ts';

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

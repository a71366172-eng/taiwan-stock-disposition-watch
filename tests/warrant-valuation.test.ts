import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateWarrantValuation} from '../lib/warrant-valuation.ts';

const base={spot:100,strike:100,expiry:'2027-01-01',valuationDate:'2026-01-01',riskFreeRatePercent:5,impliedVolatilityPercent:20,exerciseRatio:1,isCall:true,delta:.55,warrantPrice:10};

test('Black–Scholes produces finite call valuation, Greeks and leverage',()=>{
 const result=calculateWarrantValuation(base);
 assert.ok(result);
 assert.ok(Math.abs(result.theoreticalPrice-10.45)<.1);
 assert.equal(result.intrinsicValue,0);
 assert.equal(result.timeValue,result.theoreticalPrice);
 assert.ok(result.thetaPerDay<0);
 assert.ok(result.gamma>0);
 assert.ok(result.vegaPerIvPoint>0);
 assert.ok(result.rhoPerRatePoint>0);
 assert.equal(result.effectiveLeverage,result.costLeverage*.55);
});

test('put rho is negative, intrinsic value is scaled by exercise ratio',()=>{
 const result=calculateWarrantValuation({...base,spot:90,strike:100,exerciseRatio:.1,isCall:false,delta:-.6});
 assert.ok(result);
 assert.equal(result.intrinsicValue,1);
 assert.ok(result.rhoPerRatePoint<0);
 assert.equal(result.effectiveLeverage,result.costLeverage*.6);
});

test('missing inputs and expiry before valuation date return null',()=>{
 assert.equal(calculateWarrantValuation({...base,strike:0}),null);
 assert.equal(calculateWarrantValuation({...base,expiry:'2025-12-31'}),null);
 assert.equal(calculateWarrantValuation({...base,impliedVolatilityPercent:0}),null);
});

test('expiry date returns intrinsic value and zero time decay Greeks',()=>{
 const result=calculateWarrantValuation({...base,spot:110,strike:100,expiry:'2026-01-01'});
 assert.ok(result);
 assert.equal(result.theoreticalPrice,10);
 assert.equal(result.intrinsicValue,10);
 assert.equal(result.timeValue,0);
 assert.equal(result.thetaPerDay,0);
 assert.equal(result.gamma,0);
});

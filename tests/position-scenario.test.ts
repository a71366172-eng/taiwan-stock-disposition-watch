import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMixedEntryCosts,calculateMixedPosition} from '../lib/position-ratio.ts';
import {calculatePositionScenario,percentForLegProfit,scenarioReturns} from '../lib/position-scenario.ts';

const position=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','short')!;
const entry=calculateMixedEntryCosts(position,'stock','stock','long','short',.1425,.3,18,.002,0)!;
const legs=[{instrument:'stock' as const,side:'long' as const,isEtf:false},{instrument:'stock' as const,side:'short' as const,isEtf:false}];
const rates={commissionPercent:.1425,stockSellTaxPercent:.3,etfSellTaxPercent:.1,futuresFee:18,futuresTaxPercent:.002,otherFees:0};

test('synchronized rise applies both price returns but respects opposite position directions',()=>{
 const result=calculatePositionScenario(position,entry,legs,rates,'sync-up',5,1.2,1)!;
 assert.equal(result.first.returnPercent,5);
 assert.equal(result.second.returnPercent,5);
 assert.ok(result.first.netProfit>0);
 assert.ok(result.second.netProfit<0);
 assert.ok(result.totalNetProfit<result.first.netProfit+result.second.netProfit+1);
});

test('convergence changes A/B ratio by the requested percentage',()=>{
 const returns=scenarioReturns('convergence',3,1.2,1)!;
 assert.ok(returns[0]<0&&returns[1]>0);
 assert.ok(Math.abs((1+returns[0])/(1+returns[1])-.97)<1e-12);
 assert.equal(scenarioReturns('convergence',3,null,1),null);
});

test('editing A or B net profit solves the shared scenario percentage',()=>{
 const evaluate=(percent:number)=>calculatePositionScenario(position,entry,legs,rates,'sync-up',percent,1.2,1);
 const target=evaluate(5)!;
 for(const leg of ['first','second'] as const){
  const solved=percentForLegProfit(target[leg].netProfit,leg,evaluate,1000)!;
  assert.ok(Math.abs(solved-5)<.001);
  assert.ok(Math.abs(evaluate(solved)![leg].netProfit-target[leg].netProfit)<1);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMixedEntryCosts,calculateMixedPosition} from '../lib/position-ratio.ts';
import {calculatePositionScenario,percentForLegProfit,scenarioReturns,type ScenarioLeg} from '../lib/position-scenario.ts';

const position=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','short')!;
const entry=calculateMixedEntryCosts(position,'stock','stock','long','short',.1425,.3,18,.002,0)!;
const legs:[ScenarioLeg,ScenarioLeg]=[{instrument:'stock',side:'long',isEtf:false},{instrument:'stock',side:'short',isEtf:false}];
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

test('warrant scenario applies Delta, Gamma, Theta and Vega to option premium',()=>{
 const terms={price:20,delta:.5,exerciseRatio:.1,gamma:.02,theta:-.1,vega:.3,impliedVolatility:35};
 const warrantPosition=calculateMixedPosition(100,100,1,1,'warrant','stock',null,null,'long','short',undefined,1,{first:terms})!;
 const warrantEntry=calculateMixedEntryCosts(warrantPosition,'warrant','stock','long','short',0,.3,18,.002,0,false,false,.1,{first:terms})!;
 const warrantLegs:[ScenarioLeg,ScenarioLeg]=[{instrument:'warrant',side:'long',isEtf:false,warrant:terms,underlyingPrice:100},legs[1]];
 const result=calculatePositionScenario(warrantPosition,warrantEntry,warrantLegs,{...rates,commissionPercent:0,holdingDays:2,ivChangePoints:5},'sync-up',10,1.2,1)!;
 assert.equal(result.first.netProfit,709);
});

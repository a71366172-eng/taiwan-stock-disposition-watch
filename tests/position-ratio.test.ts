import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMixedEntryCosts,calculateMixedPosition,firstUnitsForTarget,positionLeverage,ratioStrategySides,warrantLotsForLinkedStockLots} from '../lib/position-ratio.ts';

test('ratio convergence and divergence presets switch A/B directions around the average',()=>{
 assert.deepEqual(ratioStrategySides(1.2,1,'convergence'),['short','long']);
 assert.deepEqual(ratioStrategySides(.8,1,'convergence'),['long','short']);
 assert.deepEqual(ratioStrategySides(1.2,1,'divergence'),['long','short']);
 assert.deepEqual(ratioStrategySides(.8,1,'divergence'),['short','long']);
 assert.equal(ratioStrategySides(1,1,'convergence'),null);
 assert.equal(ratioStrategySides(null,1,'divergence'),null);
});

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

test('direct B quantity overrides rounding and reports the actual capital ratio',()=>{
 const position=calculateMixedPosition(250,75,1,1,'stock','stock',null,null,'long','short',undefined,5)!;
 assert.equal(position.secondUnits,5);
 assert.equal(position.capitalRatio,250000/375000);
 assert.equal(calculateMixedPosition(250,75,1,1,'stock','stock',null,null,'long','short',undefined,0),null);
 assert.equal(calculateMixedPosition(250,75,1,1,'stock','stock',null,null,'long','short',undefined,1.5),null);
});

test('capital leverage preserves the sign of directional exposure',()=>{
 const long=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','long')!;
 const short=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'short','short')!;
 const hedged=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','short')!;
 assert.equal(positionLeverage(long)?.net,1);
 assert.equal(positionLeverage(short)?.net,-1);
 assert.equal(positionLeverage(hedged)?.net,0);
 assert.equal(positionLeverage(hedged)?.gross,1);
});

test('changing a target ratio can adjust both whole-lot quantities',()=>{
 const target=1.1;
 const calculate=(units:number)=>calculateMixedPosition(100,100,units,target,'stock','stock',null,null,'long','short');
 assert.equal(calculate(1)?.secondUnits,1);
 const firstUnits=firstUnitsForTarget(target,1,calculate);
 assert.ok(firstUnits>1);
 const position=calculate(firstUnits)!;
 assert.ok(Math.abs(position.capitalRatio/target-1)<=.01);
 assert.notEqual(position.secondUnits,1);
 assert.equal(firstUnitsForTarget(1,1,units=>calculateMixedPosition(100,100,units,1,'stock','stock',null,null,'long','short')),1);
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

test('ETF futures use published fixed original margin and 10,000/1,000-unit contract sizes',()=>{
 const position=calculateMixedPosition(50,50,1,1,'standard','mini',null,null,'long','short',{firstShares:10000,secondShares:1000,firstFixedMargin:87000,secondFixedMargin:8700})!;
 assert.equal(position.firstShares,10000);
 assert.equal(position.secondUnits,10);
 assert.equal(position.secondShares,10000);
 assert.equal(position.firstCapital,87000);
 assert.equal(position.secondCapital,87000);
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

test('ETF sale uses its own tax rate and can be set to zero for an exempt fund',()=>{
 const position=calculateMixedPosition(100,100,1,1,'stock','stock',null,null,'long','short')!;
 const etf=calculateMixedEntryCosts(position,'stock','stock','long','short',.1425,.3,0,.002,0,false,true,.1)!;
 assert.equal(etf.second.tax,100);
 const exempt=calculateMixedEntryCosts(position,'stock','stock','long','short',.1425,.3,0,.002,0,false,true,0)!;
 assert.equal(exempt.second.tax,0);
});

test('warrant delta converts one warrant lot to equivalent shares while capital uses premium paid',()=>{
 const terms={price:20,delta:.5,exerciseRatio:.1};
 const position=calculateMixedPosition(100,100,1,1,'warrant','stock',null,null,'long','short',undefined,1,{first:terms})!;
 assert.equal(position.firstShares,50);
 assert.equal(position.firstNotional,5000);
 assert.equal(position.firstCapital,20000);
 const costs=calculateMixedEntryCosts(position,'warrant','stock','long','short',.1425,.3,18,.002,0,false,false,.1,{first:terms})!;
 assert.equal(costs.first.fee,29);
 assert.equal(costs.first.tax,0);
 const shortCosts=calculateMixedEntryCosts(position,'warrant','stock','short','short',.1425,.3,18,.002,0,false,false,.1,{first:terms})!;
 assert.equal(shortCosts.first.tax,20);
 assert.equal(warrantLotsForLinkedStockLots(1,.5,.1),20);
 assert.equal(warrantLotsForLinkedStockLots(2,-.5,.1),40);
 assert.equal(warrantLotsForLinkedStockLots(1,0,.1),null);
});

test('warrant directional exposure follows both position side and signed call/put delta',()=>{
 const cases=[
  {side:'long' as const,delta:.5,exposure:5000,net:-95000},
  {side:'short' as const,delta:.5,exposure:-5000,net:-105000},
  {side:'long' as const,delta:-.5,exposure:-5000,net:-105000},
  {side:'short' as const,delta:-.5,exposure:5000,net:-95000},
 ];
 for(const scenario of cases){
  const position=calculateMixedPosition(100,100,1,1,'warrant','stock',null,null,scenario.side,'short',undefined,1,{first:{price:20,delta:scenario.delta,exerciseRatio:.1}})!;
  assert.equal(position.firstDirectionalExposure,scenario.exposure);
  assert.equal(position.secondDirectionalExposure,-100000);
  assert.equal(position.netExposure,scenario.net);
  assert.equal(position.grossExposure,105000);
  assert.equal(position.netExposurePercent,scenario.net/105000*100);
  assert.equal(positionLeverage(position)?.net,scenario.net/120000);
  assert.equal(positionLeverage(position)?.gross,105000/120000);
 }
});

test('position-size ratio targets delta-adjusted notional independently from invested capital',()=>{
 const calculate=(units:number)=>calculateMixedPosition(100,100,units,1,'stock','standard',null,13.5,'long','short',undefined,undefined,undefined,'position');
 const position=calculate(2)!;
 assert.equal(position.secondUnits,1);
 assert.equal(position.positionSizeRatio,1);
 assert.equal(position.capitalRatio,200000/27000);
 const firstUnits=firstUnitsForTarget(1,1,calculate,'position');
 assert.equal(firstUnits,2);
 assert.equal(calculateMixedPosition(100,100,2,1,'stock','standard',null,13.5,'long','short')?.secondUnits,7);
});

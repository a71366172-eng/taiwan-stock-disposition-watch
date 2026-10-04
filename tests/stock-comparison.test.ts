import assert from 'node:assert/strict';
import test from 'node:test';
import {compareStocks,type ComparisonStock} from '../lib/stock-comparison.ts';

const stock=(code:string,closes:number[]):ComparisonStock=>({code,name:code,market:'TWSE',bars:closes.map((close,index)=>({date:`2026-09-${String(index+1).padStart(2,'0')}`,close}))});

test('price ratio averages the latest 30 daily A/B ratios, excluding return baseline',()=>{
  const a=stock('1111',[999,...Array.from({length:30},(_,i)=>i%2?9:2)]);
  const b=stock('2222',[1,...Array.from({length:30},(_,i)=>i%2?3:1)]);
  const result=compareStocks(a,b);
  assert.equal(result.averagePriceRatio,2.5);
  assert.equal(result.currentPriceRatio,3);
  assert.equal(result.priceRatioSessionCount,30);
  assert.equal(result.priceRatioDate,a.bars.at(-1)!.date);
  assert.notEqual(result.averagePriceRatio,5.5/2);
});

test('price ratios align dates and exclude zero or invalid closes without inventing a 30-day mean',()=>{
  const a=stock('1111',[10,20,30,40]);
  const b=stock('2222',[2,0,NaN]);
  const result=compareStocks(a,b);
  assert.equal(result.averagePriceRatio,null);
  assert.equal(result.currentPriceRatio,5);
  assert.equal(result.priceRatioDate,a.bars[0].date);
  assert.equal(result.priceRatioSessionCount,1);
  const empty=compareStocks(a,stock('3333',[]));
  assert.equal(empty.currentPriceRatio,null);
  assert.equal(empty.priceRatioDate,null);
});

test('comparison aligns common dates and uses daily returns, not just cumulative gain',()=>{
  const first=stock('1111',Array.from({length:31},(_,index)=>100+index));
  const second=stock('2222',Array.from({length:31},(_,index)=>200+index*2));
  const result=compareStocks(first,second);
  assert.equal(result.sessionCount,30);
  assert.ok(Math.abs(result.correlation!-1)<1e-10);
  assert.ok(Math.abs(result.spearman!-1)<1e-10);
  assert.ok(Math.abs(result.returnDifferenceVolatility!)<1e-10);
  assert.equal(result.sameDirection,100);
  assert.ok(Math.abs(result.firstChange!-30)<1e-10);
  assert.ok(Math.abs(result.spread!)<1e-10);
});

test('Spearman handles tied daily-return ranks and volatility measures daily return gap',()=>{
  const firstReturns=Array.from({length:30},(_,index)=>[0,1,1,2,3,3,4,5,5,6][index%10]);
  const secondReturns=firstReturns.map((value,index)=>value+(index%4===0?1:0));
  const closes=(returns:number[])=>returns.reduce((bars,change)=>{bars.push(bars.at(-1)!*(1+change/100));return bars},[100]);
  const result=compareStocks(stock('1111',closes(firstReturns)),stock('2222',closes(secondReturns)));
  assert.ok(result.spearman!>0.9);
  assert.ok(result.returnDifferenceVolatility!>0);
});

test('comparison declines to score insufficient overlapping sessions or zero-variance prices',()=>{
  const first=stock('1111',Array.from({length:31},(_,index)=>100+index));
  const short=stock('2222',Array.from({length:10},(_,index)=>200+index));
  assert.equal(compareStocks(first,short).correlation,null);
  assert.equal(compareStocks(first,short).spearman,null);
  assert.equal(compareStocks(first,short).returnDifferenceVolatility,null);
  assert.equal(compareStocks(first,stock('3333',Array(31).fill(100))).correlation,null);
});

test('3-day smoothed synchronization is weighted, bounded, and reaches 100 for identical returns',()=>{
  const returns=Array.from({length:30},(_,index)=>Math.sin(index*1.7)*0.025+Math.cos(index*.6)*0.01);
  const closes=(initial:number)=>returns.reduce((bars,dailyReturn)=>{bars.push(bars.at(-1)!*(1+dailyReturn));return bars},[initial]);
  const result=compareStocks(stock('1111',closes(100)),stock('2222',closes(250)));
  assert.equal(result.smoothedSessionCount,28);
  assert.equal(result.synchronizationRate,100);
  assert.equal(result.synchronizationWeights.pearson,.4);
  assert.equal(result.synchronizationWeights.spearman,.3);
  assert.equal(result.synchronizationWeights.returnDifference,.3);
  const noisy=compareStocks(stock('1111',closes(100)),stock('2222',closes(250).map((value,index)=>value*(index%2?1.005:.995))));
  assert.ok(noisy.synchronizationRate!>=0&&noisy.synchronizationRate!<=100);
  assert.ok(noisy.synchronizationRate!<100);
});

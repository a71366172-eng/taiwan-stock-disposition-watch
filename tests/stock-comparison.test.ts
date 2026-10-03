import assert from 'node:assert/strict';
import test from 'node:test';
import {compareStocks,type ComparisonStock} from '../lib/stock-comparison.ts';

const stock=(code:string,closes:number[]):ComparisonStock=>({code,name:code,market:'TWSE',bars:closes.map((close,index)=>({date:`2026-09-${String(index+1).padStart(2,'0')}`,close}))});

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

test('weighted synchronization reaches the configured ceiling for identical returns',()=>{
  const returns=Array.from({length:30},(_,index)=>Math.sin(index*1.7)*0.025+Math.cos(index*.6)*0.01);
  const closes=(initial:number)=>returns.reduce((bars,dailyReturn)=>{bars.push(bars.at(-1)!*(1+dailyReturn));return bars},[initial]);
  const result=compareStocks(stock('1111',closes(100)),stock('2222',closes(250)));
  assert.equal(result.smoothedSessionCount,28);
  assert.equal(result.synchronizationRate,130);
  assert.equal(result.synchronizationWeights.pearson,.26);
  assert.equal(result.synchronizationWeights.spearman,.26);
  assert.equal(result.synchronizationWeights.twoDayLogReturn,.39);
  assert.equal(result.synchronizationWeights.sameDirection,.39);
  assert.equal(Object.values(result.synchronizationWeights).reduce((sum,weight)=>sum+weight,0),1.3);
  assert.equal(result.synchronizationWeightTotalPercent,130);
  assert.equal(compareStocks(stock('1111',closes(100)),stock('2222',closes(250)),30,100).synchronizationRate,100);
  const noisy=compareStocks(stock('1111',closes(100)),stock('2222',closes(250).map((value,index)=>value*(index%2?1.005:.995))));
  assert.ok(noisy.synchronizationRate!>=0&&noisy.synchronizationRate!<=130);
  assert.ok(noisy.synchronizationRate!<130);
});

test('two-day cumulative log-return gap volatility uses ln(Pt / Pt-2)',()=>{
  const firstCloses=Array.from({length:31},(_,index)=>100+index+(index%3)*2);
  const secondCloses=Array.from({length:31},(_,index)=>200+index*2+(index%5)*0.5);
  const gaps=Array.from({length:29},(_,index)=>Math.log(firstCloses[index+2]/firstCloses[index])-Math.log(secondCloses[index+2]/secondCloses[index]));
  const mean=gaps.reduce((sum,value)=>sum+value,0)/gaps.length;
  const expected=Math.sqrt(gaps.reduce((sum,value)=>sum+(value-mean)**2,0)/gaps.length);
  assert.ok(Math.abs(compareStocks(stock('1111',firstCloses),stock('2222',secondCloses)).twoDayLogReturnDifferenceVolatility!-expected)<1e-12);
});

test('30-session min-max DTW is scale-invariant and measures normalized curve distance',()=>{
  const first=Array.from({length:31},(_,index)=>100+index);
  const scaled=first.map(value=>value*5+300);
  const curved=Array.from({length:31},(_,index)=>100+index*index);
  assert.ok(Math.abs(compareStocks(stock('1111',first),stock('2222',scaled)).dtwDistance!)<1e-12);
  assert.ok(compareStocks(stock('1111',first),stock('3333',curved)).dtwDistance!>0);
});

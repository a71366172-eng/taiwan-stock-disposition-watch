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
  assert.equal(result.sameDirection,100);
  assert.ok(Math.abs(result.firstChange!-30)<1e-10);
  assert.ok(Math.abs(result.spread!)<1e-10);
});

test('comparison declines to score insufficient overlapping sessions or zero-variance prices',()=>{
  const first=stock('1111',Array.from({length:31},(_,index)=>100+index));
  const short=stock('2222',Array.from({length:10},(_,index)=>200+index));
  assert.equal(compareStocks(first,short).correlation,null);
  assert.equal(compareStocks(first,stock('3333',Array(31).fill(100))).correlation,null);
});

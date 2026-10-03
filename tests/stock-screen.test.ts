import assert from 'node:assert/strict';
import test from 'node:test';
import {buildScreenRows,screenStocks} from '../lib/stock-screen.ts';
import type {ScreenerSnapshot,ScreenerStock} from '../lib/market-types.ts';

function stock(code:string,closes:number[],market='TWSE'):ScreenerStock{
  return {code,name:`股票${code}`,market,close:closes.at(-1)??null,change:1,changePercent:1,volume:1000000,issuedShares:10000000,paidInCapital:100000000,bars:closes.map((close,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),close}))};
}

const snapshot=(stocks:ScreenerStock[])=>({asOf:'2026-02-01',generatedAt:'2026-02-01T00:00:00Z',stocks} as ScreenerSnapshot);
const filters={query:'',market:'ALL',minPrice:'',maxPrice:'',minChange30:'',maxChange30:'',minVolume:'',minTurnover:''};

test('30-session cumulative change needs 31 valid closes and uses endpoint prices',()=>{
  const [complete,short]=buildScreenRows(snapshot([stock('1111',Array.from({length:31},(_,index)=>100+index)),stock('2222',Array(30).fill(100))]));
  assert.ok(Math.abs(complete.change30!-30)<1e-10);
  assert.equal(short.change30,null);
  assert.equal(short.change5,0);
});

test('screening combines market, price, volume, turnover and valid-return filters',()=>{
  const rows=buildScreenRows(snapshot([stock('1111',Array.from({length:31},(_,index)=>100+index)),stock('2222',Array(22).fill(50),'TPEX')]));
  assert.deepEqual(screenStocks(rows,{...filters,market:'TWSE',minPrice:'100',minChange30:'20',minVolume:'900',minTurnover:'9'},'change30').map(row=>row.stock.code),['1111']);
  assert.deepEqual(screenStocks(rows,{...filters,minChange30:'0'},'change30').map(row=>row.stock.code),['1111']);
});

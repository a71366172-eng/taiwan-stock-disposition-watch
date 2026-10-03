import assert from 'node:assert/strict';
import test from 'node:test';
import {dispositionMetrics} from '../lib/disposition-metrics.ts';
import type {Bar, Disposition, Stock} from '../lib/market-types.ts';

const disposition:Disposition={code:'1234',name:'測試',announced:'2026-09-01',start:'2026-09-01',end:'2026-10-05',condition:'',measure:'',content:''};
const bar=(day:number,close:number|null):Bar=>({date:`2026-09-${String(day).padStart(2,'0')}`,open:close,high:close,low:close,close,reference:close,volume:1000,note:''});
const stock=(bars:Bar[]):Stock=>({code:'1234',name:'測試',market:'TWSE',industry:'',close:999,change:null,changePercent:null,volume:null,pe:null,pb:null,valuationDate:null,bars,notices:[],candidateReason:null,dispositions:[]});

test('20MA deviation uses the latest 20 available trading closes, excluding future and missing closes',()=>{
  const bars=[bar(1,50),...Array.from({length:19},(_,index)=>bar(index+2,100)),bar(21,120),bar(22,null),bar(23,200)];
  const metrics=dispositionMetrics(disposition,stock(bars),'2026-09-22');
  assert.equal(metrics.ma20,101);
  assert.equal(metrics.latestClose,120);
  assert.ok(Math.abs(metrics.ma20DeviationPercent!-(120/101-1)*100)<1e-10);
});

test('20MA deviation is unavailable when fewer than 20 valid closes exist',()=>{
  const metrics=dispositionMetrics(disposition,stock(Array.from({length:19},(_,index)=>bar(index+1,100))),'2026-09-22');
  assert.equal(metrics.ma20,null);
  assert.equal(metrics.ma20DeviationPercent,null);
});

test('5-day and 10-day changes compare with closes five and ten trading sessions earlier',()=>{
  const bars=Array.from({length:11},(_,index)=>bar(index+1,index===0?80:index===5?100:index===10?110:90));
  const metrics=dispositionMetrics(disposition,stock(bars),'2026-09-11');
  assert.ok(Math.abs(metrics.fiveDayChangePercent!-10)<1e-10);
  assert.ok(Math.abs(metrics.tenDayChangePercent!-37.5)<1e-10);
});

test('short history does not produce a misleading 5-day or 10-day change',()=>{
  const metrics=dispositionMetrics(disposition,stock(Array.from({length:5},(_,index)=>bar(index+1,100))),'2026-09-05');
  assert.equal(metrics.fiveDayChangePercent,null);
  assert.equal(metrics.tenDayChangePercent,null);
});

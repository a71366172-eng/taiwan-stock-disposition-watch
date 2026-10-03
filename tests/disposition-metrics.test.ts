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

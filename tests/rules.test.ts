import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countGate,forecastDispositionRisk,legalPrices,simulate,DEFAULT_SCENARIO,validateScenario,cumulativeReturn,sixDayTwentyFivePercentFloor,sixthClauseMinimumShares} from '../lib/rules.ts';
import type {Stock} from '../lib/market-types.ts';
import {dispositionTier} from '../lib/disposition-tier.ts';
import {isGuaranteedDispositionNextSession} from '../lib/guaranteed-disposition.ts';
import {isRiskWatchEligible,isCurrentlyDisposed} from '../lib/risk-watch.ts';
import {recentDispositionExits} from '../lib/disposition-exits.ts';
const calendar=Array.from({length:90},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
const base:Stock={code:'TEST',name:'測試資料',market:'TWSE',industry:'',close:100,change:0,changePercent:0,volume:5000000,pe:60,pb:12,valuationDate:calendar.at(-1)!,bars:calendar.map(date=>({date,open:100,high:100,low:100,close:100,reference:100,volume:5000000,note:''})),notices:[],candidateReason:null,dispositions:[]};
const context={asOf:calendar.at(-1)!,targetDate:'2026-04-01',effectiveDate:'2026-04-02',calendar,calendarVerified:true};
const forecastContext={...context,forecastDates:['2026-04-01','2026-04-02','2026-04-03']};
test('one day with several reasons is counted once; ninth+one window excludes old tenth day',()=>{
 const notices=[10,9,8,7,6].map(offset=>({code:'TEST',name:'test',date:calendar.at(-offset)!,reason:'',rules:[1,6],close:100,pe:60}));
 const g=countGate({...base,notices},calendar,context.asOf);assert.equal(g.nineCount,4);assert.ok(!g.paths.includes('十日內六日'));
});
test('ninth+one window qualifies at five existing days, unrelated rule13 does not count',()=>{
 const notices=[9,8,7,6,1].map(offset=>({code:'TEST',name:'test',date:calendar.at(-offset)!,reason:'',rules:[6],close:100,pe:60}));
 notices.push({...notices[0],date:calendar.at(-2)!,rules:[13]});
 assert.ok(countGate({...base,notices},calendar,context.asOf).paths.includes('十日內六日'));
});
test('first-rule streak requires first clause specifically and consecutive sessions',()=>{
 const notices=[2,1].map(offset=>({code:'TEST',name:'test',date:calendar.at(-offset)!,reason:'',rules:[6],close:100,pe:60}));
 assert.equal(countGate({...base,notices},calendar,context.asOf).firstStreak,0);
 notices.forEach(n=>n.rules=[1]);assert.equal(countGate({...base,notices},calendar,context.asOf).firstStreak,2);
});
test('legal ticks cross 50 and 100 correctly; no float drift',()=>{
 const prices=legalPrices(50);assert.ok(prices.includes(49.95));assert.ok(prices.includes(50));assert.ok(prices.includes(50.1));assert.ok(!prices.includes(50.05));assert.equal(prices.at(-1),55);
 assert.equal(legalPrices(99.9).at(-1),109.5);
});
test('sixth-clause strict market PE comparison excludes equality at 100',()=>{
 const r=simulate(base,context,DEFAULT_SCENARIO).rules.find(x=>x.rule===6)!;assert.equal(r.intervals[0].from,100.5);assert.equal(r.status,'conditional');
});
test('sixth clause recognizes official nonpositive-EPS PE omission without inventing a PE number',()=>{
 const result=simulate({...base,pe:null,peNegative:true},context,{marketPe:20,marketPb:2,industryPb:2});
 const sixth=result.rules.find(x=>x.rule===6)!;assert.equal(sixth.status,'conditional');assert.ok(sixth.intervals.length>0);
});
test('sixth-clause volume combines the 3,000-lot floor with 5% of issued shares',()=>{
 assert.equal(sixthClauseMinimumShares(100_000_000),5_000_000);
 assert.equal(sixthClauseMinimumShares(10_000_000),3_000_000);
 assert.equal(sixthClauseMinimumShares(null),null);
});
test('six-day price floor distinguishes a reachable threshold from one above tomorrow limit',()=>{
 const below=sixDayTwentyFivePercentFloor(base,context.asOf)!;
 assert.equal(below.price,125.5);assert.equal(below.reachable,false);
 const near={...base,bars:base.bars.map((bar,i)=>i>=85?{...bar,close:104,reference:100}:bar)};
 const reachable=sixDayTwentyFivePercentFloor(near,context.asOf)!;
 assert.equal(reachable.reachable,true);
});
test('missing valuation does not become zero/no-risk',()=>assert.equal(simulate({...base,pb:null},context).rules.find(x=>x.rule===6)?.status,'missing'));
test('cumulative return is daily sum using reference, not end-to-end compounding',()=>assert.equal(cumulativeReturn([{...base.bars[0],close:110,reference:100},{...base.bars[0],close:99,reference:110}]),0));
test('incomplete history and recent disposition are explicit unknowns',()=>{
 assert.equal(simulate({...base,bars:base.bars.slice(-3)},context).rules[0].status,'missing');
 assert.equal(simulate({...base,dispositions:[{code:'TEST',name:'test',announced:context.asOf,start:null,end:null,condition:'',measure:'',content:''}]},context).rules[1].status,'missing');
});
test('input validation rejects NaN, nonnumeric, unknown fields and invalid averages',()=>{
 for(const input of [{marketPe:NaN},{marketPe:'30'},{marketPb:0},{random:1},{referencePrice:0}])assert.throws(()=>validateScenario(input));
});
test('daily returns truncate toward zero before summing, including negative fractions',()=>{
 assert.equal(cumulativeReturn([{...base.bars[0],close:104,reference:103}]),0.97);
 assert.equal(cumulativeReturn([{...base.bars[0],close:101,reference:103}]),-1.94);
 assert.equal(cumulativeReturn([{...base.bars[0],close:104,reference:103},{...base.bars[0],close:102,reference:103}]),0);
});
test('disposition tier uses the latest 30 known business sessions',()=>{
 const recent={...base,dispositions:[{code:'TEST',name:'test',announced:calendar.at(-30)!,start:null,end:null,condition:'',measure:'',content:''}]};
 const old={...recent,dispositions:[{...recent.dispositions[0],announced:calendar.at(-31)!}]};
 assert.equal(dispositionTier(recent,calendar,context.asOf),'repeat');
 assert.equal(dispositionTier(old,calendar,context.asOf),'first');
});
test('the shared price engine accepts TPEx common stocks',()=>{
 const result=simulate({...base,market:'TPEX',code:'5314'},context);
 assert.equal(result.code,'5314');
 assert.equal(result.rulesVersion,'TW-MARKETS-2026-08-10-v0.4');
});
test('three-session risk keeps official candidates first and extends an active first-clause streak',()=>{
 const official=forecastDispositionRisk({...base,candidateReason:'官方候選'},forecastContext);
 assert.deepEqual(official,{days:1,date:'2026-04-01',paths:['次一營業日再達注意標準時，將公告處置'],official:true});
 const notice={code:'TEST',name:'test',date:context.asOf,reason:'',rules:[1],close:100,pe:60};
 const projected=forecastDispositionRisk({...base,notices:[notice]},forecastContext);
 assert.equal(projected?.days,2);assert.deepEqual(projected?.paths,['第一款連續三日']);
});
test('three-session risk estimates the earliest continued countable-attention path',()=>{
 const notices=[2,1].map(offset=>({code:'TEST',name:'test',date:calendar.at(-offset)!,reason:'',rules:[6],close:100,pe:60}));
 const projected=forecastDispositionRisk({...base,notices},forecastContext);
 assert.equal(projected?.days,3);assert.ok(projected?.paths.includes('第 1–8 款連續五日'));
});
test('next-session disposition label follows first-clause trigger at the reference close',()=>{
 const robust={...base,close:109,candidateReason:'官方累計候選',bars:base.bars.map((bar,index)=>index>=calendar.length-5?{...bar,close:109,reference:100}:bar)};
 const robustResult=simulate(robust,context);
 assert.equal(isGuaranteedDispositionNextSession(robust,robustResult),true);
 assert.equal(isGuaranteedDispositionNextSession({...robust,candidateReason:null},robustResult),true);
 const narrow={...robust,bars:base.bars};
 assert.equal(isGuaranteedDispositionNextSession(narrow,simulate(narrow,context)),false);
});
test('risk list hides active dispositions unless they are re-noticed and still forecast at risk',()=>{
 const active={...base,dispositions:[{code:'TEST',name:'test',announced:context.asOf,start:calendar.at(-2)!,end:calendar.at(-1)!,condition:'',measure:'',content:''}]};
 assert.equal(isCurrentlyDisposed(active,context.asOf),true);
 assert.equal(isRiskWatchEligible(active,context.asOf,true,false,false,false),false);
 const renoticed={...active,notices:[{code:'TEST',name:'test',date:context.asOf,reason:'',rules:[1],close:100,pe:60}]};
 assert.equal(isRiskWatchEligible(renoticed,context.asOf,true,false,false,false),true);
 assert.equal(isRiskWatchEligible(renoticed,context.asOf,false,false,true,false),false);
});
test('recent disposition exits include grouped -3 to +5 actual trading sessions',()=>{
 const sessions=['2026-10-01','2026-10-02','2026-10-05','2026-10-07','2026-10-08'];
 const future=['2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-20'];
 const entry=(code:string,end:string,announced:string):Stock['dispositions'][number]=>({code,name:code,announced,start:null,end,condition:'',measure:'',content:''});
 const groups=recentDispositionExits([
  entry('past-edge','2026-10-02','2026-10-01'),entry('past-out','2026-10-01','2026-10-01'),
  entry('today-a','2026-10-08','2026-10-07'),entry('today-b','2026-10-08','2026-10-07'),
  entry('future-edge','2026-10-15','2026-10-09'),entry('future-out','2026-10-16','2026-10-09')
 ],sessions,'2026-10-08',future);
 assert.deepEqual(groups.map(group=>[group.date,group.offset,group.items.map(item=>item.code)]),[
  ['2026-10-02',-3,['past-edge']],['2026-10-08',0,['today-a','today-b']],['2026-10-15',5,['future-edge']]
 ]);
});
test('30-day observation rows are optional and ended dispositions can remain in normal risk results',()=>{
 const observed={...base,notices:[{code:'TEST',name:'test',date:calendar.at(-1)!,reason:'',rules:[1],close:100,pe:60}]};
 assert.equal(isRiskWatchEligible(observed,context.asOf,false,true,false,false),false);
 assert.equal(isRiskWatchEligible(observed,context.asOf,false,true,true,false),true);
 const ended={...observed,dispositions:[{code:'TEST',name:'test',announced:calendar.at(-10)!,start:calendar.at(-10)!,end:calendar.at(-5)!,condition:'',measure:'',content:''}]};
 assert.equal(isCurrentlyDisposed(ended,context.asOf),false);
 assert.equal(isRiskWatchEligible(ended,context.asOf,true,false,false,false),true);
});

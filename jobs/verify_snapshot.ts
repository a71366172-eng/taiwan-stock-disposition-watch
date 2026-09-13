import fs from 'node:fs';
import {cumulativeReturn,countGate} from '../lib/rules.ts';
import type {MarketSnapshot} from '../lib/market-types.ts';
const snapshot=JSON.parse(fs.readFileSync(new URL('../data/market.json',import.meta.url),'utf8')) as MarketSnapshot;
const checks:unknown[]=[],failures:string[]=[];let compared=0,skipped=0;
for(const stock of snapshot.stocks){
 for(const notice of stock.notices){
  if(!notice.rules.includes(1))continue;
  const match=notice.reason.match(/累積收盤價(漲|跌)幅達([\d.]+)%/);if(!match)continue;
  const bars=stock.bars.filter(b=>b.date<=notice.date).slice(-6),dates=snapshot.calendar.filter(d=>d<=notice.date).slice(-6);
  if(bars.length!==6||bars.some((b,i)=>b.note||b.date!==dates[i])){skipped++;continue;}
  const calculated=cumulativeReturn(bars);if(calculated===null){skipped++;continue;}
  const announced=Number(match[2])*(match[1]==='跌'?-1:1),delta=Math.abs(calculated-announced),pass=delta<.000001;compared++;
  checks.push({code:stock.code,date:notice.date,announced,calculated:Number(calculated.toFixed(5)),pass});
  if(!pass)failures.push(`${stock.code}/${notice.date}: return mismatch`);
 }
}
const candidates=snapshot.stocks.filter(s=>s.candidateReason).map(s=>({code:s.code,officialReason:s.candidateReason,reconstructed:countGate(s,snapshot.calendar,snapshot.asOf)}));
const report={asOf:snapshot.asOf,kind:'Historical announcement arithmetic reconciliation, not prediction backtest',compared,skipped,failures,checks,candidates};
const rendered=JSON.stringify(report,null,2);
fs.mkdirSync(new URL('../work/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../work/verification.json',import.meta.url),rendered);
fs.mkdirSync(new URL('../data/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../data/verification.json',import.meta.url),rendered);
console.log(JSON.stringify({asOf:snapshot.asOf,compared,skipped,failures,candidates},null,2));
if(failures.length)process.exitCode=1;

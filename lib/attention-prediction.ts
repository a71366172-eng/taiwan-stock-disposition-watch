import type {MarketSnapshot,Simulation,Stock} from './market-types';
import {cumulativeReturn,legalPrices,sixthClauseMinimumShares} from './rules.ts';

export type AttentionRow={rule:number;name:string;status:'partial'|'outside'|'missing'|'exempt'|'manual';summary:string;details:string[]};
const names=['累積漲跌幅異常','中長期漲跌異常','漲跌異常＋量能放大','漲跌異常＋高週轉','漲跌異常＋券商集中','本益比／股價淨值比異常','漲跌異常＋券資比','存託憑證溢折價','成交量放大','累積週轉率','起迄價差','借券賣出','當沖異常','其他交易異常'];
const fmt=(n:number)=>n.toLocaleString('zh-TW',{maximumFractionDigits:3});
/** Necessary price conditions only. Never turn partial coverage into a definitive attention decision. */
export function priceSummary(prices:number[],reference:number){
 if(!prices.length)return '超出漲跌停價';
 const all=legalPrices(reference),groups:number[][]=[];
 for(const p of prices){const last=groups.at(-1);if(last&&all.indexOf(p)===all.indexOf(last.at(-1)!)+1)last.push(p);else groups.push([p]);}
 return groups.map(g=>g.length===all.length?'漲跌停範圍內皆符合價格條件':g[0]===all[0]?`收盤 ≤ ${fmt(g.at(-1)!)} 元`:g.at(-1)===all.at(-1)?`收盤 ≥ ${fmt(g[0])} 元`:g.length===1?`收盤 = ${fmt(g[0])} 元`:`收盤 ≥ ${fmt(g[0])} 且 ≤ ${fmt(g.at(-1)!)} 元`).join('；或 ');
}
export function attentionPrediction(stock:Stock,snapshot:Pick<MarketSnapshot,'asOf'|'calendar'>,simulation:Simulation):AttentionRow[]{
 const otc=stock.market==='TPEX',bars=stock.bars.filter(b=>b.date<=snapshot.asOf).sort((a,b)=>a.date.localeCompare(b.date)),dates=snapshot.calendar.filter(d=>d<=snapshot.asOf);
 const tail=(n:number)=>{const b=bars.slice(-n);return b.length===n&&b.every((x,i)=>x.date===dates.slice(-n)[i]&&!x.note)?b:null;};
 const five=tail(5),sum=five?cumulativeReturn(five):null,prices=legalPrices(simulation.reference);
 const six=(p:number)=>sum!+Math.trunc((p/simulation.reference-1)*10000+Math.sign(p-simulation.reference)*1e-8)/100;
 const shared=sum===null?[]:prices.filter(p=>Math.abs(six(p))>(otc?27:25));
 const shares=stock.issuedShares&&stock.issuedShares>0?stock.issuedShares:null;
 const small=otc&&!!stock.paidInCapital&&stock.paidInCapital<80_000_000;
 const recent=(rule:number)=>stock.notices.some(n=>dates.slice(-5).includes(n.date)&&n.rules.includes(rule));
 const rows:AttentionRow[]=names.map((name,i)=>({rule:i+1,name,status:'missing',summary:'資料不足',details:[]}));
 const set=(rule:number,status:AttentionRow['status'],summary:string,details:string[])=>Object.assign(rows[rule-1],{status,summary,details});
 const priceRule=(rule:number,values:number[],ready:boolean,extra:string,details:string[])=>set(rule,ready?(values.length?'partial':'outside'):'missing',ready?priceSummary(values,simulation.reference)+extra:'缺少連續有效行情'+extra,details);
 for(const id of [1,6]){
  const r=simulation.rules.find(r=>r.rule===id)!;
  const values=prices.filter(p=>r.intervals.some(v=>p>=v.from&&p<=v.to));
  const volume=sixthClauseMinimumShares(shares,stock.market,stock.paidInCapital);
  priceRule(id,values,r.status!=='missing',id===6?`；且成交量 ≥ ${volume===null?'待補股數':fmt(volume/1000)} 張`:'',id===1?r.conditions:[`本益比負值，或 ≥ ${otc?65:60} 且超過市場加權平均 2 倍；淨值比 ≥ ${otc?4:6} 且超過市場平均 2 倍。`,`週轉率 ≥ 5%；產業淨值比比較、券商集中或單一投資人集中，須至少符合一個分支。`,'本列僅計算產業比較分支，市場與產業估值採情境假設；未達此分支不能排除其他分支。',...(small?['小資本額上櫃股適用法定比較及成交量除外條件。']:[])]);
  if(id===6&&r.status==='no_price')set(6,'missing','產業分支未達；集中度分支待資料',rows[5].details);
 }
 const longValues=new Set<number>();let longReady=0;
 for(const [n,threshold] of [[30,100],[60,otc?140:130],[90,160]]){const b=tail(n-1);if(!b?.every(x=>x.close!==null&&x.close>0))continue;longReady++;for(const p of prices){const limit=otc&&p<5?({30:120,60:180,90:240}[n]??threshold):threshold;if(Math.abs((p/b[0].close!-1)*100)>limit&&p>simulation.reference)longValues.add(p);}}
 priceRule(2,prices.filter(p=>longValues.has(p)),longReady===3,'',['計算 30／60／90 日起迄價差的基本價格門檻；市場及同類差幅仍須達標。','近 30 日第一款注意、近 60 日僅第二款處置與企業行動的除外條件尚待完整驗證，因此不作確定觸發判定。']);
 const volume59=tail(59),sum59=volume59?.every(b=>b.volume!==null)?volume59.reduce((a,b)=>a+b.volume!,0):null;
 // V >= 5 * (sum59 + V) / 60, not five times yesterday's average.
 const min3=sum59!==null&&shares?Math.ceil(Math.max(5*sum59/55,small?0:(otc?300_000:500_000),shares*(otc?.01:.001))):null;
 const diff=['六日漲跌幅仍須與市場及同類平均相差至少 20 個百分點；適用法定除外情形。'];
 priceRule(3,shared,sum!==null,`；且量 ≥ ${min3===null?'待補 59 日量／股數':fmt(min3/1000)} 張（基本門檻）`,[...diff,'成交量／含預測日的 60 日均量 ≥ 5 倍，且比市場平均放大倍數至少高 4 倍；市場條件可能提高量門檻。']);
 const min4=shares?(otc?Math.floor(shares*.05)+1:Math.ceil(shares*.1)):null;
 priceRule(4,shared,sum!==null,`；且量 ≥ ${min4===null?'待補股數':fmt(min4/1000)} 張（基本門檻）`,[...diff,`週轉率${otc?' > 5%':' ≥ 10%'}，且比市場平均高至少 ${otc?3:5} 個百分點。`]);
 priceRule(5,shared,sum!==null,`；且券商集中 > ${otc?20:25}%`,[...diff,`券商成交買進或賣出須逾 ${otc?300:500} 張；每分支機構增加 1 個百分點，上限 ${otc?30:35}%。`,'券商集中度為下個交易日成交後資料，價格僅為必要條件。']);
 priceRule(7,shared,sum!==null,'；券資條件待資料',[...diff,`前一交易日券資比 ≥ ${otc?10:20}%，融資使用率 ≥ ${otc?20:25}%，融券使用率 ≥ ${otc?10:15}%。`,'券資比較近六日最低值放大至少四倍，且不得低於再前一交易日；不能用未來融資券增量替代此既定資料。']);
 set(8,'exempt','僅適用臺灣存託憑證；本頁為普通股',[]);
 const sum5=five?.every(b=>b.volume!==null)?five.reduce((a,b)=>a+b.volume!,0):null;
 const min9=sum59!==null&&sum5!==null&&shares?Math.ceil(Math.max(5*sum59/55,sum59-2*sum5,Math.floor(shares*(otc?.01:.001))+1,(otc?300_000:500_000)+1)):null;
 set(9,recent(3)?'exempt':min9===null?'missing':'partial',recent(3)?'近五日已公告第三款，適用除外':min9===null?'缺少 59 日量／股數':`成交量 ≥ ${fmt(min9/1000)} 張（基本門檻）`,['當日量及六日均量相對 60 日均量皆 ≥ 5 倍，且均較市場倍數高至少 4 倍。',`成交金額須 > ${otc?2000:3000} 萬元；當沖調整及再次公告除外條件須另檢查。`]);
 const min10=sum5!==null&&shares?Math.max(Math.floor(shares*(otc?.8:.5)-sum5)+1,Math.ceil(shares*(otc?.05:.1))):null;
 set(10,recent(4)?'exempt':min10===null?'missing':'partial',recent(4)?'近五日已公告第四款，適用除外':min10===null?'缺少五日量／股數':`成交量 ≥ ${fmt(min10/1000)} 張（基本門檻）`,[`六日累計週轉率 > ${otc?80:50}%，仍須達市場差幅及成交金額條件。`,'股數以目前資料假設不變；歷史股數變更、當沖調整及再次公告條件須另檢查。']);
 const high=five?Math.max(...five.map(b=>b.close??Infinity)):Infinity,low=five?Math.min(...five.map(b=>b.close??-Infinity)):-Infinity;
 const p11=five?prices.filter(p=>p>1000&&Math.abs(p-five[0].close!)>=300+Math.max(0,Math.ceil(p/1000)-2)*150&&(p>=high||p<=low)):[];
 priceRule(11,p11,!!five&&five.every(b=>b.close!==null),'',['依價格級距計算六日起迄價差，並要求六日最高或最低收盤；企業行動須排除。']);
 if(recent(11))set(11,'exempt','近五日已公告第十一款，適用除外',rows[10].details);
 set(12,'missing','待補借券賣出成交量歷史',['需借券賣出「成交量」；借券餘額不能替代。']);
 set(13,'missing','待補六日當沖量與成交金額',['需核對前一日及六日當沖成交量比率、週轉率、成交金額及重複公告除外條件。']);
 set(14,'manual','由交易所依其他交易異常情形認定',['無固定價格公式，依交易所公告。']);
 return rows;
}

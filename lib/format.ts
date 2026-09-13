export const fmt=(n:number|null|undefined,d=2)=>n===null||n===undefined?'—':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
export const shortDate=(d:string)=>d.slice(5).replace('-','/');
export const timestamp=(d:string)=>new Date(d).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
export const ruleNames:Record<number,string>={1:'六日價格異常',2:'長期價格異常',3:'量價異常',4:'週轉率異常',5:'券商集中度',6:'估值與週轉率',7:'券資比異常',8:'存託憑證溢折價',9:'成交量異常',10:'累積週轉率',11:'價差異常',12:'借券賣出異常',13:'當沖異常',14:'其他異常'};
import type {PriceInterval} from './market-types';
import {tickCents} from './rules';
/** Join adjacent intervals that the engine splits only to label their direction. */
export function displayIntervals(intervals:PriceInterval[]){const groups:{from:number;to:number}[]=[];for(const interval of intervals){const last=groups.at(-1);if(last&&Math.round(interval.from*100)===Math.round(last.to*100)+tickCents(Math.round(last.to*100)))last.to=interval.to;else groups.push({from:interval.from,to:interval.to});}return groups;}

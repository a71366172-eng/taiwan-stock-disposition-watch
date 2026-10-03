import type {ScreenerSnapshot,ScreenerStock} from './market-types';
import {industryName} from './industry.ts';

export type ScreenRow={stock:ScreenerStock;tradingDays:number;change5:number|null;change10:number|null;change30:number|null;ma20Deviation:number|null};
export type ScreenSort='code'|'industry'|'price'|'changeToday'|'change5'|'change10'|'change30'|'volume'|'turnover'|'ma20';
export type SortDirection='asc'|'desc';

function closeHistory(stock:ScreenerStock){
  return stock.bars.filter(bar=>bar.close!==null&&Number.isFinite(bar.close)&&bar.close>0).sort((a,b)=>a.date.localeCompare(b.date));
}

function cumulativeChange(closes:number[],sessions:number){
  if(closes.length<=sessions)return null;
  const old=closes[closes.length-sessions-1],last=closes.at(-1);
  return old&&last?((last/old)-1)*100:null;
}

export function buildScreenRows(snapshot:ScreenerSnapshot):ScreenRow[]{
  return snapshot.stocks.map(stock=>{
    const bars=closeHistory(stock),closes=bars.map(bar=>bar.close).filter((value):value is number=>value!==null);
    const recent=closes.slice(-20),average=recent.length===20?recent.reduce((sum,value)=>sum+value,0)/20:null,last=closes.at(-1);
    return {stock,tradingDays:Math.max(0,closes.length-1),change5:cumulativeChange(closes,5),change10:cumulativeChange(closes,10),change30:cumulativeChange(closes,30),ma20Deviation:average&&last!==undefined?(last/average-1)*100:null};
  });
}

export function screenStocks(rows:ScreenRow[],filters:{query:string;market:string;industry?:string;stockFutures?:string;warrants?:string;convertibleBonds?:string;minPrice:string;maxPrice:string;minChangeToday?:string;maxChangeToday?:string;minChange30:string;maxChange30:string;minVolume:string;minTurnover:string},sort:ScreenSort,direction:SortDirection='desc'){
  const numberOrNull=(value:string)=>value.trim()===''?null:Number(value);
  const minPrice=numberOrNull(filters.minPrice),maxPrice=numberOrNull(filters.maxPrice),minChangeToday=numberOrNull(filters.minChangeToday??''),maxChangeToday=numberOrNull(filters.maxChangeToday??''),minChange=numberOrNull(filters.minChange30),maxChange=numberOrNull(filters.maxChange30),minVolume=numberOrNull(filters.minVolume),minTurnover=numberOrNull(filters.minTurnover);
  return rows.filter(row=>{
    const {stock}=row,volume=stock.volume,turnover=volume!=null&&stock.issuedShares!=null&&stock.issuedShares>0?volume/stock.issuedShares*100:null;
    return (!filters.query||`${stock.code} ${stock.name}`.toLocaleLowerCase().includes(filters.query.trim().toLocaleLowerCase()))
      &&(filters.market==='ALL'||stock.market===filters.market)
      &&(!filters.industry||filters.industry==='ALL'||(filters.industry==='__UNCLASSIFIED__'?!stock.industry?.trim():stock.industry===filters.industry))
      &&(filters.stockFutures==='ALL'||filters.stockFutures===undefined||(filters.stockFutures==='YES'?stock.hasStockFutures===true:stock.hasStockFutures===false))
      &&(filters.warrants==='ALL'||filters.warrants===undefined||(filters.warrants==='YES'?stock.hasWarrants===true:stock.hasWarrants===false))
      &&(filters.convertibleBonds==='ALL'||filters.convertibleBonds===undefined||(filters.convertibleBonds==='YES'?stock.hasConvertibleBonds===true:stock.hasConvertibleBonds===false))
      &&(minPrice===null||(stock.close!==null&&stock.close>=minPrice))&&(maxPrice===null||(stock.close!==null&&stock.close<=maxPrice))
      &&(minChangeToday===null||(stock.changePercent!==null&&stock.changePercent>=minChangeToday))&&(maxChangeToday===null||(stock.changePercent!==null&&stock.changePercent<=maxChangeToday))
      &&(minChange===null||(row.change30!==null&&row.change30>=minChange))&&(maxChange===null||(row.change30!==null&&row.change30<=maxChange))
      &&(minVolume===null||(volume!==null&&volume/1000>=minVolume))&&(minTurnover===null||(turnover!==null&&turnover>=minTurnover));
  }).sort((a,b)=>{
    if(sort==='code')return direction==='asc'?a.stock.code.localeCompare(b.stock.code,'zh-TW',{numeric:true}):b.stock.code.localeCompare(a.stock.code,'zh-TW',{numeric:true});
    if(sort==='industry')return direction==='asc'?industryName(a.stock.industry).localeCompare(industryName(b.stock.industry),'zh-TW')||a.stock.code.localeCompare(b.stock.code,'zh-TW',{numeric:true}):industryName(b.stock.industry).localeCompare(industryName(a.stock.industry),'zh-TW')||b.stock.code.localeCompare(a.stock.code,'zh-TW',{numeric:true});
    const value=(row:ScreenRow)=>sort==='price'?row.stock.close:sort==='changeToday'?row.stock.changePercent:sort==='volume'?row.stock.volume:sort==='turnover'&&row.stock.volume!=null&&row.stock.issuedShares?row.stock.volume/row.stock.issuedShares*100:sort==='change5'?row.change5:sort==='change10'?row.change10:sort==='ma20'?row.ma20Deviation:row.change30;
    const left=value(a),right=value(b);
    if(left===null||left===undefined)return right===null||right===undefined?0:1;
    if(right===null||right===undefined)return -1;
    return direction==='asc'?left-right:right-left;
  });
}

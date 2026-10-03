import type {ScreenerSnapshot,ScreenerStock} from './market-types';

export type ScreenRow={stock:ScreenerStock;tradingDays:number;change5:number|null;change10:number|null;change30:number|null;ma20Deviation:number|null};

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

export function screenStocks(rows:ScreenRow[],filters:{query:string;market:string;minPrice:string;maxPrice:string;minChange30:string;maxChange30:string;minVolume:string;minTurnover:string},sort:'change30'|'change10'|'change5'|'price'|'volume'|'turnover'){
  const numberOrNull=(value:string)=>value.trim()===''?null:Number(value);
  const minPrice=numberOrNull(filters.minPrice),maxPrice=numberOrNull(filters.maxPrice),minChange=numberOrNull(filters.minChange30),maxChange=numberOrNull(filters.maxChange30),minVolume=numberOrNull(filters.minVolume),minTurnover=numberOrNull(filters.minTurnover);
  return rows.filter(row=>{
    const {stock}=row,volume=stock.volume,turnover=volume!=null&&stock.issuedShares!=null&&stock.issuedShares>0?volume/stock.issuedShares*100:null;
    return (!filters.query||`${stock.code} ${stock.name}`.toLocaleLowerCase().includes(filters.query.trim().toLocaleLowerCase()))
      &&(filters.market==='ALL'||stock.market===filters.market)
      &&(minPrice===null||(stock.close!==null&&stock.close>=minPrice))&&(maxPrice===null||(stock.close!==null&&stock.close<=maxPrice))
      &&(minChange===null||(row.change30!==null&&row.change30>=minChange))&&(maxChange===null||(row.change30!==null&&row.change30<=maxChange))
      &&(minVolume===null||(volume!==null&&volume/1000>=minVolume))&&(minTurnover===null||(turnover!==null&&turnover>=minTurnover));
  }).sort((a,b)=>{
    const value=(row:ScreenRow)=>sort==='price'?row.stock.close:sort==='volume'?row.stock.volume:sort==='turnover'&&row.stock.volume!=null&&row.stock.issuedShares?row.stock.volume/row.stock.issuedShares*100:sort==='change5'?row.change5:sort==='change10'?row.change10:row.change30;
    const left=value(a),right=value(b);return left===null||left===undefined?(right==null?0:1):right===null||right===undefined?-1:right-left;
  });
}

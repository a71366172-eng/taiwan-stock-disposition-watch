export type ComparisonBar={date:string;close:number};
export type ComparisonStock={code:string;name:string;market:'TWSE'|'TPEX';bars:ComparisonBar[]};
export type ComparisonSnapshot={schemaVersion:number;asOf:string;generatedAt:string;windowSessions:number;collectedDates:Record<string,string[]>;stocks:ComparisonStock[]};

export function compareStocks(first:ComparisonStock,second:ComparisonStock,sessions=30){
  const secondByDate=new Map(second.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0).map(bar=>[bar.date,bar.close]));
  const common=first.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0&&secondByDate.has(bar.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-(sessions+1));
  const points=common.map(bar=>({date:bar.date,firstClose:bar.close,secondClose:secondByDate.get(bar.date)!}));
  const daily=points.slice(1).map((point,index)=>({first:point.firstClose/points[index].firstClose-1,second:point.secondClose/points[index].secondClose-1}));
  const chart=points.map(point=>({date:point.date,first:(point.firstClose/points[0].firstClose-1)*100,second:(point.secondClose/points[0].secondClose-1)*100}));
  const count=daily.length;
  const firstMean=daily.reduce((sum,row)=>sum+row.first,0)/count;
  const secondMean=daily.reduce((sum,row)=>sum+row.second,0)/count;
  const covariance=daily.reduce((sum,row)=>sum+(row.first-firstMean)*(row.second-secondMean),0);
  const firstVariance=daily.reduce((sum,row)=>sum+(row.first-firstMean)**2,0);
  const secondVariance=daily.reduce((sum,row)=>sum+(row.second-secondMean)**2,0);
  const correlation=count>=15&&firstVariance>0&&secondVariance>0?Math.max(-1,Math.min(1,covariance/Math.sqrt(firstVariance*secondVariance))):null;
  const sameDirection=count?daily.filter(row=>row.first*row.second>0||(row.first===0&&row.second===0)).length/count*100:null;
  const firstChange=count?chart.at(-1)!.first:null;
  const secondChange=count?chart.at(-1)!.second:null;
  return {points:chart,sessionCount:count,correlation,sameDirection,firstChange,secondChange,spread:firstChange!==null&&secondChange!==null?firstChange-secondChange:null};
}

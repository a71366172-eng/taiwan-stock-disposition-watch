export type ComparisonBar={date:string;close:number};
export type ComparisonStock={code:string;name:string;market:'TWSE'|'TPEX';isEtf?:boolean;bars:ComparisonBar[]};
export type ComparisonSnapshot={schemaVersion:number;asOf:string;generatedAt:string;windowSessions:number;collectedDates:Record<string,string[]>;stocks:ComparisonStock[]};

function pearson(first:number[],second:number[],minimum=15):number|null{
  if(first.length!==second.length||first.length<minimum)return null;
  const firstMean=first.reduce((sum,value)=>sum+value,0)/first.length;
  const secondMean=second.reduce((sum,value)=>sum+value,0)/second.length;
  const covariance=first.reduce((sum,value,index)=>sum+(value-firstMean)*(second[index]-secondMean),0);
  const firstVariance=first.reduce((sum,value)=>sum+(value-firstMean)**2,0);
  const secondVariance=second.reduce((sum,value)=>sum+(value-secondMean)**2,0);
  return firstVariance>0&&secondVariance>0?Math.max(-1,Math.min(1,covariance/Math.sqrt(firstVariance*secondVariance))):null;
}

function ranks(values:number[]):number[]{
  const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);
  const result=Array(values.length).fill(0) as number[];
  for(let start=0;start<sorted.length;){
    let end=start+1;
    while(end<sorted.length&&sorted[end].value===sorted[start].value)end++;
    const averageRank=(start+1+end)/2;
    for(let index=start;index<end;index++)result[sorted[index].index]=averageRank;
    start=end;
  }
  return result;
}

function standardDeviation(values:number[]):number{
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  return Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length);
}

const SYNC_WEIGHTS={pearson:0.4,spearman:0.3,returnDifference:0.3} as const;

export function compareStocks(first:ComparisonStock,second:ComparisonStock,sessions=30){
  const secondByDate=new Map(second.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0).map(bar=>[bar.date,bar.close]));
  const common=first.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0&&secondByDate.has(bar.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-(sessions+1));
  const points=common.map(bar=>({date:bar.date,firstClose:bar.close,secondClose:secondByDate.get(bar.date)!}));
  // Price ratios use the requested session count; the extra baseline close belongs only to returns.
  const ratioPoints=points.slice(-sessions);
  const priceRatioPoints=ratioPoints.map(point=>({date:point.date,ratio:point.firstClose/point.secondClose}));
  const averagePriceRatio=ratioPoints.length===sessions?ratioPoints.reduce((sum,point)=>sum+point.firstClose/point.secondClose,0)/sessions:null;
  const currentPriceRatio=points.length?points.at(-1)!.firstClose/points.at(-1)!.secondClose:null;
  const priceRatioDate=points.at(-1)?.date??null;
  const daily=points.slice(1).map((point,index)=>({first:point.firstClose/points[index].firstClose-1,second:point.secondClose/points[index].secondClose-1}));
  const chart=points.map(point=>({date:point.date,first:(point.firstClose/points[0].firstClose-1)*100,second:(point.secondClose/points[0].secondClose-1)*100}));
  const count=daily.length;
  const firstReturns=daily.map(row=>row.first);
  const secondReturns=daily.map(row=>row.second);
  const correlation=pearson(firstReturns,secondReturns);
  const spearman=pearson(ranks(firstReturns),ranks(secondReturns));
  const returnDifferenceVolatility=count>=15?Math.sqrt(daily.reduce((sum,row)=>sum+(row.first-row.second)**2,0)/count):null;
  const smoothed=daily.slice(2).map((_,index)=>({
    first:(daily[index].first+daily[index+1].first+daily[index+2].first)/3,
    second:(daily[index].second+daily[index+1].second+daily[index+2].second)/3,
  }));
  const smoothedFirst=smoothed.map(row=>row.first);
  const smoothedSecond=smoothed.map(row=>row.second);
  const smoothedPearson=pearson(smoothedFirst,smoothedSecond);
  const smoothedSpearman=pearson(ranks(smoothedFirst),ranks(smoothedSecond));
  const smoothedDifferenceVolatility=smoothed.length>=15?standardDeviation(smoothed.map(row=>row.first-row.second)):null;
  const typicalSmoothedVolatility=smoothed.length>=15?(standardDeviation(smoothedFirst)+standardDeviation(smoothedSecond))/2:null;
  const returnDifferenceSimilarity=smoothedDifferenceVolatility!==null&&typicalSmoothedVolatility!==null&&typicalSmoothedVolatility>0
    ?Math.max(0,Math.min(1,1-smoothedDifferenceVolatility/typicalSmoothedVolatility)):null;
  const synchronizationRate=smoothedPearson!==null&&smoothedSpearman!==null&&returnDifferenceSimilarity!==null
    ?Math.round(100*(SYNC_WEIGHTS.pearson*(smoothedPearson+1)/2+SYNC_WEIGHTS.spearman*(smoothedSpearman+1)/2+SYNC_WEIGHTS.returnDifference*returnDifferenceSimilarity)):null;
  const sameDirection=count?daily.filter(row=>row.first*row.second>0||(row.first===0&&row.second===0)).length/count*100:null;
  const firstChange=count?chart.at(-1)!.first:null;
  const secondChange=count?chart.at(-1)!.second:null;
  return {points:chart,priceRatioPoints,sessionCount:count,averagePriceRatio,currentPriceRatio,priceRatioDate,priceRatioSessionCount:ratioPoints.length,correlation,spearman,returnDifferenceVolatility,smoothedSessionCount:smoothed.length,smoothedPearson,smoothedSpearman,smoothedDifferenceVolatility,returnDifferenceSimilarity,synchronizationRate,synchronizationWeights:SYNC_WEIGHTS,sameDirection,firstChange,secondChange,spread:firstChange!==null&&secondChange!==null?firstChange-secondChange:null};
}

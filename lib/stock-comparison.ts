export type ComparisonBar={date:string;close:number};
export type ComparisonStock={code:string;name:string;market:'TWSE'|'TPEX';bars:ComparisonBar[]};
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

const SYNC_WEIGHTS={pearson:0.2,spearman:0.2,twoDayLogReturn:0.3,sameDirection:0.3} as const;

function normalizedDtw(first:number[],second:number[]):number|null{
  if(first.length!==second.length||first.length<30)return null;
  const minMax=(values:number[])=>{
    const low=Math.min(...values),high=Math.max(...values),span=high-low;
    return values.map(value=>span===0?0:(value-low)/span);
  };
  const a=minMax(first),b=minMax(second),cost=Array.from({length:a.length+1},()=>Array(a.length+1).fill(Number.POSITIVE_INFINITY) as number[]),length=Array.from({length:a.length+1},()=>Array(a.length+1).fill(0) as number[]);
  cost[0][0]=0;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    const predecessors=[[cost[i-1][j-1],length[i-1][j-1]],[cost[i-1][j],length[i-1][j]],[cost[i][j-1],length[i][j-1]]].sort((left,right)=>left[0]-right[0]);
    cost[i][j]=predecessors[0][0]+(a[i-1]-b[j-1])**2;
    length[i][j]=predecessors[0][1]+1;
  }
  return length[a.length][b.length]?Math.sqrt(cost[a.length][b.length]/length[a.length][b.length]):null;
}

export function compareStocks(first:ComparisonStock,second:ComparisonStock,sessions=30,weightTotalPercent=130){
  const totalPercent=Math.max(100,Math.min(130,Math.round(weightTotalPercent/10)*10));
  const weightScale=totalPercent/100;
  const secondByDate=new Map(second.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0).map(bar=>[bar.date,bar.close]));
  const common=first.bars.filter(bar=>Number.isFinite(bar.close)&&bar.close>0&&secondByDate.has(bar.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-(sessions+1));
  const points=common.map(bar=>({date:bar.date,firstClose:bar.close,secondClose:secondByDate.get(bar.date)!}));
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
  const twoDayLogReturns=points.slice(2).map((point,index)=>({first:Math.log(point.firstClose/points[index].firstClose),second:Math.log(point.secondClose/points[index].secondClose)}));
  const sameDirection=count?daily.filter(row=>row.first*row.second>0||(row.first===0&&row.second===0)).length/count:null;
  const twoDayLogReturnDifferenceVolatility=twoDayLogReturns.length>=15?standardDeviation(twoDayLogReturns.map(row=>row.first-row.second)):null;
  const typicalTwoDayLogVolatility=twoDayLogReturns.length>=15?(standardDeviation(twoDayLogReturns.map(row=>row.first))+standardDeviation(twoDayLogReturns.map(row=>row.second)))/2:null;
  const returnDifferenceSimilarity=twoDayLogReturnDifferenceVolatility!==null&&typicalTwoDayLogVolatility!==null&&typicalTwoDayLogVolatility>0
    ?Math.max(0,Math.min(1,1-twoDayLogReturnDifferenceVolatility/typicalTwoDayLogVolatility)):null;
  const synchronizationWeights={pearson:SYNC_WEIGHTS.pearson*weightScale,spearman:SYNC_WEIGHTS.spearman*weightScale,twoDayLogReturn:SYNC_WEIGHTS.twoDayLogReturn*weightScale,sameDirection:SYNC_WEIGHTS.sameDirection*weightScale};
  const synchronizationRate=smoothedPearson!==null&&smoothedSpearman!==null&&returnDifferenceSimilarity!==null&&sameDirection!==null
    ?Math.round(totalPercent*(SYNC_WEIGHTS.pearson*(smoothedPearson+1)/2+SYNC_WEIGHTS.spearman*(smoothedSpearman+1)/2+SYNC_WEIGHTS.twoDayLogReturn*returnDifferenceSimilarity+SYNC_WEIGHTS.sameDirection*sameDirection)):null;
  const firstChange=count?chart.at(-1)!.first:null;
  const secondChange=count?chart.at(-1)!.second:null;
  const dtwDistance=normalizedDtw(points.slice(-30).map(point=>point.firstClose),points.slice(-30).map(point=>point.secondClose));
  return {points:chart,sessionCount:count,correlation,spearman,returnDifferenceVolatility,smoothedSessionCount:smoothed.length,smoothedPearson,smoothedSpearman,twoDayLogReturnDifferenceVolatility,returnDifferenceSimilarity,synchronizationRate,synchronizationWeights,synchronizationWeightTotalPercent:totalPercent,sameDirection:sameDirection===null?null:sameDirection*100,dtwDistance,firstChange,secondChange,spread:firstChange!==null&&secondChange!==null?firstChange-secondChange:null};
}

export const isEtfCategory=(category:string|undefined)=>/ETF/i.test(category||'');

export const eligibleComparisonCode=(code:string,category:string|undefined)=>
 /^[1-9]\d{3}$/.test(code)||isEtfCategory(category)&&/^\d{4,6}[A-Z]?$/.test(code);

export const comparisonCodeFromInput=(value:string)=>value.match(/^\s*(\d{4,6}[A-Z]?)/i)?.[1]?.toUpperCase()||'';

export type ComparisonSymbol={code:string;name:string;market:'TWSE'|'TPEX';isEtf:boolean};
export type ComparisonInfoRow={stock_id?:string;stock_name?:string;type?:string;date?:string;industry_category?:string};

export function recentComparisonSymbols(rows:ComparisonInfoRow[]):ComparisonSymbol[]{
 const valid=rows.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date||''));
 const latest=valid.map(row=>row.date!).sort().at(-1);
 if(!latest)return [];
 const cutoff=new Date(`${latest}T00:00:00Z`);
 cutoff.setUTCDate(cutoff.getUTCDate()-30);
 const cutoffDate=cutoff.toISOString().slice(0,10);
 const selected=new Map<string,ComparisonInfoRow>();
 for(const row of valid){
  if(row.date!<cutoffDate||!row.stock_id||!row.stock_name)continue;
  if(row.type!=='twse'&&row.type!=='tpex')continue;
  if(!eligibleComparisonCode(row.stock_id,row.industry_category))continue;
  if(!selected.has(row.stock_id)||row.date!>selected.get(row.stock_id)!.date!)selected.set(row.stock_id,row);
 }
 return [...selected.values()].map((row):ComparisonSymbol=>({code:row.stock_id!,name:row.stock_name!,market:row.type==='twse'?'TWSE':'TPEX',isEtf:isEtfCategory(row.industry_category)})).sort((a,b)=>a.code.localeCompare(b.code,'zh-TW',{numeric:true}));
}

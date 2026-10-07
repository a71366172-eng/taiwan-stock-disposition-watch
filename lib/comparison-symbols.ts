export const isEtfCategory=(category:string|undefined)=>/ETF/i.test(category||'');

export const eligibleComparisonCode=(code:string,category:string|undefined)=>
 /^[1-9]\d{3}$/.test(code)||isEtfCategory(category)&&/^\d{4,6}[A-Z]?$/.test(code);

export const comparisonCodeFromInput=(value:string)=>value.match(/^\s*(\d{4,6}[A-Z]?)/i)?.[1]?.toUpperCase()||'';

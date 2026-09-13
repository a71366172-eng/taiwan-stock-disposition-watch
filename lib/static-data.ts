import type {MarketSnapshot} from './market-types';

type Env={VITE_SUPABASE_URL?:string;VITE_SUPABASE_ANON_KEY?:string};
const env=(import.meta as ImportMeta&{env?:Env}).env||{};

function valid(value:unknown):value is MarketSnapshot{
  const v=value as Partial<MarketSnapshot>|null;
  return !!v&&typeof v.asOf==='string'&&Array.isArray(v.stocks)&&Array.isArray(v.todayNotices);
}

export async function loadLatestSnapshot(fallback?:MarketSnapshot){
  const url=env.VITE_SUPABASE_URL?.replace(/\/$/,'');
  const key=env.VITE_SUPABASE_ANON_KEY;
  if(url&&key){
    try{
      const response=await fetch(`${url}/rest/v1/market_snapshots?select=payload&order=data_date.desc,created_at.desc&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
      if(response.ok){const rows=await response.json() as {payload:unknown}[];if(valid(rows[0]?.payload))return {snapshot:rows[0].payload,storage:'supabase' as const};}
    }catch{/* Fall through to the published snapshot. */}
  }
  try{
    const response=await fetch('./data/market.json',{cache:'no-store'});
    if(response.ok){const value=await response.json();if(valid(value))return {snapshot:value,storage:'snapshot' as const};}
  }catch{/* The bundled snapshot remains usable offline. */}
  if(fallback)return {snapshot:fallback,storage:'bundled' as const};
  throw new Error('找不到可用的市場快照');
}

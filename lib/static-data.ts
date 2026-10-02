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
  let database:MarketSnapshot|undefined;
  if(url&&key){
    try{
      const response=await fetch(`${url}/rest/v1/market_snapshots?select=payload&order=data_date.desc,created_at.desc&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
      if(response.ok){const rows=await response.json() as {payload:unknown}[];if(valid(rows[0]?.payload))database=rows[0].payload;}
    }catch{/* Fall through to the published snapshot. */}
  }
  let published:MarketSnapshot|undefined;
  try{
    const response=await fetch('./data/market.json',{cache:'no-store'});
    if(response.ok){const value=await response.json();if(valid(value))published=value;}
  }catch{/* The bundled snapshot remains usable offline. */}
  // Supabase is append-only, so its latest row can still lag behind a newer
  // static deployment when publishing was skipped or credentials expired.
  // Compare trading date first, then generation time, before choosing a source.
  if(database&&published){
    const newest=database.asOf>published.asOf||(database.asOf===published.asOf&&database.generatedAt>=published.generatedAt);
    return newest?{snapshot:database,storage:'supabase' as const}:{snapshot:published,storage:'snapshot' as const};
  }
  if(database)return {snapshot:database,storage:'supabase' as const};
  if(published)return {snapshot:published,storage:'snapshot' as const};
  if(fallback)return {snapshot:fallback,storage:'bundled' as const};
  throw new Error('找不到可用的市場快照');
}

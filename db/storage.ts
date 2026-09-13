import {env} from 'cloudflare:workers';
import seed from '../data/market.json';
import type {MarketSnapshot,Simulation} from '../lib/market-types';
export const bundledSnapshot=seed as MarketSnapshot;
function db(){if(!env.DB)throw new Error('資料庫尚未連線');return env.DB;}
export async function saveSnapshot(snapshot:MarketSnapshot){
 const payload=JSON.stringify(snapshot);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
 const id=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 await db().prepare('INSERT INTO market_snapshots (id,data_date,created_at,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,snapshot.asOf,snapshot.generatedAt,payload).run();
}
export async function readSnapshot(){
 try{
  await saveSnapshot(bundledSnapshot);
  const row=await db().prepare('SELECT payload FROM market_snapshots ORDER BY data_date DESC,created_at DESC LIMIT 1').first<{payload:string}>();
  if(!row)throw new Error('尚無快照');
  return {snapshot:JSON.parse(row.payload) as MarketSnapshot,storage:'persisted' as const};
 }catch(error){console.error('Snapshot storage unavailable',error instanceof Error?error.message:'unknown');return {snapshot:bundledSnapshot,storage:'unavailable' as const};}
}
export async function saveSimulation(value:Simulation){
 const id=crypto.randomUUID(),createdAt=new Date().toISOString();
 await db().prepare('INSERT INTO simulations (id,code,target_date,created_at,payload) VALUES (?,?,?,?,?)').bind(id,value.code,value.targetDate,createdAt,JSON.stringify(value)).run();
 return {id,createdAt};
}
export async function listSimulations(){
 const rows=await db().prepare('SELECT id,code,target_date,created_at,payload FROM simulations ORDER BY created_at DESC LIMIT 30').all<{id:string;code:string;target_date:string;created_at:string;payload:string}>();
 return rows.results.map(r=>({...r,payload:JSON.parse(r.payload)}));
}

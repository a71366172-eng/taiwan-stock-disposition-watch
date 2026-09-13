import type {Simulation} from './market-types';
const KEY='tw-stock-watch-simulations-v1';
export type SavedSimulation={id:string;code:string;target_date:string;created_at:string;payload:Simulation};
export function listLocalSimulations():SavedSimulation[]{
  try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.slice(0,30):[];}catch{return [];}
}
export function saveLocalSimulation(payload:Simulation){
  const row={id:crypto.randomUUID(),code:payload.code,target_date:payload.targetDate,created_at:new Date().toISOString(),payload};
  localStorage.setItem(KEY,JSON.stringify([row,...listLocalSimulations()].slice(0,30)));
  return row;
}

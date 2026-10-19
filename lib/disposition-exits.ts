import type {Disposition} from './market-types';
import {tradingReferenceDate} from './disposition-status.ts';

export type RecentDispositionExitGroup={date:string;offset:number;items:Disposition[]};

/** Returns stocks whose first normal-trading session after disposition is within -3 to +5 sessions. */
export function recentDispositionExits(dispositions:Disposition[],calendar:string[],asOf:string,futureSessions:string[],now:Date=new Date()):RecentDispositionExitGroup[]{
  const past=calendar.filter(date=>date<=asOf).sort();
  if(!past.length)return [];
  const today=tradingReferenceDate(asOf,futureSessions,now);
  const sessions=[...new Set([...past,...futureSessions.filter(date=>date>asOf)])].sort();
  const todayIndex=sessions.indexOf(today);
  if(todayIndex<0)return [];
  const latestByCode=new Map<string,Disposition>();
  for(const item of dispositions){
    if(!item.end)continue;
    const previous=latestByCode.get(item.code);
    if(!previous||item.announced>previous.announced)latestByCode.set(item.code,item);
  }
  const groups=new Map<string,RecentDispositionExitGroup>();
  for(const item of latestByCode.values()){
    const endIndex=sessions.indexOf(item.end!);
    const exitDate=endIndex>=0?sessions[endIndex+1]:undefined;
    if(!exitDate)continue;
    const offset=sessions.indexOf(exitDate)-todayIndex;
    if(offset < -3 || offset > 5)continue;
    const group=groups.get(exitDate)||{date:exitDate,offset,items:[]};
    group.items.push(item);
    groups.set(exitDate,group);
  }
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(group=>({...group,items:group.items.sort((a,b)=>a.code.localeCompare(b.code,'zh-Hant',{numeric:true}))}));
}

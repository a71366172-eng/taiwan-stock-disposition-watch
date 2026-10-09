import type {Disposition} from './market-types';

export type RecentDispositionExitGroup={date:string;offset:number;items:Disposition[]};

/** Returns stocks whose disposition end date is within -3 to +5 trading sessions. */
export function recentDispositionExits(dispositions:Disposition[],calendar:string[],asOf:string,futureSessions:string[]):RecentDispositionExitGroup[]{
  const past=calendar.filter(date=>date<=asOf).sort();
  const today=past.at(-1);
  if(!today)return [];
  const sessions=[...new Set([...past,...futureSessions.filter(date=>date>today)])].sort();
  const todayIndex=sessions.indexOf(today);
  const relevant=new Map<string,{item:Disposition;offset:number}>();
  for(const item of dispositions){
    if(!item.end)continue;
    const endIndex=sessions.indexOf(item.end);
    if(endIndex<0)continue;
    const offset=endIndex-todayIndex;
    if(offset < -3 || offset > 5)continue;
    const previous=relevant.get(item.code);
    if(!previous||item.announced>previous.item.announced)relevant.set(item.code,{item,offset});
  }
  const groups=new Map<string,RecentDispositionExitGroup>();
  for(const {item,offset} of relevant.values()){
    const group=groups.get(item.end!)||{date:item.end!,offset,items:[]};
    group.items.push(item);
    groups.set(item.end!,group);
  }
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(group=>({...group,items:group.items.sort((a,b)=>a.code.localeCompare(b.code,'zh-Hant',{numeric:true}))}));
}

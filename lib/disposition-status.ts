import type {Disposition} from './market-types';

/** Use one Taiwan-date cutoff across the watch and official disposition lists. */
export function dispositionReferenceDate(asOf:string,now:Date=new Date()):string{
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return asOf>today?asOf:today;
}

/** A disposition remains active through its final trading session and expires after the 13:30 close. */
export function activeDispositions(dispositions:Disposition[],referenceDate:string,sessions:string[]=[],now:Date=new Date()):Disposition[]{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??'';
 const today=`${value('year')}-${value('month')}-${value('day')}`;
 const afterClose=today===referenceDate&&sessions.includes(today)&&Number(value('hour'))*60+Number(value('minute'))>=13*60+30;
 return dispositions.filter(item=>Boolean(item.start&&item.end&&item.start<=referenceDate&&item.end>=referenceDate&&!(afterClose&&item.end===today)));
}

/** Shift the observation date to the next market session once the Taiwan night session starts. */
export function tradingReferenceDate(asOf:string,futureSessions:string[],now:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??'';
 const today=`${value('year')}-${value('month')}-${value('day')}`;
 const afterNightStart=Number(value('hour'))>=15;
 const next=futureSessions.filter(date=>date>asOf&&(afterNightStart?date>today:date>=today)).sort()[0];
 return next&&((today>asOf)||afterNightStart)?next:asOf;
}

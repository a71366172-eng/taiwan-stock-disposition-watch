import type {Disposition} from './market-types';

/** Use one Taiwan-date cutoff across the watch and official disposition lists. */
export function dispositionReferenceDate(asOf:string,now:Date=new Date()):string{
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return asOf>today?asOf:today;
}

export function activeDispositions(dispositions:Disposition[],referenceDate:string):Disposition[]{
 return dispositions.filter(item=>Boolean(item.start&&item.end&&item.start<=referenceDate&&item.end>=referenceDate));
}

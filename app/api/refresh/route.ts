import {readSnapshot,saveSnapshot} from '../../../db/storage';
import {refreshOfficial} from '../../../lib/live-refresh';
let pending:Promise<Response>|null=null;let nextCheck=0;
export async function POST(){
 if(pending)return (await pending).clone();
 if(Date.now()<nextCheck)return Response.json({message:'剛剛已檢查資料，請稍後再試。',changed:false});
 pending=(async()=>{const {snapshot}=await readSnapshot();try{const next=await refreshOfficial(snapshot);const changed=next!==snapshot;if(changed)await saveSnapshot(next);nextCheck=Date.now()+5*60*1000;return Response.json({snapshot:next,changed,message:changed?'已取得新的完整資料批次。':'官方行情日期未變更，保留目前完整批次。'});}catch(error){nextCheck=Date.now()+60000;return Response.json({changed:false,error:error instanceof Error?error.message:'官方來源暫時無法連線，已保留上一版資料。'},{status:503});}})();
 try{return (await pending).clone();}finally{pending=null;}
}

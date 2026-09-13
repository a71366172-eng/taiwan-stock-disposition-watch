import {readSnapshot,saveSimulation} from '../../../db/storage';
import {simulate} from '../../../lib/rules';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>10000)return Response.json({error:'請求內容過大'},{status:413});
 let input:{code?:string;scenario?:unknown;save?:boolean};
 try{const text=await request.text();if(text.length>10000)throw new Error('請求內容過大');input=JSON.parse(text);}catch{return Response.json({error:'請求格式錯誤'},{status:400});}
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.code!=='string'||(input.save!==undefined&&typeof input.save!=='boolean'))return Response.json({error:'請求欄位格式錯誤'},{status:400});
 const {snapshot}=await readSnapshot();const stock=snapshot.stocks.find(s=>s.code===input.code);if(!stock)return Response.json({error:'找不到此資料批次中的股票'},{status:404});
 try{const result=simulate(stock,snapshot,input.scenario);if(!input.save)return Response.json({result,saved:false});
  try{const record=await saveSimulation(result);return Response.json({result,saved:true,record});}catch{return Response.json({result,saved:false,warning:'試算完成，但資料庫目前無法保存紀錄。'});}
 }catch(error){return Response.json({error:error instanceof Error?error.message:'試算失敗'},{status:400});}
}

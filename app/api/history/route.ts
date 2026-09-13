import {listSimulations} from '../../../db/storage';
export async function GET(){try{return Response.json({records:await listSimulations()});}catch{return Response.json({records:[],error:'紀錄暫時無法讀取'},{status:503});}}

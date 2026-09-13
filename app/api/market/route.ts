import {readSnapshot} from '../../../db/storage';
export async function GET(){const value=await readSnapshot();return Response.json(value,{headers:{'Cache-Control':'private, max-age=60'}});}

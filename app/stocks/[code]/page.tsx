import {notFound} from 'next/navigation';
import {readSnapshot} from '../../../db/storage';
import {simulate} from '../../../lib/rules';
import {StockDetail} from '../../../components/stock-detail';
export const dynamic='force-dynamic';
export default async function StockPage({params}:{params:Promise<{code:string}>}){const {code}=await params;const {snapshot}=await readSnapshot();const stock=snapshot.stocks.find(s=>s.code===code);if(!stock||!stock.close)notFound();return <StockDetail key={`${stock.code}-${snapshot.generatedAt}`} stock={stock} snapshot={snapshot} initial={simulate(stock,snapshot)}/>;}

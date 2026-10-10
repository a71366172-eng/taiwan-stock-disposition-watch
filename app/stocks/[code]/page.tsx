import {notFound} from 'next/navigation';
import {readSnapshot} from '../../../db/storage';
import {simulate} from '../../../lib/rules';
import {StockDetail} from '../../../components/stock-detail';
import {EtfDetail} from '../../../components/etf-detail';
export const dynamic='force-dynamic';
export default async function StockPage({params}:{params:Promise<{code:string}>}){const {code}=await params;const {snapshot}=await readSnapshot();const stock=snapshot.stocks.find(s=>s.code===code);if(stock?.close)return <StockDetail key={`${stock.code}-${snapshot.generatedAt}`} stock={stock} snapshot={snapshot} initial={simulate(stock,snapshot)}/>;if(/^\d{4,6}[A-Z]?$/i.test(code))return <EtfDetail code={code.toUpperCase()} asOf={snapshot.asOf}/>;notFound();}

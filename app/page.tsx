import {readSnapshot} from '../db/storage';
import {Dashboard} from '../components/dashboard';
export const dynamic='force-dynamic';
// This dynamic Server Component intentionally stamps each HTTP request for the initial stale-data check.
// eslint-disable-next-line react-hooks/purity
export default async function Home(){const {snapshot,storage}=await readSnapshot();return <Dashboard initial={snapshot} storage={storage} servedAt={Date.now()}/>;}

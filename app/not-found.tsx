/* Full document navigation refreshes server snapshots and avoids the observed Vinext client-navigation regression. */
/* eslint-disable @next/next/no-html-link-for-pages */
import {SiteShell} from '../components/site-shell';
export default function NotFound(){return <SiteShell><section className="panel empty-state"><h1>此股票尚未收錄</h1><p>目前提供當日注意、官方處置候選與已公告處置普通股。</p><a className="primary-link" href="/">返回觀測清單 →</a></section></SiteShell>;}

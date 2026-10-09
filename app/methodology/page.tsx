import {SiteShell} from '../../components/site-shell';
import {RULES_URL,RULESET_VERSION} from '../../lib/rules';

const sections=[
 {id:'basics',label:'基本觀念'},
 {id:'thresholds',label:'處置門檻'},
 {id:'measures',label:'處置措施'},
 {id:'reading',label:'本站判讀'},
 {id:'knowledge',label:'交易知識'},
];

export default function Methodology(){
 return <SiteShell active="methodology">
  <div className="page-heading"><div><div className="eyebrow">RULES & KNOWLEDGE</div><h1>處置規則與交易知識<span className="heading-dot">.</span></h1><p>先看懂注意與處置的差別，再核對官方條件和個股狀態。</p></div></div>
  <div className="reading-grid">
   <article className="panel prose-card rules-knowledge-card">
    <section id="basics"><h2>注意股不等於處置股</h2><p>「注意」是交易所或櫃買中心依監視標準公布交易資訊，提醒市場留意異常；「處置」是達到相關門檻或經主管會議決議後，交易所正式公告採取交易措施。單一個股頁的試算價格不會自行使股票進入處置。</p><div className="knowledge-callout"><strong>判斷順序</strong><span>官方注意公告 → 累計注意紀錄 → 官方處置公告 → 公告所列措施與期間</span></div></section>
    <section id="thresholds"><h2>一般處置門檻</h2><p>上市與上櫃一般股票的常見累計路徑，依現行作業要點包括：</p><ul><li><strong>第一款連續注意：</strong>連續 3 個營業日，依第一款公布注意交易資訊。</li><li><strong>第 1 至第 8 款累計：</strong>連續 5 個營業日、最近 10 個營業日內有 6 日，或最近 30 個營業日內有 12 日依第 1 至第 8 款公布注意交易資訊。</li></ul><p>同一營業日即使符合多款，累計的是該日是否發布符合計次範圍的注意資訊，不會把同一天重複算成多日。第 9 至第 14 款的注意資訊不直接併入上述第 1 至第 8 款累計門檻。</p><div className="knowledge-callout"><strong>官方候選清單</strong><span>交易所會公布累計注意次數可能達處置標準的標的；候選是提醒資訊，實際處置仍看次一營業日的正式公告。</span></div></section>
    <section id="measures"><h2>第一次與再次處置</h2><p>處置措施和期間依市場、累計次數、個別原因及正式公告而異。常見措施包含延長撮合間隔、一定委託數量以上預收款券，以及信用交易相關限制。再次處置可能採取更嚴格的措施；請勿只憑「首次／再次」標籤推定撮合間隔或預收標準。</p><p>處置期間遇到停止買賣、全日暫停交易或休市等情形，公告期間可能順延；個股頁的出關日期依已取得的處置資料與交易日曆推算，應以交易所更新資料為準。</p></section>
    <section id="reading"><h2>本站清單和預測怎麼看</h2><ul><li><strong>官方處置：</strong>以交易所或櫃買中心公告資料判定，公告內容優先於本站試算。</li><li><strong>官方累計候選：</strong>代表官方公布的可能達標提醒，不等同已經處置。</li><li><strong>預計達標日與必關標籤：</strong>以已知注意紀錄推估後續條件情境；不是正式公告，也不保證下個交易日會被處置。</li><li><strong>個股條件試算：</strong>依可取得的收盤價、成交量、基本資料及已實作規則估算。缺資料、公告例外、特殊交易狀態或未涵蓋規則會使結果不完整。</li></ul><p>目前規則引擎版本：{RULESET_VERSION}。通過程式測試只表示程式符合已實作的計算規格，不代表預測準確率或投資報酬已經驗證。</p></section>
    <section id="knowledge"><h2>幾個實用知識點</h2><div className="knowledge-grid"><div><strong>營業日不是日曆日</strong><p>累計 10 日、30 日等窗口依交易日計算；週末與休市日不算交易日。</p></div><div><strong>停止交易會影響日期</strong><p>股票暫停交易時，處置期間與「下一個交易日」的判讀需依官方交易日安排順延。</p></div><div><strong>價格門檻不等於唯一條件</strong><p>不少注意款次同時包含量能、週轉率、集中度或市場差幅；價格到達仍可能未達整款條件。</p></div><div><strong>資料缺漏要保留未知</strong><p>沒有公告或來源資料時應視為「資料不足」，不應直接解讀成無風險。</p></div></div></section>
    <section id="official"><h2>官方資料與規章</h2><p className="rules-links"><a href={RULES_URL} className="text-link" target="_blank" rel="noreferrer">證交所注意交易資訊暨處置作業要點 ↗</a><a href="https://www.tpex.org.tw/storage/eb_data/11508/11500051351.html" className="text-link" target="_blank" rel="noreferrer">櫃買中心 2026 年 8 月規則修正公告 ↗</a><a href="https://www.twse.com.tw/announcement/notetrans?response=html" className="text-link" target="_blank" rel="noreferrer">證交所官方注意與累計候選公告 ↗</a><a href="https://www.twse.com.tw/announcement/punish?response=html" className="text-link" target="_blank" rel="noreferrer">證交所官方處置公告 ↗</a></p><p className="rules-disclaimer">本頁為規則摘要與資料使用說明，不取代法規原文、個別公告或專業意見。規則修正時請以兩市場最新公告為準。</p></section>
   </article>
   <aside className="side-column rules-side-column">
    <section className="focus-card"><h2>快速導覽</h2><nav aria-label="處置規則頁面導覽">{sections.map(section=><a key={section.id} href={`#${section.id}`}>{section.label}<span>→</span></a>)}</nav></section>
    <section className="timeline-card"><h3>記住這三件事</h3><ol className="simple-steps"><li>注意公告與正式處置公告是不同階段。</li><li>注意日數要看款次、期間與是否計次。</li><li>正式結果以交易所／櫃買中心公告為準。</li></ol><a href="#/status">查看資料狀態 ↗</a></section>
   </aside>
  </div>
 </SiteShell>;
}

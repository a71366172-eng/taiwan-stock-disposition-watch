import {SiteShell} from '../../components/site-shell';
import {RULES_URL,RULESET_VERSION} from '../../lib/rules';

export default function Methodology(){
 return <SiteShell active="methodology">
  <div className="page-heading"><div><div className="eyebrow">HOW IT WORKS</div><h1>理解每一個價格門檻<span className="heading-dot">.</span></h1><p>先確認累計路徑，再試算下一次注意的條件。</p></div></div>
  <div className="reading-grid">
   <article className="panel prose-card">
    <h2>注意 ≠ 處置</h2>
    <p>注意股代表交易異常達公告標準；處置則是累計特定注意次數或其他規定後，依正式公告採取交易措施。單一價格通常無法獨立決定處置。</p>
    <h2>明日會不會達到計次？</h2>
    <p>一般路徑包含第一款連續三日、第 1–8 款連續五日、十個營業日內六日或三十個營業日內十二日。同日多個款次只計一天；第 9–14 款不直接套用這四個一般門檻。</p>
    <p>本網站直接標示證交所官方處置候選，並提供一般計次重建。重建尚未涵蓋處置期間、特定公告不計次等全部除外，不以重建結果取代官方候選。</p>
    <h2>首次與再次處置</h2>
    <p>依目前已知交易日曆回看 30 個營業日：期間內有處置公告標為「再次處置」，否則標為「首次處置」。這是介面上的預先分類，實際預收方式、撮合間隔及例外仍以正式處置公告為準。</p>
    <h2>目前可以試算什麼？</h2>
    <ul>
     <li><strong>第一款：</strong>六日各日報酬百分比先向零截至小數兩位再加總，套用 32% 或 25% 加 50 元價差分支，及市場／同類差幅條件。實際產業分類、每日本益比與企業行動仍須核對。</li>
     <li><strong>第六款：</strong>本益比、股價淨值比及產業淨值比比較分支。必須另外滿足週轉率至少 5%、成交量至少 3,000 交易單位等條件。</li>
     <li><strong>第二款：</strong>保留擴充介面，待長期企業行動與除外條件驗證完成後開放。</li>
    </ul>
    <h2>價格是如何找出來的？</h2>
    <p>枚舉正常 ±10% 範圍內的合法升降單位價格，以分數運算檢查嚴格大於及大於等於邊界，合併連續成立區間。此版本不適用無漲跌幅限制、特殊交易狀態或未處理的除權息情況。</p>
    <p>小數處理慣例由初始批次歷史公告交叉核對：24 筆具備完整六日資料的公告相符，54 筆因資料窗口或條件不足略過。這是計算口徑校對，尚非完整預測回測。</p>
    <h2>情境假設</h2>
    <p>預設市場及同類六日漲跌幅為 0%，市場本益比為 30 倍、市場淨值比為 2 倍、產業淨值比為 3 倍。這些是供操作試算的假設值，並非已取得的官方平均，也不等於大盤指數報酬。請依需求修改。</p>
    <h2>時間與版本</h2>
    <p>交易日 T 盤後資料預測 T+1 收盤後是否達標，若公告則依公告於後續交易日執行。依 2026 年 8 月 10 日生效版本，處置期間、撮合間隔與預收方式須以個別正式公告為準。</p>
    <p>計算版本：{RULESET_VERSION}。目前未提供預測準確率；通過程式邊界測試不代表已通過跨期間回測。</p>
    <a href={RULES_URL} className="text-link" target="_blank" rel="noreferrer">閱讀證交所注意交易資訊詳細標準 ↗</a>
   </article>
   <aside className="side-column">
    <section className="focus-card"><h2>讀取結果的三個步驟</h2><ol className="simple-steps"><li>確認是否在官方處置候選清單。</li><li>檢查試算價格區間及目前假設。</li><li>逐項核對量能、除外條件與正式公告。</li></ol></section>
    <section className="timeline-card"><h3>尚未涵蓋</h3><p>上櫃規則、其餘注意款次、完整企業行動、特殊決議與公開會員系統。</p><a href="/status">查看資料來源與狀態 ↗</a></section>
   </aside>
  </div>
 </SiteShell>;
}

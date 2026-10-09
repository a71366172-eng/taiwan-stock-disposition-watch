# 台股處置觀測站

公開網站｜[立即使用](https://a71366172-eng.github.io/taiwan-stock-disposition-watch/) · [股票對比](https://a71366172-eng.github.io/taiwan-stock-disposition-watch/#/compare) · [資料來源與狀態](https://a71366172-eng.github.io/taiwan-stock-disposition-watch/#/status)

觀察台灣上市、上櫃普通股的注意資訊與處置公告，查看風險排序、個股價格條件試算、處置期間指標，並比較兩檔股票近期走勢。資料以交易所公開資訊為主；預測與統計指標供研究參考，不代表投資建議或保證進入處置。

> 正式處置以證交所或櫃買中心公告為準。股價與條件試算可能受除權息、交易狀態及公告規則影響；使用前請核對官方資訊。

### 更新自訂細產業分類

本機更新 `D:\AI\trading\STOCK\觀察名單_概念股.csv` 或 `D:\AI\trading\STOCK\產業細類別.csv` 後，可執行 `powershell -ExecutionPolicy Bypass -File D:\AI\trading\site\scripts\publish_personal_groups.ps1` 立即同步，或等待每日 20:00 的本機排程。腳本會驗證兩個檔案並上傳來源；GitHub Actions 產生 `public/data/personal-groups.json`、建置並部署。GitHub Actions 無法直接讀取本機 `D:`。對比頁選股視窗提供原本概念分類、產業細類別及注意股／處置股三個清單。產業細類別來自使用者匯出的分類 CSV，不等同官方產業分類。

此電腦也可執行 `scripts/install_personal_groups_daily.ps1` 建立 Windows 工作排程，每天本機時間 20:00 自動執行上傳腳本；內容未變時不提交。排程需要電腦可用、使用者已登入且能連線 GitHub；錯過執行時間會在下次可執行時補跑。執行結果記錄於 `D:\AI\trading\STOCK\personal-groups-update.log`。

## 網站功能

- **注意股觀測**：依官方注意公告與可能達到處置條件的先後順序查看上市、上櫃股票，可搜尋、排序及管理本機自選股。
- **個股分析**：查看收盤走勢、注意紀錄與處置歷史，試算特定收盤價下可能符合的條件；可直接開啟該股票在 TradingView 的 K 線圖。
- **處置股清單**：查看公告期間、距離處置結束的日數、處置期間漲跌，以及 5／10 日漲幅、20MA 乖離率與三大法人 5 日買賣超等指標，並可排序、篩選。
- **股票對比**：任選兩檔上市或上櫃股票，比較最近 30 個共同交易日的累積漲跌、Pearson（幅度同步）、Spearman（排序同步）及報酬差波動度。
- **個人資料留在瀏覽器**：自選股和本機試算紀錄不會上傳到網站資料庫。

股票對比使用 FinMind 公開 API 提供的未還原收盤價；除權息可能影響比較結果。若共同資料不足，相關指標會留空，不以短樣本代替 30 日結果。相關性是歷史描述，不能單獨證明存在可交易套利機會。

## 專案特色

- 上市與上櫃注意股觀測、官方處置候選、當日注意、處置中／已公告清單；風險名單依可能達到處置門檻的先後順序排列，並提供搜尋、排序、本機自選股，以及首次／再次處置篩選。
- 個股計次進度、原始收盤走勢、注意原因、正式處置歷史。
- 第一款六日漲跌幅與第六款產業估值比較分支的條件式價格區間。
- 可編輯市場／產業假設及下一交易日參考價；試算在瀏覽器執行，紀錄只保存在本機。
- GitHub Actions 平日盤後更新，Supabase 保存 SHA-256 去重的公開快照，GitHub Pages 發布靜態站。
- 靜態快照回退、來源追蹤、資料不足保留前批次、明確缺值狀態。
- Python 完整資料採集器、規則邊界測試及公告計算口徑校對。

首頁以注意股觀測為主，風險名單依最早可能達標日排序：官方候選以兩個市場各自的官方累計候選清單為準；其餘日期以後續持續符合可計次注意作條件情境，逐日滑動 10／30 日窗口，屬預警推估而非官方候選。價格仍是下一交易日的條件式試算：其餘款次、全部企業行動、完整不計次例外與跨期間回測仍需擴充。

## 自動更新與發布

GitHub Actions 依臺北時間每日排程執行資料更新、驗證、建置及 GitHub Pages 部署；排程會受 GitHub Actions 執行延遲影響。官方資料端點不可用或格式變動時，workflow 會保留前次已驗證快照。資料交易日與最近批次時間可在網站「資料來源與狀態」頁查看。

後續 UI 改版方向與使用者提供的參考截圖整理在 [docs/ui-reference.md](docs/ui-reference.md)，截圖保存在 `docs/ui-reference/`。

## 技術與資料庫

| 層級 | 實作 |
|---|---|
| 前端 | React 19、TypeScript、Vite、Tailwind、Radix 元件、Recharts |
| 發布 | GitHub Pages 靜態網站 |
| 規則 | 獨立 `lib/rules.ts`，BigInt 分數運算、合法升降單位枚舉 |
| 資料庫 | Supabase Free（PostgreSQL）；公開唯讀快照，service role 僅供 Actions 寫入 |
| 批次採集 | Python 標準函式庫，不需要付費行情金鑰 |
| 排程 | GitHub Actions，每日多個時段採集、驗證、部署 |

瀏覽器只需要 Supabase anon key，且 RLS 僅允許讀取公開市場快照；service role key 不會打包進前端。自選股與試算紀錄只存在當前瀏覽器，不會上傳到資料庫。

## 本機執行

Node.js >= 22.13，npm、Git；Python 3 只在完整採集時需要。

```powershell
cd D:\AI\trading\site
npm run install:ci
npm run build
npm run dev -- --port 5174
```

開啟 http://localhost:5174 。正式建置輸出位於 `dist-static/`。未設定 Supabase 時，網站會讀取 `public/data/market.json`；設定後優先讀取最新資料庫快照。

Supabase 專案先執行 `supabase/migrations/0001_market_snapshots.sql`，GitHub repository 設定 `SUPABASE_URL`（Actions variable）、`SUPABASE_ANON_KEY` 與 `SUPABASE_SERVICE_ROLE_KEY`（Actions secrets），再把 Pages Source 設為 GitHub Actions。不要把 service role key 寫入檔案或前端環境。

## 資料更新

GitHub Actions 依臺北時間每日排程重新取得公告及行情，驗證後才提交公開快照並部署。首頁「更新」只重新讀取已發布的靜態檔或 Supabase，不會從使用者瀏覽器直接大量呼叫交易所。相同交易日仍可能有盤後修正，因此保留手動執行 workflow 的入口。

完整採集（涵蓋公告修正與較長歷史）：

```powershell
python jobs/collect_market.py
node --experimental-strip-types jobs/verify_snapshot.ts
npm run build
```

採集器自動判斷最新行情交易日，不任意把今天當作交易日；URL 原始回應快取於 `work/raw/` 一小時，歷次輸出在 `work/snapshots/`，最後原子替換 `data/market.json`。同日重新採集如需略過快取，可在確認後移除該日對應的快取檔。重新建置／部署會以新快照啟動並匯入資料庫；已有較新日期的資料庫批次優先。

排程定義在 `.github/workflows/update-and-deploy.yml`。新 repository 第一次使用前仍需建立 Supabase 表、設定三個 GitHub 變數／密鑰並啟用 Pages。

## 免費來源

- [證交所 OpenAPI](https://openapi.twse.com.tw/)：日行情、本益比／淨值比、公司基本資料、休市表、除權息表。
- [注意公告](https://www.twse.com.tw/announcement/notice?response=html)：公告日期、款次及完整原因。
- [明日處置候選](https://www.twse.com.tw/announcement/notetrans?response=html)：官方累計候選，優先於本網站一般計次重建。
- [處置公告](https://www.twse.com.tw/announcement/punish?response=html)：處置期間與正式措施。
- [詳細標準與除外情形](https://twse-regulation.twse.com.tw/TW/law/DAT0201.aspx?FLCODE=FL007226)。
- [公布注意與處置作業要點](https://twse-regulation.twse.com.tw/TW/law/DAT0201.aspx?FLCODE=FL007225)。
- [櫃買中心 OpenAPI](https://www.tpex.org.tw/openapi/)：上櫃行情、本益比／淨值比、注意、累計候選與處置公告。
- [上櫃官方累計候選](https://www.tpex.org.tw/zh-tw/announce/market/warning.html)。

不需要購買第三方 API；公開端點可暫停、改版或限制流量。公開網站的再利用與商用授權需按來源使用條款另行核對，免費存取不等於無限制再散布。

試算預設市場／同類六日漲跌 0%、市場 PE 30、市場 PB 2、產業 PB 3。**這些都是假設值**，不是官方平均或模型預測。正式產品應接上按發行單位數加權的市場／產業統計，以及明日量能情境。

## 驗證

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test tests/rules.test.ts
node --experimental-strip-types jobs/verify_snapshot.ts
npm run build
```

`data/verification.json` 是 2026-09-11 初始批次的校對記錄：24 筆完整六日公告全部相符，54 筆因窗口或條件不足略過。每日報酬百分比向零截至兩位再加總的口徑是由此歷史樣本驗證，尚未宣稱掌握交易所全部內部小數計算規格。這份報告不代表未來處置預測準確率。

參考價預設由當日收盤價推估；特別交易狀態、無漲跌幅、除權息或減資需核對。第六款保存的是估值分支情境，成交量、週轉率、集中度不可由單一價格推得。一般計次尚未套用全部排除公告，官方候選及最終處置公告始終優先。

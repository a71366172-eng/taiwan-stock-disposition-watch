# 處置觀測站

台股普通股注意／處置的盤後觀測與條件式價格試算。介面參考 attstock.tw 的公開清單、個股計次流程，資料直接採用證交所公開來源，未擷取其登入後內容。

## 已實作

- 官方處置候選、當日注意、處置中／已公告清單；搜尋、排序、本機自選股，以及依最近 30 個已知營業日推估的首次／再次處置篩選。
- 個股計次進度、原始收盤走勢、注意原因、正式處置歷史。
- 第一款六日漲跌幅與第六款產業估值比較分支的條件式價格區間。
- 可編輯市場／產業假設及下一交易日參考價；REST API 試算與保存。
- D1 永久保存行情批次與試算紀錄；同一批次以 SHA-256 去重。
- 官方資料手動更新、來源追蹤、資料不足保留前批次、明確缺值狀態。
- Python 完整資料採集器、規則邊界測試及公告計算口徑校對。

這是第一版 MVP，**不是所有上市櫃股票的完整處置預測服務**。上櫃、其餘款次、全部企業行動、完整不計次例外、回測、會員隔離及排程仍需擴充。第二款介面已保留，但未通過企業行動與除外條件驗證，因此暫不輸出價格。

## 技術與資料庫

| 層級 | 實作 |
|---|---|
| 前端 | React 19、TypeScript、Vinext App Router、Tailwind、Radix 元件、Recharts |
| 後端 | Cloudflare Worker 上的 TypeScript REST 路由 |
| 規則 | 獨立 `lib/rules.ts`，BigInt 分數運算、合法升降單位枚舉 |
| 資料庫 | Cloudflare D1（SQLite），Drizzle schema／SQL migrations |
| 批次採集 | Python 標準函式庫，不需要付費行情金鑰 |
| 主機 | Sites 的 owner-private 專案；正式部署狀態依交付記錄 |

初始規劃的 Next.js + FastAPI + PostgreSQL 在第一版合併為同一個 Worker 與 D1，減少服務與外部帳號。日後可以把採集工作移到獨立 Python 排程，把 `db/storage.ts` 改成 PostgreSQL adapter；規則和介面可保留。Vinext 使用 Next 相容 API，但此專案是 Vite/Vinext 建置，不是直接 `next build`。

自選股只保存在當前瀏覽器；試算紀錄保存在伺服器資料庫。目前按私人單一使用者設計。改成多會員或公開寫入前，必須增加使用者欄位、伺服器端授權與配額；不可直接把目前的全部試算紀錄公開。

## 本機執行

Node.js >= 22.13，npm、Git；Python 3 只在完整採集時需要。

```powershell
cd D:\AI\trading\site
npm run install:ci
npm run build
# 新資料庫僅執行一次，之後只套用新增 migration
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sturdy_hammerhead.sql
npm start -- --port 5174
```

開啟 http://localhost:5174 。`npm run dev` 提供 5173 的熱更新預覽；與正式建置預覽共用 `.wrangler/state` 的本機資料庫。沒有 npm 時，在相依套件已安裝的本機可以直接 `node scripts/run-framework.mjs build`，以及上方 Wrangler 指令改為 `dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 5174 --inspector-port 0`。

`.openai/hosting.json` 保留既有 Sites project_id；不得重建同名專案。可攜式本機設定位於忽略的 `.sites-runtime/execution-profile.json`。正式環境由平台配置 D1，勿提交正式 database id、Token 或個人 `.env`。

## 資料更新

首頁「更新」先核對官方行情日期，日期前進後才重新取得公告及近兩個月行情。候選／行情不同日、公司分類、休市表或必要來源失敗時，保留舊批次。相同交易日保留快照，**不代表當日公告沒有後續修正**。

完整採集（涵蓋公告修正與較長歷史）：

```powershell
python jobs/collect_market.py
node --experimental-strip-types jobs/verify_snapshot.ts
npm run build
```

採集器自動判斷最新行情交易日，不任意把今天當作交易日；URL 原始回應快取於 `work/raw/` 一小時，歷次輸出在 `work/snapshots/`，最後原子替換 `data/market.json`。同日重新採集如需略過快取，可在確認後移除該日對應的快取檔。重新建置／部署會以新快照啟動並匯入資料庫；已有較新日期的資料庫批次優先。

目前未啟用無人值守排程。建議下一階段在臺北交易日 16:30、18:30 分批採集，加入公告完成狀態、重試告警與持久化工作鎖，再開啟自動更新。不要依賴有人打開瀏覽器才觸發每日資料管線。

## 免費來源

- [證交所 OpenAPI](https://openapi.twse.com.tw/)：日行情、本益比／淨值比、公司基本資料、休市表、除權息表。
- [注意公告](https://www.twse.com.tw/announcement/notice?response=html)：公告日期、款次及完整原因。
- [明日處置候選](https://www.twse.com.tw/announcement/notetrans?response=html)：官方累計候選，優先於本網站一般計次重建。
- [處置公告](https://www.twse.com.tw/announcement/punish?response=html)：處置期間與正式措施。
- [詳細標準與除外情形](https://twse-regulation.twse.com.tw/TW/law/DAT0201.aspx?FLCODE=FL007226)。
- [公布注意與處置作業要點](https://twse-regulation.twse.com.tw/TW/law/DAT0201.aspx?FLCODE=FL007225)。

不需要購買第三方 API；公開端點可暫停、改版或限制流量。公開網站的再利用與商用授權需按來源使用條款另行核對，免費存取不等於無限制再散布。

## API

| 路徑 | 用途 |
|---|---|
| GET `/api/market` | 當前資料批次與儲存狀態 |
| POST `/api/simulations` | `{code, scenario, save}`，傳回分支價格及限制 |
| GET `/api/history` | 最近 30 次已保存情境 |
| POST `/api/refresh` | 手動核對新交易日；每個 Worker instance 合併同時請求與短暫冷卻 |

試算預設市場／同類六日漲跌 0%、市場 PE 30、市場 PB 2、產業 PB 3。**這些都是假設值**，不是官方平均或模型預測。正式產品應接上按發行單位數加權的市場／產業統計，以及明日量能情境。

## 驗證

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test tests/rules.test.ts
node --experimental-strip-types jobs/verify_snapshot.ts
node scripts/run-framework.mjs build
```

`data/verification.json` 是 2026-09-11 初始批次的校對記錄：24 筆完整六日公告全部相符，54 筆因窗口或條件不足略過。每日報酬百分比向零截至兩位再加總的口徑是由此歷史樣本驗證，尚未宣稱掌握交易所全部內部小數計算規格。這份報告不代表未來處置預測準確率。

參考價預設由當日收盤價推估；特別交易狀態、無漲跌幅、除權息或減資需核對。第六款保存的是估值分支情境，成交量、週轉率、集中度不可由單一價格推得。一般計次尚未套用全部排除公告，官方候選及最終處置公告始終優先。

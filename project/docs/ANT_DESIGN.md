# Ant Design 遷移交接｜2026-10-01

## 本版範圍
使用者已明確授權開始套用 Ant Design。本次採漸進遷移，不變更案件資料格式與 PDF 引擎。

已使用真正 React／Ant Design 元件：
- 全站導覽 Menu。
- 工作總覽：Card、Statistic、Table、Tag、Select、Progress、Button。
- 案件管理：搜尋、狀態／建立者篩選、排序、10 件分頁及刪除選取。
- 案件內頁：檔案表格、DatePicker、操作、備份與紀錄。
- 建立／編輯案件資訊：Form、Input、Select、DatePicker、Steps。
- 成果匯出：Checkbox、原生 download 連結 Button、Progress、Alert、Collapse。
- 設定與外觀頁；三套既有品牌色透過 ConfigProvider 共用主題。
- 工作台及核對頁中選定的主要操作、旋轉、縮放和跳頁按鈕，以 React Button 相容層連接原事件；匯入及規則步驟列改用 Steps。

尚保留原生介面：PDF 畫布、富文字備註、圖面清單與屬性編輯器、匯入／規則詳細表單、客戶規則、知識庫、成員／AI 設定及原生對話框。這是第一階段遷移，不是全站已完全 React 化。它們沿用共用色彩與控制項樣式，後續逐模組替換。

## 架構
- src/ui/main.jsx：React 頁面、導覽及受限的舊按鈕相容層。
- src/ui/theme.js：單一 Ant Design token 設定。品牌色來自既有 appearance 偏好；狀態色不隨品牌改變。
- src/ui/ui.css：響應式布局與工作台周邊樣式；禁止改變圖面物件幾何。
- dist/ui-adapter.js：唯一資料／操作橋接器，讀取既有全域狀態，呼叫既有業務函式。新 UI 不直接重新實作 PDF 或寫入儲存。
- scripts/build-ui.mjs：esbuild 產生 dist/antd-ui.js 及 dist/antd-ui.css。
- dist/style.css：既有樣式收進 legacy cascade layer，防止通用按鈕／表格樣式蓋過 Ant Design。

渲染生命週期：釋放前一批 React roots → 執行既有 render 鏈及 PDF mount → 掛載 React 頁面／導覽／工具列。列表篩選只更新 React root，保持輸入焦點。不得新增 MutationObserver 掃描全部 DOM，或用 eval 把任意字串變成 React 事件。
按鈕相容層僅使用已生成 DOM 的 onclick 函式，不接管畫布、富文字、檔案輸入或其指標事件。移除相容層時，逐項遷移具名 action 後再刪。

## 安裝與執行
交付的 dist 已包含編譯產物，仍可直接 `python3 server/local.py`（Python 3.10+）。
修改 React 程式需要 Node.js（本次驗證 Node 24）與 npm：

```sh
npm ci
npm run build
npm test
npm run test:ui
python3 server/local.py
```

開啟 http://127.0.0.1:8765/ 。修改 src/ui 後必須重新 build；不要手動改編譯後 bundle。
package-lock.json 必須隨專案交付；不交付 node_modules、local-data 或機敏資料。
版本鎖定：React／React DOM 19.2.4、Ant Design 6.6.5。這是本次已安裝驗證版本，不代表之後應自動升級。

## 核心契約
沿用 AGENTS.md 的所有 PDF、確認、快取與備份契約。ZIP 維持 `案件名稱_NL_台灣下載當日YYYYMMDD.zip`。準備完 ZIP 後提供真正 href／download 的 anchor；不可在 await 後模擬點擊，不可再增加一次確認彈窗。
首頁最近案件最多 10 件；全部案件每頁 10 件。圖面清單按原 PDF 分組。禁止圓角左側強調邊條。原案件、IndexedDB、localStorage 名稱及備份格式不變。

## 驗證界線
- PDF 旋轉與工作流程回歸測試。
- jsdom DOM 整合測試：導覽、最近案件限制、篩選分頁、搜尋焦點、鍵盤開啟、原工作台、新建案件、原生下載屬性、主題及重掛載。
- DOM 測試不等同真實瀏覽器測試。需在 Mac 實測：桌面／窄螢幕樣式、真實 PDF Worker、捏合拖曳、中文備註、下載落盤、檔案解壓、還原及列印。
- 本環境缺少技能指定的瀏覽器驗收入口；不得將 DOM 測試稱為 Mac 視覺或下載驗收。

下一階段先遷移原生對話框及規則／設定表單，最後才處理工作台屬性面板。每次保留可回復提交，不要重寫 PDF 引擎或移除確認門檻。GitHub 仍須獨立確認同步結果，Sites 發布不代表 GitHub 已更新。

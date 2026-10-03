# 交接手冊

## 產品與範圍
服務精密模具廠業務助理，處理報價前的 PDF 遮蔽、備註、核對與成果匯出。核心流程：建立案件 → 匯入 PDF → 選規則 → 工作台修正 → 最終核對 → 匯出。
AI 推論、成員管理與登入權限目前屬原型，不能宣稱已完成正式服務。首頁每週處理量已標示示範資料。

## 最新版本 77
- 首頁四張統計卡的資訊提示各自對應待確認、處理失敗、可匯出及已匯出；點資訊圖示不進入案件列表。
- 圖表以 ResizeObserver 量測容器寬高調整尺寸。
- 「全部案件」右側新增箭頭圖示。
- 保留前版：最近案件最多 10 件與狀態切換；案件圖面整列開啟；多頁 PDF 群組；縮放區頁碼；響應式工作台；匯出備註收折；無二次確認彈窗。

## 技術架構與修改入口
| 檔案 | 責任 |
| --- | --- |
| src/ui/main.jsx | React / Ant Design 頁面、導覽及有限的原生按鈕相容層 |
| src/ui/theme.js、ui.css | 主題 token、布局及介面樣式 |
| dist/ui-adapter.js | 既有狀態與 React 的資料／操作橋接器 |
| dist/app.js | 既有路由、案件狀態、基礎編輯邏輯 |
| dist/pdf-workspace.js | 真實 PDF 匯入、工作台、匯出流程 |
| dist/workflow-tools.js | 旋轉、批次套用、歷史、最終成果快取 |
| dist/pdf-engine.js、pdf-worker.js | PDF 引擎與背景運算 |
| dist/project-backup.js、server/local.py | 案件備份與本機單人服務 |
| scripts/build-ui.mjs | 編譯 UI 與彙整套件授權 |

注意：dist 並非全部都是可丟棄的生成檔。antd-ui.js / antd-ui.css 是生成檔，其餘多個 JavaScript 仍是手寫原始碼；禁止刪除整個 dist 再 build。
React 19.2.4、Ant Design 6.6.5 已鎖定於 package-lock.json。正式修改讀 project/AGENTS.md、README.md、docs/HANDOFF.md、docs/ACCEPTANCE.md、docs/ANT_DESIGN.md。

## Ant Design 遷移狀態
已完成主要頁面與導覽。PDF 畫布、富文字備註、圖面清單、屬性編輯器、規則／匯入詳細表單及部分對話框仍採原生介面。不可把目前狀態描述成全站 React 化。
後續採逐模組遷移，優先對話框及規則／設定表單，再處理工作台屬性面板。保留明確 action 與資料橋接，避免重寫 PDF 引擎或大範圍掃描 DOM。

## 不可破壞的行為
- 最近案件最多 10 則，「全部案件」保留狀態篩選並分頁。
- 同一 PDF 以 sourceId 分組；case.files 一筆代表一頁，不是一份檔案。
- 所有修改、批次、復原或重做均使相關頁面確認失效；整份各頁都通過才能匯出。
- 旋轉以 90 度遞增；遮蔽、備註與文字方向同步。原始 PDF bytes 不改。
- 預覽使用實際生成的成果 PDF；未修改時匯出重用同一份快取。
- 每頁輸出單一 600 dpi 無損壓縮影像，保留尺寸與頁數；80MP 限制超出必須報錯，不得偷偷降解析度。
- 成果 ZIP：案件名稱_NL_台灣下載當日YYYYMMDD.zip，例如案件_20261001-04_NL_20261001.zip；內部 PDF 為原始 basename_NL.pdf。
- 先在頁面內準備 ZIP，完成後用真正 href/download 連結觸發下載；不加二次彈窗，不在 await 後模擬點擊。已發出下載要求不等於已儲存成功。
- 全站禁止圓角容器左側強調邊條；一般按鈕或卡片圓角並非全禁。
- 單頁不出現「整份連續預覽」。多頁清單不能拆成看似不同檔案。

## 資料移轉與正式化界線
網域、localhost 與不同瀏覽器的 IndexedDB/localStorage 互不相通。先在舊站下載案件備份 .drawing.zip，再在本機案件管理還原。還原建立新案件，不覆蓋原資料。
server/local.py 僅綁定本機，是單人測試服務；SQLite 保存備份索引，不是正式多人資料層。不要為方便分享改成對外綁定。
正式內網仍需伺服器資料層、真實登入與權限、版本衝突、備份復原、任務佇列及負載驗證。MuPDF 的既有授權文件須保留，企業交付前確認適用授權。

## 問題處理
- python3 不存在或低於 3.10：先安裝符合版本的 Python，再啟動。
- 8765 被占用：停止重複的服務後重試；不要任意清除資料。
- 修改 src/ui 沒反映：執行 npm run build，重新整理；不可直接修改 bundle。
- npm ci 失敗：保留 lockfile，檢查 Node/npm 及網路，記錄實際錯誤；不自動升級主版本。
- PDF Worker/WASM 失敗：確認以 HTTP 開啟且 dist/vendor 完整，記錄 console/network 錯誤。
- ZIP 下載未出現：用獨立瀏覽器頁籤，等待準備完成後點下載，查看下載清單；不可宣稱成功落盤。
- 記憶體或 80MP 超限：保留明確失敗結果，不交付殘缺成果。

## 後續交付
每次交付列出改動檔案、測試結果、未驗證項目與啟動方式。GitHub 目標為 https://github.com/ubechen/gam264mvp；先核對對方工作樹與分支，再合併此包，勿 force push 或覆蓋其未提交修改。本次僅提供可下載交接包，未更新 GitHub。

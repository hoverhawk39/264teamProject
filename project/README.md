# 報價圖面處理系統 — 本機測試與內網交接

目前版本包含真實 PDF 多頁編輯、旋轉、跨頁遮蔽、復原/重做、最終 PDF 預覽與匯出、案件備份。

## 啟動已建置版本（不需 npm install）

需要 Python 3.10+。在專案根目錄執行：

```sh
python server/local.py
```

macOS 若沒有 python 指令，使用 `python3 server/local.py`。
開啟 http://127.0.0.1:8765 。停止服務按 Ctrl+C。
首次測試也不需要外網下載前端依賴；PDF 引擎、WASM、JSZip 已在 dist/vendor。
此服務僅綁定本機，不是可直接對公司內網開放的正式多人版本。

## 網站資料搬移

1. 在原網站開啟案件，按「下載案件備份」，再點下載連結。
2. 本機版「案件管理 → 還原案件備份」，選取 .drawing.zip。
3. 還原會建立獨立案件，不覆蓋現有案件。
4. 案件頁「另存本機案件」把完整案件寫到 local-data/；SQLite 保存索引，原始 PDF 與編輯狀態在 ZIP。
5. 「開啟本機已存案件」可重新還原。日常「儲存進度」仍是瀏覽器進度，正式內網版須改成伺服器案件 API。

瀏覽器的 IndexedDB/localStorage 與網站來源綁定，不會自動出現在 localhost。請使用備份還原，不要直接清除瀏覽器資料。

## 驗證

需要 Node.js 支援 ES modules 與 WASM（測試環境 Node 24）：

```sh
node tests/pdf-rotation.mjs
node tests/workflow-state.cjs
```

另依 docs/ACCEPTANCE.md 實機驗收。通過程式測試不代表已通過紙本列印與100檔壓力測試。

## 原始碼

- dist/app.js：既有網站與基本編輯。仍有歷史功能覆寫，重構前先補行為測試。
- dist/pdf-workspace.js：PDF 檔案、Worker 呼叫、匯入匯出與頁面 UI。
- dist/workflow-tools.js：本次整併的旋轉、批次、操作歷史、連續預覽與最終 PDF 快取。
- dist/project-backup.js：可攜案件備份與本機測試服務連接。
- dist/pdf-engine.js：MuPDF 解析、白色不可逆遮蔽、向量原頁保留與可編輯 PDF 便利貼註解輸出。
- dist/pdf-worker.js：獨立處理程序入口。
- server/local.py：本機測試 API；SQLite 索引與案件檔保存。
- docs/HANDOFF.md：給夥伴與 Codex 的接手指引。

## 授權

MuPDF 採 AGPL／商業授權，參閱 dist/vendor/mupdf 內授權文件；企業交付前須確認授權方案。JSZip 授權在 dist/vendor/JSZip-LICENSE。勿因移除畫面連結而刪除必要授權文件。

## Ant Design 介面開發

已建置檔保存在 dist，可直接啟動。修改 src/ui 後執行 `npm ci`、`npm run build`；以 `npm run test:ui` 驗證介面整合。React 與 Ant Design 的範圍、橋接架構與實機驗收界線請讀 docs/ANT_DESIGN.md。

# 圖面編輯區（本機單頁版）

系統首頁直接進入獨立 PDF 圖面編輯器；其餘案件管理、工作總覽、案件工作台、詞庫分頁、設定及其專屬程式/API 已移除。上方保留復原、重做、清除進度、預覽、暫存及匯出操作；按鈕會轉送到同源編輯器的原有處理函式。

## 啟動

在 `project/` 執行 `python3 server/local.py`，開啟 `http://127.0.0.1:8765/`。服務只綁定本機，不可直接用於內網多人系統。已建置的 `dist/` 不需安裝 npm；修改 `src/ui/` 後須執行 `npm ci && npm run build`。勿以 `file://` 開啟首頁，否則 PDF Worker 和同源 AI API 不會正常工作。

如果舊版服務仍占用 8765 埠，請**先在舊頁儲存進度**，再手動停止並重新啟動；也可用 `python3 server/local.py --port 8766` 在另一埠驗證，但不同埠的瀏覽器資料彼此隔離。本次改版沒有停止原有程序，也沒有刪除瀏覽器儲存或 `local-data/`。

## 圖面與翻譯

編輯器提供上傳 PDF、白色遮蔽、便利貼、跨頁操作、翻譯草稿審查、完工預覽及匯出。按「翻譯本檔全部頁面」會先從 PDF 文字層／本機 Apple Vision OCR 擷取原文。私有客戶資料庫的英文若只有唯一中文譯文，優先採用；未命中或同一英文有不同中文譯文時，由本機 Ollama 模型處理並顯示警告。可讀取術語庫的整句中，唯一對應詞也會在 AI 翻譯期間受到保護。翻譯結果是待人工保留的草稿，未確認者不進完工圖。

首次配置術語庫：`python3 server/import_translation_database.py /path/to/建名專業用語說明_10_05_edited.csv`。生成的 `local-data/translation-database.json` 與案件舊資料不納入版本控制；不要上傳客戶 CSV/PDF。OCR 需要 macOS Apple Vision／Swift，AI 後備需要本機已安裝的 Ollama 模型。詳見 [docs/LOCAL_AI.md](docs/LOCAL_AI.md)。

## 舊資料與合併界線

本次只移除舊案件**程式與入口**；沒有刪除磁碟上的舊案件資料、私有術語庫或瀏覽器內已儲存的案件／圖面進度。舊案件不再有現成的開啟介面，若需要遷移，應從舊版本程式（Git 歷史）或原備份處理，不可直接清除資料。瀏覽器資料按來源（含埠）隔離；新版沿用同源編輯器及其進度鍵。Jack 的檔案尚未整合；本專案僅提供獨立編輯器，沒有預設案件或整合 API 契約。

## 驗證與原始碼

```
npm ci
npm run build
npm test
npm run test:ui
python3 -m unittest tests.test_editor_only_server tests.test_local_ai -q
```

- `src/ui/main.jsx`：單頁外框和同源 iframe 操作橋接；`src/ui/ui.css` / `theme.js`：外框樣式及按鈕主題。
- `dist/drawing-editor.html`、`dist/independent-editor-operations.js`、`dist/independent-pdf-engine.js`、`dist/independent-ai-overlay.js`：圖面編輯、匯出及翻譯流程。
- `server/local.py`：本機靜態頁、`/api/health`、`/api/ai/ocr`、`/api/ai/translate`；不再提供案件儲存 API。

MuPDF 採 AGPL／商業授權，企業交付前須確認授權方案；授權檔在 `dist/vendor/mupdf/LICENSE`，其他依賴授權見 `dist/OPEN_SOURCE.txt` 與 `dist/THIRD_PARTY_UI_LICENSES.txt`。請依 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) 另做實際 PDF／列印驗收。

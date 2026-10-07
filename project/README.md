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

## 獨立圖面編輯區：離線 AI 翻譯原型（需人工校對）

本機 macOS 須有 Apple Vision／Swift 工具鏈及已下載 `gemma3:4b` 的 Ollama 服務；選取 PDF 後在「圖面編輯區」按「翻譯本檔全部頁面」，會逐頁做文字層擷取與本機 OCR、分批請求本機模型。每批成功譯文立即成為透明底紅字可編輯草稿（保留原圖文字可見）；若想先檢查貼紙，按「完成目前翻譯批次並檢查草稿」，待目前批次結束即可編輯。失敗的原文逐筆列於「模型拒絕項目」，不會偽造譯文；再次執行會略過現有草稿，重試未處理來源。**尚未處理的頁面與失敗項目不算翻譯完成。**草稿不進預覽或匯出；在模型拒絕項目下方的「本檔 AI 翻譯」清單逐筆查看頁碼、原文、完整譯文，點列可跳頁並以藍框選取翻譯貼紙，右側僅有「刪除」操作；選取貼紙時，其下方也會出現「刪除」按鈕。按「新增翻譯貼紙」可建立同樣透明底紅字的手動草稿，須按「保留本頁所有翻譯」後才列入預覽與匯出。保留後拖曳、縮放、編輯譯文與調整字級均維持已確認狀態。可用「保留本頁所有翻譯」「刪除本頁所有翻譯」批次處理目前頁面的 AI 便利貼，不影響手動便利貼或其他頁；每批可整筆復原／重做，操作後需重新標記完稿。保留與匯出不再受重疊或文字溢出限制，也不會自動改變貼紙尺寸；外觀依固定尺寸裁切，完整文字仍保留在編輯資料與 PDF 註解內容，請自行校對及調整。原 PDF 底層文字仍存在，並非真正移除；尺寸、公差、料號與單位的 OCR 誤辨和混排仍需逐頁檢查。模型與術語品質尚未完成客戶圖面驗收。

翻譯優先使用私有的新版英中對照資料；英文寫法若僅有一個中文對應，直接採用；句中唯一對應的術語先保護譯文，再交由地端 Ollama 翻譯其他文字；無對應或多種中文對應則交給 Ollama，後者附上多義提醒。首次部署以 `python3 server/import_translation_database.py /path/to/建名專業用語說明_10_05_edited.csv` 匯入 `local-data/translation-database.json`；CSV 與 XLSX 內容相同，只需匯入 CSV。該目錄不納入版控；缺資料時翻譯 API 明確報錯，不會靜默改用其他詞庫。舊瀏覽器詞彙對照專用鍵於編輯器載入時移除，不清除編輯進度；「專業翻譯知識庫」分頁不參與翻譯。詳見 [docs/LOCAL_AI.md](docs/LOCAL_AI.md)。測試圖檔與客戶術語表不可納入版控。

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

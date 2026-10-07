# 接手：獨立圖面編輯區

首頁 (`dist/index.html`) 僅載入 `src/ui/main.jsx` 建置的外框與 `dist/drawing-editor.html`。原案件管理／工作台／設定／詞庫頁面及其檔案已從主程式移除；不要把它們當作仍可呼叫的整合介面。Jack 的檔案尚未提供，因此沒有共享案件格式或合併 API；後續整合先釐清資料生命週期，再建立明確的邊界。

保留的功能：PDF 上傳、遮蔽、便利貼、跨頁編輯、復原／重做、編輯進度暫存、預覽／匯出，以及同源 Apple Vision + Ollama 翻譯（私有術語優先、草稿人工審查）。React 外框僅負責可見的六個操作按鈕；真正的編輯與資料儲存仍在 iframe。兩邊的 DOM 以 `MutationObserver` 同步 disabled，點擊轉送原按鈕。若更改原按鈕 ID，須一併更新橋接與測試。

`server/local.py` 僅提供靜態頁、健康檢查及兩個 AI POST API。`local-data/`（含舊 `projects.sqlite3`、ZIP 或私有 `translation-database.json`）與瀏覽器進度不能刪；舊案件 UI/API 已移除，舊資料若需重新存取，請從 Git 歷史或既有備份單獨規劃遷移，切勿直接覆寫。

在 `project/`：`npm ci && npm run build && npm test && npm run test:ui`；Python 執行 `python3 -m unittest tests.test_editor_only_server tests.test_local_ai -q`。啟動 `python3 server/local.py --port 8766` 做隔離測試，避免中斷仍在 8765 的使用者作業。翻譯環境詳見 `docs/LOCAL_AI.md`；實機驗收詳見 `docs/ACCEPTANCE.md`。瀏覽器在 8766 的進度不等於 8765；不得據此聲稱已保存／清除原來源資料。

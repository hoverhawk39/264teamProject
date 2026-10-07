# 單頁圖面編輯器開發契約

修改前先讀 README.md、docs/LOCAL_AI.md、docs/HANDOFF.md、docs/ACCEPTANCE.md。

- 首頁只呈現獨立「圖面編輯區」，由 `src/ui/main.jsx` 的 React/Ant Design 外框載入同源 `dist/drawing-editor.html`。上方操作按鈕轉送編輯器的原有按鈕，並同步 disabled 狀態。不得恢復案件、設定、詞庫等舊分頁或 `server/local.py` 的 `/api/projects`。
- 保留 PDF 原始資料及未遮蔽區的向量內容；遮蔽須不可逆，便利貼／已確認的翻譯保持可編輯註解。預覽與匯出使用同一個 PDF builder。任何編輯、復原、重做都必須使原完稿狀態失效；整份檔案符合編輯器規則後才匯出。不得為大小目標默默降低輸出品質。
- 私有術語庫 `local-data/translation-database.json` 由 `server/import_translation_database.py` 匯入，**不能提交**。唯一英文→中文對應優先；歧義／未命中交本機 Ollama。資料庫不可用要明確報錯；翻譯草稿需人工校對和保留。不得將圖面送往雲端。
- 不清空、不覆蓋使用者現有 localStorage/IndexedDB 或 `local-data/`。舊案件開啟程式已移除，但舊資料仍在磁碟或瀏覽器；要遷移需單獨設計。
- 僅本機 loopback 單人測試，不是正式內網服務。不得向 LAN 開放，除非另行設計身份驗證、資料存取、衝突處理及安全審查。
- `npm run build && npm test && npm run test:ui && python3 -m unittest tests.test_editor_only_server tests.test_local_ai -q && git diff --check`。測試圖檔只能用合成資料。瀏覽器驗證用獨立埠與隔離 profile，不中止使用者原本的 8765 程序。

# GAM264 圖面作業台｜原始碼與 AI 交接包

日期：2026-10-01（台灣）｜網站版本：77
來源提交：a391a8e8f18c3a434bf8aa995924db1b71febee1
網站：https://gam264-drawing-desk.jackchen614.chatgpt.site

本包是上述已發布版本的程式快照，另附本次交接文件。不是舊 TraceFlow 展會專案。

## 給接手者
1. 先讀 `01_HANDOFF.md`。
2. 將 `02_AI_PROMPT.md` 全文交給能讀寫本機檔案及執行命令的 AI，並讓它開啟 `project/`。
3. 依 `03_ACCEPTANCE.md` 記錄驗收結果。

## Mac 直接執行
解壓縮 ZIP，在終端機切換至本包的 project 資料夾：

```sh
python3 --version
python3 server/local.py
```
需要 Python 3.10+。瀏覽器開啟 http://127.0.0.1:8765/；停止按 Ctrl+C。
已附編譯結果與 PDF 引擎，不須先安裝 npm 套件即可試用。請勿以雙擊 index.html 的方式執行。

## 修改介面
需要 Node.js/npm；本版開發驗證使用 Node 24。

```sh
npm ci
npm run build
npm test
npm run test:ui
```
安裝依賴需網路；如無網路可先使用已建置版本。不要刪除 lockfile 或自行升級依賴。

## 內容
- project/：完整應用原始碼、已建置介面、PDF/WASM 引擎、授權文件、測試及既有技術文件。
- 01_HANDOFF.md：架構、已完成與未完成、資料移轉、限制及後續工作。
- 02_AI_PROMPT.md：可直接交給另一個 AI 的執行提示詞。
- 03_ACCEPTANCE.md：本次自動驗證與 Mac 實機驗收清單。
- MANIFEST.sha256：各檔案 SHA-256，可在本包根目錄執行 `shasum -a 256 -c MANIFEST.sha256`。

本包不含個人案件、使用者 PDF、瀏覽器儲存資料、node_modules、Git 歷史或原站部署設定。網站資料需另外使用「下載案件備份／還原案件備份」搬移。
Sites 已發布不代表 GitHub 已同步；此包不宣稱已推送到 ubechen/gam264mvp。

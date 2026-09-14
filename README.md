# EduVideo Studio

EduVideo Studio 是一個以 Electron 為主的教學影片錄製與剪輯工具。它把簡報、講者人像、標記、時間軸、字幕與專案管理放在同一個工作流程中，適合製作課程、投影片解說與螢幕教學影片。

目前的重點不是直播，而是「錄製時看得到自己，剪輯時可以自由調整，最後再輸出成品」。

## 下載

最新版本請前往 [GitHub Releases](https://github.com/timcsy/EduVideo/releases/latest)。

| 版本 | 下載檔案 | 適用情境 |
| --- | --- | --- |
| Electron 桌面版 | EduVideo-Studio-macOS-arm64.dmg | Apple Silicon Mac，macOS 15 或更新版本 |
| Electron 桌面版（Windows 預覽） | EduVideo-Studio-Windows-x64-Setup.exe | Windows 10／11 x64，CPU 需支援 AVX2 |
| Web 版 | EduVideo-Studio-Web-版本.zip | 不安裝桌面程式，或要部署到靜態網站 |
| 原始碼 | [GitHub repository](https://github.com/timcsy/EduVideo) | 開發、測試與自行打包 |

桌面版目前是未簽章、未公證的 Electron 安裝檔。第一次開啟若被 macOS 阻擋，請在 Finder 對 App 按右鍵，選擇「打開」；也可以到「系統設定 → 隱私權與安全性」允許開啟。Windows 若出現 SmartScreen 警告，請選擇「其他資訊 → 仍要執行」。

Windows 上的 .eduv 專案是一般資料夾：用「開啟專案」選擇 .eduv 資料夾，舊的 .eduvideo／.zip 封裝檔改用「開啟封裝檔…」。

## 快速開始

### Electron 桌面版

1. 從 Releases 下載 DMG，拖曳 EduVideo Studio 到 Applications。
2. 第一次錄製時允許攝影機與麥克風權限。
3. 匯入 PDF 或投影片圖片，選擇錄製來源與講者人像。
4. 開始錄製；錄製過程可以看到簡報與鏡像後的人像，也可以使用標記工具。
5. 在剪輯頁調整片段、人像、背景、字幕與時間軸，最後輸出影片或保存 EduVideo 專案。

### 從原始碼執行 Electron

環境需求：

- Node.js 22 或更新版本
- Apple Silicon Mac
- macOS 15 或更新版本

    npm ci
    npm test
    npm run electron:dev

若只想預覽 Web 介面：

    npm ci
    npm run build:web
    npm start

然後開啟 http://127.0.0.1:4173/studio.html。

瀏覽器版需要透過 localhost 或 HTTPS 執行，直接用 file:// 開啟可能無法使用攝影機、麥克風、螢幕擷取與部分模型功能。

## 目前可以做什麼

### 錄製來源與桌面畫記

左側的「準備好的來源」可加入最多四個視窗／螢幕，加上內建簡報共五個來源，不占用中央預覽高度。先按「＋ 準備視窗／螢幕」授權分享，再按來源按鈕切換；錄製中也能切換，會保存為同一段影片，講者和麥克風持續錄製。來源清單保留到本次程式關閉；按來源旁的 × 會停止該來源分享。重新開啟程式後需要重新選擇來源。

簡報、視窗和螢幕都可在工作室預覽上使用標記工具。Electron 版另有「桌面小工具」：與工作室互斥顯示，離開工作室操作其他程式時，可使用桌面畫記、講者筆記、鏡像人像預覽、來源切換與簡報翻頁。錄製鍵固定顯示，可直接開始（未開啟相機時會先取得授權）、顯示倒數、停止保存；另有暫停／繼續。拖曳小工具標題可以改變位置；結束畫記後滑鼠會穿透畫記層，繼續操作底下的程式。

| 快捷鍵（小工具開啟時） | 操作 |
| --- | --- |
| ⌘／Ctrl + Shift + D | 開始／結束桌面畫記 |
| ⌘／Ctrl + Shift + N | 顯示／隱藏講者筆記 |
| ⌘／Ctrl + Shift + H | 在工作室與桌面小工具之間切換 |
| ⌘／Ctrl + Shift + 1–5 | 切換對應的準備來源 |

單一視窗的外部畫記需要先用「對齊視窗範圍」，拖曳及調整畫記層，對齊來源視窗的內容。來源視窗移動或縮放後需重新對齊；整個螢幕來源則自動對齊所選螢幕。標記會燒錄進畫面影片，停止錄製後不能從影片中移除。

整個螢幕錄製可能包含小工具或講者筆記。程式會要求系統排除這些視窗，但 macOS 的部分擷取方式會忽略此設定；需保密的筆記請放到未錄製的另一個螢幕，或改錄單一視窗。Web 版支援預覽畫記與來源切換，桌面浮動視窗及全域快捷鍵需使用 Electron。

右側錄製設定的「包含 EduVideo 相關畫面」只控制整個螢幕錄製時，是否允許工作室、小工具、人像預覽與筆記入鏡；不會開關人像預覽。系統可能無法排除 EduVideo 視窗（包含 macOS），請先試錄確認。小工具的相機圖示獨立開關鏡像預覽，沿用既有相機串流、不額外開啟攝影機，不影響人像原始錄製。返回工作室時，桌面小工具及其浮動人像／筆記一起收起；只保留一個房子圖示返回，停止錄製後自動回剪輯。切回工作室保留快捷鍵，進入剪輯或關閉工作室才釋放。

簡報側欄可拖曳排序，也可用上／下箭頭移動；支援在選取頁後插入 PDF（全部頁面）、多張圖片或空白頁，並可複製、刪除、復原／重做。選取頁面會切回簡報來源。焦點位於簡報側欄時，可用 ⌘／Ctrl+D 複製、Delete 刪除、Alt+↑／↓ 排序、⌘／Ctrl+Z 復原。頁面操作隨專案保存，不改動已錄製影片；錄製時可翻頁，但暫停結構編輯。

新的人像合成預設採鏡像，剪輯預覽與輸出使用相同設定。「成品鏡像」仍可取消；既有專案明確保存的設定優先。

### 其他功能

- 分開錄製簡報／螢幕與講者攝影機，降低即時 AI 去背造成的卡頓。
- 錄製預覽時同時看到簡報與講者；內部攝影機預覽採鏡像顯示。
- 講者人像去背、裁切、圓形或矩形外框、位置與大小調整。
- 使用預設背景或自訂圖片作為人像背景。
- 在簡報上繪圖、畫線、箭頭、矩形、圓形、文字與螢光標記。
- 以非破壞方式剪輯片段、移動時間軸上的人像、對齊音訊與畫面，以及使用播放頭預覽調整結果。
- 匯入、編輯、搜尋、定位與重新分段字幕。
- 使用瀏覽器端或桌面端的語音辨識；模型可依需求下載，不預先塞進安裝包。
- 以 .eduv 保存完整專案，保留媒體、字幕、標記、人像設定與剪輯資料。

## 錄製與剪輯概念

EduVideo 把內容分成幾條可以獨立調整的軌道：

    簡報／螢幕畫面 ─────────────────────────────
    講者人像       ─────────── 可移動、縮放、換背景
    音訊           ─────────────────────────────
    標記           ──────── 錄製時燒錄於畫面
    字幕           ─── 可搜尋、編輯、重新斷句與套用樣式

錄製時的畫面是預覽與操作介面；完成後仍可以在剪輯頁調整人像何時出現、放在哪裡、使用什麼背景，以及字幕的樣式與時間，不需要重新錄完整段影片。

## 字幕

字幕辨識不是用固定字數硬切。系統會優先依照語音停頓、標點語意、詞語時間與可讀性分段，再提供人工編輯。每段字幕可以調整文字、開始時間、結束時間與樣式。

模型採選用後下載的方式處理，不把大型語音模型預裝進桌面安裝檔。未來可以接入更高品質的離線模型，例如 Whisper 系列，也可以透過相關 API 完成辨識。

字幕仍建議在輸出前快速校對，尤其是專有名詞、數字、英文與多人同時說話的情況。

## .eduv 專案

.eduv 是 EduVideo 的專案副檔名。桌面版可以把專案當成類似 Logic Pro bundle 的資料夾保存，讓素材與設定放在同一個可搬移、可備份的專案中。

專案通常包含：

- 專案描述與版本資訊
- 匯入的簡報、圖片、影片與音訊素材
- 螢幕與攝影機錄製檔
- 時間軸、片段與播放頭狀態
- 人像去背、背景、位置與樣式設定
- 標記與字幕資料

請直接複製或備份整個 .eduv 專案，不要只抽出其中一個檔案。大型原始錄影也建議保留備份。

## Release 自動化

GitHub Actions 位於 .github/workflows/release.yml。當推送符合 package.json 版本的 tag 時，Action 會：

1. 在 macOS 與 Windows 分別安裝相依套件並執行測試。
2. 建置 Web 版並打包成 ZIP。
3. 使用 Electron Builder 建置 macOS Apple Silicon DMG。
4. 在 Windows 從釘選的 whisper.cpp 版本編譯 whisper-cli.exe，並在中文路徑下實際辨識一段語音，再建置 Windows x64 安裝檔。
5. 產生 SHA256SUMS.txt。
6. 在 GitHub 建立 Release 並附上所有下載檔案。

在 GitHub Actions 頁面手動執行此 workflow，只會建置並上傳安裝檔供測試，不會建立 Release。

例如 package.json 是 0.7.0：

    git checkout main
    git pull origin main
    git tag v0.7.0
    git push origin v0.7.0

tag 版本必須和 package.json 的 version 完全相同。Action 會在版本不一致時停止，避免產生名稱錯誤的安裝檔。

### 本機建置 Electron 安裝檔

    npm ci
    npm test
    npm run electron:build

輸出會放在 electron-dist。這個命令建置 macOS DMG；Windows 請在 Windows 上先依 .github/workflows/release.yml 的步驟編譯 native/speech/whisper-cli.exe，再執行 npm run electron:build:win。Linux 桌面版尚未發布。

## 開發指令

    npm ci                 安裝相依套件
    npm test               執行 Node.js 測試
    npm start              啟動 Web 開發伺服器
    npm run build:web      建置 dist Web 版本
    npm run electron:dev   啟動 Electron 開發模式
    npm run electron:build 建置 Electron macOS DMG

主要程式位置：

- electron：Electron 主程序、IPC 與原生媒體能力
- src：錄製、預覽、編輯器、字幕與專案資料模型
- scripts：Web 建置與開發伺服器
- test：資料模型、時間軸、字幕與專案格式測試
- knowledge：以繁體中文記錄產品願景、決策與開發經驗

## 已知限制

- 桌面下載版提供 macOS Apple Silicon（macOS 15+）與 Windows x64 預覽版；Linux 尚未發布。
- Windows 版的語音辨識使用 CPU，速度比 macOS 的 Metal 版本慢。
- Windows 無法把 .eduv 資料夾設定成雙擊開啟的檔案類型；可以從程式內開啟，或把資料夾拖到 EduVideo Studio 捷徑上。
- npm run electron:dev 使用 Unix shell 的環境變數寫法，Windows 開發時請在 PowerShell 改用 `$env:ELECTRON_DEV='1'; npx electron .`。
- 系統音訊擷取會受到瀏覽器、macOS 權限與錄製來源限制；若系統音訊不可用，仍可使用麥克風音訊。
- 去背品質取決於光線、背景複雜度、攝影機畫質與所選模型；分開錄製能減少即時預覽卡頓，但不會消除模型辨識誤差。
- 字幕斷句與辨識結果仍需人工校對。
- Tauri 目錄保留作為實驗性路徑；目前完整錄製與桌面下載流程以 Electron 為準。

## 專案狀態與回報

這是一個持續開發中的教學影片工具。目前版本可用於完整走過「匯入簡報 → 錄製 → 編輯 → 字幕 → 保存專案」流程，但仍在補強專業剪輯器常見的細節與跨平台支援。

- [下載最新 Release](https://github.com/timcsy/EduVideo/releases/latest)
- [回報問題或提出建議](https://github.com/timcsy/EduVideo/issues)
- [查看繁體中文產品文件](https://github.com/timcsy/EduVideo/tree/main/knowledge)

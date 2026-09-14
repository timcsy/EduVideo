# 004：從 Tauri 跨平台設定到 Electron 跨平台桌面主線

> 日期：2026-09-14

## 轉變

- **舊：**Electron、Tauri 與瀏覽器三條路徑並存，沒有定案哪一條是桌面產品。跨平台打包目標寫在 src-tauri/tauri.conf.json（nsis、dmg、appimage、deb），test/platform.test.js 也以它作為「桌面版宣告 Windows、macOS、Linux」的依據；實際發布的 Electron 桌面版只有 macOS Apple Silicon。
- **新：**Electron 是唯一的桌面產品，同時發布 macOS Apple Silicon 與 Windows x64；瀏覽器版保留為不安裝即可使用的路徑。Tauri 不再採用。

## 支援的執行環境矩陣（0.9.0）

| 執行環境 | 狀態 | 界線 |
|---|---|---|
| Electron macOS arm64 | 正式 | macOS 15+；whisper-cli 使用 Metal |
| Electron Windows x64 | 預覽 | CPU 需 AVX2；whisper-cli 由 CI 從釘選的 whisper.cpp 編譯，只用 CPU；.eduv 是一般資料夾，無法設定成雙擊開啟 |
| 瀏覽器（Chrome／Edge） | 正式 | 只能匯出 WebM；語音辨識走 WebAssembly；沒有桌面小工具與全域快捷鍵 |
| Linux | 未支援 | 見 [](../draft/2026-09-14-Linux桌面版.md) |

## 為什麼改變

錄製來源選擇、MP4 編碼、原生語音辨識、.eduv 資料夾讀寫與桌面小工具，全都已經實作在 Electron 主程序與 IPC 上；src-tauri 只有一個不含任何命令的 main.rs。Windows 支援的分析顯示，在 Electron 上缺的只是平台轉接層（執行檔名稱、asar 路徑分隔符號、Windows 命令列字碼頁、開檔對話框能力、單一實例開檔）與 CI 建置，而 Tauri 必須從頭重寫整個原生層。先前的桌面畫記工作也已經由使用者選定 Electron（[](../episodes/2026-09-14-桌面畫記與準備來源.md) 第 7 行）。

## ⚰️ 已拒絕：Tauri

- **曾考慮：**以 Tauri 取得較小的安裝檔與原生 WebView，並用它的 bundle targets 一次產生三平台安裝檔。
- **為什麼不採用：**所有桌面能力都要以 Rust 命令重寫一次，且各平台 WebView 的媒體擷取能力不一致；對目前的產品而言，Electron 已經證明能在 Windows 上完整運作，重寫沒有換到使用者看得到的收益。
- **後續清理：**src-tauri/、package.json 的 desktop:dev／desktop:build 指令與 test/platform.test.js 仍在程式碼中，需另外移除。

## 狀態

✅ 已採用（Electron 主線）／⚰️ 已拒絕（Tauri）

## 來源

- [](../episodes/2026-09-14-Windows桌面版支援.md)
- [](../experience.md)
- commit b11fd71

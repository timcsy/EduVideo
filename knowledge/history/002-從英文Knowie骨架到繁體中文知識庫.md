# 002：從英文 Knowie 骨架轉為繁體中文知識庫

> 日期：2026-09-12

## 轉變

- **舊：**Knowie 初始化與遷移產生的知識設定為 language: en；核心文件、範本、事件、草稿與概念內容以英文為主，子檔名也使用英文 slug。
- **新：**知識設定改為 language: zh-TW；專案知識正文、範本、AGENTS.md，以及 concepts、episodes、history、draft 的子檔名改用繁體中文。工具需要辨識的固定檔名與 SKILL.md 內容仍保留英文識別格式。

## 為什麼改變

專案的主要使用語言是繁體中文，英文知識文件會讓人與 AI 在閱讀設計理由、使用者回饋與未決事項時增加摩擦。保留 README.md、SKILL.md、.knowie.json 與工具命令名稱，是為了維持 Knowie 的標準載入與投影行為；其餘面向人閱讀的內容則應符合專案語言。

## 狀態

✅ 已採用

## 來源

- commit 1e3afec
- [](../vision.md)
- 本次對話中的語言修正要求

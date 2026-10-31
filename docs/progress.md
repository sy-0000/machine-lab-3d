# 階段 1 進度（unity-export）

若中斷，下次先讀本檔，從未勾選的項目接續。

- [x] 0. 建分支 unity-export（從 origin/feature/webxr）、npm install
- [x] 1. 匯出工具（src/dev/exportTool.js，僅 DEV；Vite dev 外掛把檔案寫進 exports/）
- [ ] 2. 無頭瀏覽器實際匯出，產出 docs/export-report.md、docs/export-manifest-example.json
- [x] 3. docs/unity-migration-plan.md
- [x] 4. docs/testing-guide.md
- [x] 5. npm test、npm run build 通過；build 產物不含匯出工具
- [ ] 6. docs/decisions.md、docs/known-bugs.md 整理完成
- [ ] 7. 推送 unity-export

## 驗證紀錄
- npm test：79 pass / 0 fail
- npm run build：成功；`grep -rl "__xrExport\|GLTFExporter\|__export/\|installExportTool" dist/` 無結果

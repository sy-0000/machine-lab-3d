# 階段 1 進度（unity-export）

若中斷，下次先讀本檔，從未勾選的項目接續。

- [x] 0. 建分支 unity-export（從 origin/feature/webxr）、npm install
- [x] 1. 匯出工具（src/dev/exportTool.js，僅 DEV；Vite dev 外掛把檔案寫進 exports/）
- [x] 2. 無頭瀏覽器實際匯出，產出 docs/export-report.md、docs/export-manifest-example.json
- [x] 3. docs/unity-migration-plan.md
- [x] 4. docs/testing-guide.md
- [x] 5. npm test、npm run build 通過；build 產物不含匯出工具
- [x] 6. docs/decisions.md、docs/known-bugs.md 整理完成
- [x] 7. 推送 unity-export

## 驗證紀錄
- npm test：79 pass / 0 fail
- npm run build：成功；`grep -rl "__xrExport\|GLTFExporter\|__export/\|installExportTool" dist/` 無結果
- 無頭瀏覽器完整匯出（Shift+A）：27 個 glb、約 218 MB、1,802,649 三角形（重新讀檔計算），耗時約 29 分鐘；機台設定節點全部存在於模型

# 階段 2 備檔（使用者要求階段 1、2 完成後一起測）
- [x] unity/MachineYard 專案骨架、Editor 設定／匯入／場景建置腳本、ExteriorDoors、FPS、README（未在 Unity 編譯驗證）
- [x] docs/testing-guide.md 第 7 節
- [ ] Unity 實機驗收（需使用者）

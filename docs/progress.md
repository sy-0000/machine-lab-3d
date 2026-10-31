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

# 階段 3 備檔（未在 Unity 驗證）
- [x] ProgressStore／SaveSlots／淡入淡出／站位／搖桿走動／瞬移／金庫門／告示板／放映幕／LobbyFlow／簡易選單／LobbySceneBuilder
- [x] unity/README.md 階段 3、testing-guide 第 8 節、decisions D14–D17
- [ ] Unity 編譯與 Quest 實機驗收（需使用者）

# 階段 4（車床互動）
- [x] Core 純數學 + dotnet 測試（79,022 項比對 JS 標準答案、突變測試）
- [x] 匯出工具修正：略過隱藏節點、userData 巢狀、machine_*_runtime.json
- [x] LatheMachine／切削／工件網格／手輪抓握／面板／WorkshopBuilder（型別檢查通過，未在 Unity 執行）
- [x] 完整重新匯出（27 glb、1,689,921 三角形、約 32 分鐘）與 export-report 更新
- [ ] Unity 編譯與 Quest 實機驗收（需使用者）

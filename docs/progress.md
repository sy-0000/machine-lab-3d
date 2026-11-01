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

# 階段 5（銑床、鑽床、工具箱、特效、音訊、存檔）
- [x] Core：槌頭毛胚與銑削／鑽孔／攻牙（對 JS 逐步比對）、彈簧回位、機台合成音、存檔 DTO 與驗證（總計 115 萬項比對／檢查、突變測試）
- [x] LatheMachine 擴充（toggle、彈簧手柄、套筒延伸）、HeadMachining、刀具、毛胚網格、面板、MachineSwitcher
- [x] 特效（切屑、火花、蒸汽、灰塵）、機台音訊、工具箱流程、3 格存檔 UI、WorkshopBuilder 三台機台＋鐵座
- [x] 型別檢查通過（手寫 Unity API 替身）
- [ ] 光束／爐火火星／翻牌板 3D UI（見 D26、D28，留待實機後決定）
- [ ] Unity 編譯與 Quest 實機驗收（需使用者）

# 階段 5 之後的修正
- [x] 網站 VR 選單點擊無反應（Menu.js pendingRun）修正
- [x] Unity 互動改用自己的射線指標（trigger 點擊、grip 抓住）
- [x] 車床局部座標精度、車床接觸光圈、銑鑽床新工件防呆
- [x] 移動：暗角、只用瞬移、自由瞬移、握手輪時鎖定、轉向方式
- [x] 中文字型（Noto Sans TC 子集 + TMP 建立選單）、只支援 Quest 3、放映幕影片（網站動畫錄製）
- [x] 銑床握桿檢查：舊握桿 Head_Part_023 由設定檔刻意隱藏，現用握桿正常（known-bugs #4）
- [ ] Unity 編譯與 Quest 實機驗收（需使用者）

# 第二批修正（門、出口、自我檢查、減面、選單測試）
- [x] 幾何離線檢查（scripts/check-geometry.mjs）：鑽頭位置正確；車床工件未插進夾頭 → Unity 往內推 40 mm（known-bugs #5）
- [x] 金庫門往外開（含退後與回來時關門）、工作室拱門出口
- [x] 指到發亮、Unity 自我檢查選單、EditMode 測試、asmdef 參照修正
- [x] 減面版本（exports/lod）與 Detail 切換、遮擋剔除烘焙選單
- [x] 網站選單回歸測試（tests/xr-menu.spec.js，突變檢查會失敗）
- [x] 門的造型統一：拱形防爆鋼門（方案 1，只改 Unity，D41）
- [ ] Unity 編譯與 Quest 實機驗收（需使用者）

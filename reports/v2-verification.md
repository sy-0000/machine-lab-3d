# 第二版驗證紀錄

日期：2026-09-18。Windows、Node.js 22.20、Chromium，測試使用專案內瀏覽器引擎。

- 修改前基線：Git commit 4ba2985，tag v1.0.0。
- npm test：19 / 19 通過，包含 13 項原車床幾何回歸與 6 項共用核心測試。
- npm run audit:models：車床 182 / 172、銑床 422 / 422、鑽床 62 / 42（節點 / Mesh）；操作設定缺少參照皆為 0。另逐項核對新銑床 manifest 的 422 個名字。
- npm run test:browser：13 / 13 通過（完整最終測試 2.4 分鐘）。三台載入流程未捕捉到 pageerror 或 console.error。
- npm run build：成功。Three.js/R3F 共用 3D chunk 約 970 kB，有 Vite 大型 chunk 提示，並非建置失敗；首頁延後載入 3D 頁面。
- 正式輸出模型及 JSON 約 50.4 MB；舊 159 MB 銑床及未使用貼圖不再進入 dist。

核心驗證：獨立 Pivot、握把歸屬、左右反向、行程端點、父子繼承、固定主軸箱、停止保留角度、完整重設、30/144 FPS、世界距離平移不變與缺少節點錯誤。

新版核心驗證：Object_103 升降但 Object_101 固定、刀座八次索引回到初始角度、急停後即使要求啟動仍維持零 RPM、鑽床彈簧回位、工作臺升降、新銑床工作臺成員連動。

瀏覽器驗證覆蓋首頁延後載入、三機真實 GLB、雙向手輪、滑桿、主軸、桌面滑鼠 Pointer Events、右鍵選單限制、失焦／取消恢復 OrbitControls、手機觸控取消與自動回位、旋轉縮放平移、相機重設、載入失敗及缺件報錯、黃色／紅色警告。

另外直接 raycast 點擊模型上的刀座、右側長桿、腳踏煞車、銑床與鑽床開關，並長按真實手柄，沒有使用程式直接修改模型的測試捷徑。鑽床舊測試原本預期放開後停留，已更新為新需求的自動回位。

截圖：home.png、lathe-shared.png、milling-shared.png、drill-shared.png、mobile-shared.png、v2-milling-interaction.png、v2-drill-interaction.png。v2 原始零件隔離圖另保留作對照依據。

限制：瀏覽器觸控模擬不等於實體手機驗證；未進行實機校正／物理碰撞測試。銑床 Z 手輪、合併膝座，以及真實導程／行程和新增套筒／腳踏尺寸仍待人工校正，詳見 v2-model-mapping.md。

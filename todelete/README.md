# 待使用者刪除的封存資料

這裡的檔案已從現用程式移出，沒有刪除。現用 npm run dev/build/test 不依賴此資料夾。

- models-v1：已被新版拆件模型取代的舊銑床 GLB 與 parts-map。保留供來源幾何比對；scripts/match-split.mjs 會讀取這個歷史來源，若刪除本資料夾就無法重新產生歷史比對，但不影響網站。
- original-milling-textures：新 GLB 不含 UV 或材質對應，因此目前不使用；日後 Blender 補 UV 時可能有用。
- legacy-ui：未接到共用網站的舊車床 React 元件／hook。
- reports-v1：第一版及之前的過期核對與測試報告，請以 reports/v2-* 為準。
- one-time-migration：已執行的第二版設定產生腳本，現用 JSON 為正式設定。不要再次執行覆蓋後續校正。

第一版完整內容另已由 Git 標籤 v1.0.0 保存。node_modules、瀏覽器測試引擎及 npm 快取是本機執行／測試工具，未列為廢棄模型。dist 為 build 產物，不必編輯，部署前重新 npm run build。
`legacy-analysis/` 保存早期幾何分析工具與對應截圖，已非網站或測試依賴；相對路徑僅保留歷史，需還原原位置才能重跑。

第三版：models-v2 保存無 UV 的原拆件銑床，新材質 GLB 已放在 public/models。材質還原腳本會讀取 models-v1、models-v2 與 original-milling-textures；網站及測試執行不需要這些封存來源，但刪除後不能重新執行來源轉換。configure-v3 是一次性遷移，不可重跑覆蓋正式 JSON。

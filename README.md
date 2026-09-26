# MACHINE LAB｜工具機 3D 互動教學

以 React、Vite、Three.js（React Three Fiber）製作的純前端教學網站：工安守則、工具盒、車床／銑床／鑽床 3D 加工教室，以及三個限時加工關卡（依尺寸誤差給 0–3 顆星）。

這是教學模擬，行程與進給不是校正過的實機數值，不能取代實機操作訓練。

## 開始使用

需要 Node.js 22.12+、Git 與 [Git LFS](https://git-lfs.com/)。3D 模型（`*.glb`）存在 LFS，一定要用 clone，不要下載 ZIP。

```powershell
git lfs install
git clone https://github.com/sy-0000/machine-lab-3d.git
cd machine-lab-3d
git lfs pull
npm ci
npm run dev
```

打開終端機顯示的網址（通常是 `http://localhost:5173/`）。若 `.glb` 打開只有幾行 `version https://git-lfs.github.com/spec/v1` 文字，代表模型沒下載，重新執行 `git lfs pull`。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 開發伺服器 |
| `npm test` | 單元測試 |
| `npm run test:browser` | 瀏覽器測試（第一次先執行 `npx playwright install chromium`） |
| `npm run build` | 建置到 `dist/` |
| `npm run optimize:models` | 由 `assets-src/` 的原始模型重新產生網頁用模型（不要手動改 `public/models/` 的 GLB） |

網站顯示的版本號取自 `package.json` 的 `version`。

## 協作與部署

1. 從最新的 `main` 開新分支修改。
2. 推送前跑 `npm test` 和 `npm run build`。
3. 推送分支後在 GitHub 建立 Pull Request，檢查後合併。

合併到 `main` 後，`.github/workflows/main.yml` 會自動建置並部署到 GitHub Pages。修改共用檔案（`src/App.jsx`、樣式或模型）前先跟組員協調。不要把密碼或 token 寫進檔案。

## 授權

3D 模型來自 Sketchfab，採 Creative Commons 授權，出處見 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)，網站首頁也有標示。淺色模式的蒸汽龐克工作室（`src/vendor/steampunk-workshop/`）由 AI 產生，全部以程式即時建構。

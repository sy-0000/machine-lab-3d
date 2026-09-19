# GitHub 與 Git LFS 上傳指南

指令在含有 `package.json`、`.git` 的專案根目錄執行；本機為 `Assets/lathe-learning/`。以下使用 PowerShell。

## 目前狀態

封版盤點時已安裝 Git LFS 3.6.1，三個現行模型已受 LFS 管理，pre-push hook 已存在，`.gitattributes` 規則為：

```gitattributes
*.glb filter=lfs diff=lfs merge=lfs -text
```

尚未設定 remote。舊歷史仍有 7 個普通 GLB 版本，合計約 579 MB。GitHub 的普通 Git 單檔限制為 100 MiB，刪除最新版本的檔案不會清除歷史物件。[官方大檔說明](https://docs.github.com/en/repositories/working-with-files/managing-large-files)

## 首次上傳前：遷移舊模型歷史

先把整個專案（含隱藏的 `.git`、`.git/lfs`）備份到儲存庫外。遷移會改寫 commit ID 與本機標籤，請在首次上傳、組員 clone 之前做。已共享的 repository 不應自行重寫歷史。

先執行 `git status --short`，確認沒有未提交變更，再執行：

```powershell
git lfs install --local
git lfs version
git lfs track "*.glb"
git lfs migrate info --everything --include="*.glb" --skip-fetch
git lfs migrate import --everything --include="*.glb" --skip-fetch
git lfs fsck
git lfs ls-files
git status --short
```

本專案已提交相同 tracking 規則，`track` 通常不產生變更。若在其他專案首次設定，先提交 `.gitattributes` 與模型，再遷移。`migrate import` 直接重寫歷史，不需要再為遷移本身新增普通 commit。[官方遷移文件](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-migrate.adoc)

本次封版沒有自動執行歷史遷移，所以交付時的 commit ID 會在你執行這些指令後改變。

## 建立 GitHub 儲存庫並推送

在 GitHub 建立空白 repository，選擇公開或私人，不要先勾選 README、.gitignore 或 License。將以下網址換成你的帳號與 repository 名稱：

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git remote -v
git push -u origin main
```

如果 `origin` 已存在，先確認網址；需要更換時用 `git remote set-url origin <正確網址>`。

HTTPS 推送通常由 Git Credential Manager 引導登入。不要把密碼或 token 寫進檔案或 remote URL。LFS hook 會隨 push 上傳模型；若回報 LFS 配額不足，需由 repository 擁有者處理帳號儲存／傳輸額度。

若要分享舊版標籤，完成 `--everything` 遷移後再執行 `git push origin --tags`。首次推送不需要 `--force`。

## 組員第一次下載

組員先安裝 Git LFS：

```powershell
git lfs install
git clone https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
git lfs pull
npm ci
npm run dev
```

用 clone 進行協作，不要以下載 ZIP 取代。若 `.glb` 只有幾行以 `version https://git-lfs.github.com/spec/v1` 開頭的文字，那只是指標，請重新執行 `git lfs pull`，不要手動修改指標。

編輯頁面位置與分支流程見 [README](../README.md)。

## 發布成可瀏覽的網站

GitHub repository 只保存原始碼；部署需另外建置 `dist/`。若透過 GitHub Actions 部署，checkout 步驟需要下載 LFS，例如 `actions/checkout` 的 `with: lfs: true`。接著設定 Node.js，執行 `npm ci`、`npm run build`，將完整 `dist/` 發布到靜態主機。

本次沒有建立遠端、推送或啟用 Pages。部署來源不可是仍存有 LFS 指標的模型檔案。

官方參考：[設定 Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/configuring-git-large-file-storage)、[移轉既有檔案](https://docs.github.com/en/repositories/working-with-files/managing-large-files/moving-a-file-in-your-repository-to-git-large-file-storage)。

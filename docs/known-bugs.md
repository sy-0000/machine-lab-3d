# 已知 bug（只記錄，未修）

| # | 位置 | 重現方式 | 推測原因 |
|---|---|---|---|
| 1 | 現有選單（桌機 `#/world` HTML 選單／VR 翻牌板）點擊可能沒有反應（任務說明提供） | 未能在無頭瀏覽器重現；請依 `docs/testing-guide.md` 的檢查清單在本機試 | 未調查；候選：`InputManager` 的 `enabled()`/occluder 擋住射線，或 `Menu.js` 的 uv→按鈕換算 |
| 2 | `docs/quest-evaluation.md`、`docs/perf/` 不存在於 `origin/feature/webxr` 與 `origin/main`（任務指為已存在） | `git log --all -- docs` | 可能從未推送，仍在本機 |
| 3 | `public/models/machines/*/*.glb` 是 Git LFS 檔案；clone 後若沒 `git lfs pull`，機台載入失敗：「回應不是有效的 GLB 模型。」，工作室整區載入失敗 | 在未拉 LFS 的 checkout 開 `?area=workshop` | 檔案只是 132 byte 的 LFS 指標；錯誤訊息沒有提示 LFS（`MachineLoader.fetchFiles`） |

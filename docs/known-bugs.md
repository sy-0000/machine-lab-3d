# 已知 bug（只記錄，未修）

| # | 位置 | 重現方式 | 推測原因 |
|---|---|---|---|
| 1 | `src/xr/ui/Menu.js`（VR 翻牌板選單）點「項目」（跳轉類按鈕）沒有反應，之後整個選單都點不動，關掉再開才恢復 | 已找到原因（以 update 邏輯模擬 10–90 fps 皆重現）：`select()` 設 `pendingRun` 後，`update()` 只在 `state.pressed >= 0` 時累加 `pressT`；`pressT` 到 `PRESS_SECONDS`(0.1) 就把 `pressed` 設回 −1、停止累加，永遠到不了 `RUN_AFTER`(0.18)，`pendingRun` 不會清除；而 `select()` 開頭 `if (pendingRun) return` 擋掉之後所有點擊。只有剛好遇到 ≥0.18 s 的卡頓才會執行，所以表現為「有時候沒反應」 | 修法（未套用，需你同意改網站）：`pendingRun` 期間獨立累加計時，例如 `if (pendingRun && (runT += dt) >= RUN_AFTER)`，`select` 時 `runT = 0`。次要：按鈕之間的空隙點了沒有任何回饋；左手控制器追蹤遺失時選單會自動關閉 |
| 2 | `docs/quest-evaluation.md`、`docs/perf/` 不存在於 `origin/feature/webxr` 與 `origin/main`（任務指為已存在） | `git log --all -- docs` | 可能從未推送，仍在本機 |
| 3 | `public/models/machines/*/*.glb` 是 Git LFS 檔案；clone 後若沒 `git lfs pull`，機台載入失敗：「回應不是有效的 GLB 模型。」，工作室整區載入失敗 | 在未拉 LFS 的 checkout 開 `?area=workshop` | 檔案只是 132 byte 的 LFS 指標；錯誤訊息沒有提示 LFS（`MachineLoader.fetchFiles`） |

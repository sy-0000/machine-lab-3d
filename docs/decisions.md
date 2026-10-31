# 自行決定紀錄

格式：問題／選擇／理由／如何回復。

## D1 找不到 docs/quest-evaluation.md 與 docs/perf/
- 問題：任務說要先讀 docs/quest-evaluation.md，並參考 docs/perf/ 量測腳本，但 origin/feature/webxr 與 origin/main 都沒有這兩個路徑（`git log --all -- docs` 只有 xr-plan.md 與 製作說明.md）。
- 選擇：改以 docs/xr-plan.md、docs/製作說明.md 與實際原始碼盤點場景；遷移計畫中的難度與場景清單以程式碼為準。
- 理由：檔案不存在，無法讀取；不憑空編造內容。
- 回復：若檔案在別處（例如未推送的本機分支），推上來後可補進遷移計畫的對照表。

## D2 分支名稱
- 問題：任務指定分支 unity-export；雲端 session 另外指定了開發分支 claude/charming-turing-mck0zz。
- 選擇：在 unity-export（由 origin/feature/webxr 建立）上開發並推送；內容同步也推到指定的 claude 分支作為備份（見最終回報）。
- 理由：使用者明確要求 unity-export。
- 回復：刪除遠端多餘分支即可，不影響 main / feature/webxr。

# 槌柄／槌頭圖面資料

Campaign 製程更新：Level 1 已取消 Ø16.3 等徑目標；Level 2 使用圖面 d20–120 的線性錐段。教學裝夾明確採圖面左端在實際自由面、direction=−1；實體 Z 範圍由實際 lengthMm 換算，保留前關誤差。下方原圖數據不變；製程採用方式以 [Campaign](HANDLE_CAMPAIGN.md) 為準。

來源：使用者提供的 `codex-clipboard-d40e6510-ce1d-49c9-b35b-df5edc47586f.png`（1642×997，左側及下緣裁切），[原圖副本](drawings/hammer-user-drawing.png)未修改。結構化資料在 `src/levels/hammerDrawingSpec.js`。confirmed 僅指該標註可讀，不代表加工順序或未標公差已確認。

## 槌柄（件 2）

| 項目 | 讀值 mm | 狀態／用途 |
|---|---|---|
| 毛胚 | Ø20 × 300 | 使用者確認，非成品圖面尺寸 |
| 成品總長 | 240 | confirmed；Level 1 名義總長 |
| 左端段長 | 20 | confirmed；螺紋規格裁切不可讀 |
| 錐段長 | 100 | confirmed；從左端段肩部至握柄肩部 |
| 錐段小／大端 | Ø9.3／Ø16.3 | confirmed；不是整段 Ø16.3 圓柱 |
| 左端倒角 | 1×45° | confirmed；後續端部加工 |
| 握柄球端 | SR9 | confirmed；不得據此自行補握柄直徑 |
| 壓花 | 有標示 | confirmed；長度、起訖、節距 unknown |
| Ø9.3 公差 | 有上下偏差標註 | 下偏差數字不可靠，保留 unknown；不移用至 Ø16.3 |
| Ø16.3／總長公差 | 未見 | unknown；照片未包含可用一般公差表 |

6.3 是表面粗糙度標註（µm），不是尺寸公差。握柄直徑、左端螺紋規格與其他未標尺寸不從比例、裝配關係或 SR9 推算。

## 槌頭（件 1）

使用者後續明確確認：毛胚 **20×20×90 mm**；基本加工尺寸 **18.5×18.5×86 mm**。結構化欄位 `head.stockMm` / `head.basicSizeMm` 記錄此來源，不是從照片比例推算。此確認沒有補充孔 Y 定位、孔深／是否通孔、牙深、螺距或公差。

槌頭流程與座標採用方式：[HEAD_CAMPAIGN.md](HEAD_CAMPAIGN.md)。原照片可讀標註仍保留；製程完成與圖面驗收分開。

可讀：總長 86；左端截面尺寸 18.5、端面 12.5；上視圖右段長 38、右端 12.5；剖視孔中心距左端 40；左倒角 1.5×45°、右倒角 3×45°；尖端 R1.5；M10 與 Ø8.5 鑽孔；表面粗糙度 6.3。
上視圖的 36 數值可讀，但尺寸界線對應特徵保留 unknown，不當作孔中心 40 的替代值。螺距、牙深、配合及尺寸公差未補值。

## 圖面與加工座標

圖面 datum 選左端面，d 向右增加；錐段圖面區間是 d=[20,120]，只描述錐段位置。WorkpieceState 的實體 Z=0 在夾持後端，+Z 指向自由端；長度隨端面切削縮短。玩家工件 Z=實體 Z−對刀時的實體 Z offset。

明確裝夾設定後才可使用 `physicalZ = datumPhysicalZ + direction * d`；direction 必須為 ±1。`drawingZToCoordinates` 要求三項設定，拒絕省略。例：若另行確認左端面放在實體 Z240、圖面向右對應 −Z，d20 對應實體 Z220；原毛胚端面設零在 Z300 時顯示 −80，於新端面 Z240 重新設零則顯示 −20。這是轉換例，**不是已核定裝夾方案或驗收範圍**。不可直接把 d 或玩家 Z 當 profile index。

Level 1 保留 `machiningZRange=null`：需要確認是否將錐段先車成 Ø16.3 中間圓柱、其範圍、端部預留量與裝夾方向。圖面本身不能證明這個製程要求。總長採 240 名義值，公差未知時顯示實際與誤差但不判合格；後续端部造形、壓花、螺紋不納入本關。

## 驗收狀態

targets.confirmation 逐欄記錄 confirmed／draft／unknown。外徑須尺寸、範圍、公差均 confirmed 才判 pass/fail；長度須尺寸、公差 confirmed。任一已確認條件失敗即 fail，即使其他項目待確認；已確認項目合格但仍有 pending 時整關保持 draft，不能通關。未評估項目的過切為 unknown，不能宣稱無過切。未提供 confirmation 的舊設定沿用全域 status。

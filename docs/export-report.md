# 匯出報告（無頭瀏覽器實際執行）

- 產生時間：2026-10-31T09:30:25.369Z；three r180；工具 `src/dev/exportTool.js`
- 執行方式：`npm run dev` 後 `node scripts/export-headless.mjs`（等同在 `?area=lobby&nobatch#/world` 按 Shift+A），再用 `node scripts/export-report.mjs` 產生本報告。
- 三角形與節點數是**重新讀檔**（gltf-transform）計算，不是匯出端自報；兩者不一致會標 ⚠。
- glb 未壓縮（GLTFExporter 不做 meshopt/Draco），大小主要是 PNG 貼圖；同一張程序貼圖在不同檔案各存一份。

| 檔案 | 大小 (KB) | 三角形 | 節點 | mesh | 材質 | 貼圖 | 狀態 |
|---|---:|---:|---:|---:|---:|---:|---|
| exterior_static.glb | 13356 | 26,706 | 958 | 64 | 16 | 23 | ok |
| exterior_interactive.glb | 11165 | 2,192 | 22 | 18 | 18 | 16 | ok |
| vestibule_static.glb | 11179 | 13,068 | 210 | 129 | 22 | 31 | ok |
| vestibule_interactive.glb | 7870 | 61,040 | 196 | 102 | 64 | 28 | ok |
| workshop_static.glb | 38014 | 555,304 | 7294 | 1381 | 95 | 61 | ok |
| workshop_interactive.glb | 10563 | 50,558 | 221 | 121 | 27 | 23 | ok |
| toolbox_static.glb | 5262 | 22,716 | 139 | 70 | 11 | 14 | ok |
| toolbox_interactive.glb | 5035 | 75,386 | 841 | 126 | 51 | 23 | ok |
| tools/tool_vernier-caliper.glb | 474 | 9,996 | 12 | 8 | 6 | 4 | ok |
| tools/tool_steel-ruler.glb | 238 | 1,778 | 5 | 2 | 2 | 1 | ok |
| tools/tool_hex-key.glb | 170 | 372 | 9 | 6 | 1 | 1 | ok |
| tools/tool_try-square.glb | 266 | 938 | 10 | 7 | 5 | 2 | ok |
| tools/tool_files.glb | 1268 | 8,614 | 18 | 12 | 4 | 6 | ok |
| tools/tool_knurling-tool.glb | 367 | 776 | 14 | 11 | 6 | 3 | ok |
| tools/tool_center-punch.glb | 173 | 6,576 | 6 | 3 | 2 | 1 | ok |
| tools/tool_scriber.glb | 170 | 6,528 | 6 | 3 | 2 | 1 | ok |
| tools/tool_paint-brush.glb | 799 | 13,864 | 584 | 6 | 5 | 3 | ok |
| tools/tool_brass-brush.glb | 801 | 4,380 | 104 | 4 | 3 | 4 | ok |
| tools/tool_jaw-covers.glb | 499 | 520 | 11 | 6 | 2 | 2 | ok |
| tools/tool_shims.glb | 836 | 7,188 | 21 | 12 | 8 | 7 | ok |
| tools/tool_safety-glasses.glb | 430 | 13,856 | 51 | 46 | 5 | 0 | ok |
| machine_lathe_static.glb | 13762 | 196,254 | 136 | 127 | 16 | 6 | ok |
| machine_lathe_interactive.glb | 5752 | 306,815 | 125 | 84 | 30 | 3 | ok |
| machine_milling_static.glb | 61222 | 275,312 | 398 | 366 | 38 | 103 | ok |
| machine_milling_interactive.glb | 20152 | 87,050 | 154 | 121 | 17 | 24 | ok |
| machine_drill_static.glb | 6497 | 21,914 | 32 | 23 | 1 | 3 | ok |
| machine_drill_interactive.glb | 6461 | 32,948 | 49 | 25 | 4 | 3 | ok |
| **合計** | **222782** | **1,802,649** | | | | | 27 個檔案 |

## 未產生的預期檔案

- 無（14 個場景／機台檔與工具檔都已產生）

## 被略過的物件（依原因彙總）

| 原因 | 數量 | 三角形 | 出現在 | 例子 |
|---|---:|---:|---|---|
| 自訂 ShaderMaterial 天空／雲（Unity 改用 Skybox） | 4 | 1944 | exterior, workshop | ProceduralSky, CloudLayer |
| 燈光（HemisphereLight）：glb 不帶光源，Unity 端改用烘焙／重設光源；參數記錄於 manifest.lights | 2 |  | exterior, workshop | <HemisphereLight>, SkyBounce |
| 燈光（DirectionalLight）：glb 不帶光源，Unity 端改用烘焙／重設光源；參數記錄於 manifest.lights | 2 |  | exterior, workshop | <DirectionalLight>, DomeSun |
| 燈光（PointLight）：glb 不帶光源，Unity 端改用烘焙／重設光源；參數記錄於 manifest.lights | 10 |  | exterior, vestibule, workshop | <PointLight>, BoilerFire, EdisonLamp_0, EdisonLamp_1, EdisonLamp_2, EdisonLamp_3 |
| 開發用按鈕（正式版不存在） | 2 |  | exterior | DevUnlock, DevReset |
| 隱形碰撞盒／點擊範圍（Unity 端用 Collider 取代，bbox 記錄於 manifest.colliders） | 21 | 1656 | vestibule, workshop, toolbox, machine_lathe, machine_milling, machine_drill | <Mesh>, WheelHit, PaperHit, PictureHit, VRWheelHit_heightHandwheel, VRWheelHit_carriageHandwheel |
| 粒子／點精靈（THREE.Points + 自訂 shader），Unity 改用 VFX/Particle System 重做 | 5 |  | vestibule, workshop, toolbox | SteamPuffs, DustMotes, FireboxSparks, LiftPuff |
| 自訂 ShaderMaterial（Unity 需用 Shader Graph 重寫） | 7 | 392 | workshop | SunBeam_0, SunBeam_1, SunBeam_2, SunBeam_3, SunBeam_4, SunBeam_5 |
| 燈光（SpotLight）：glb 不帶光源，Unity 端改用烘焙／重設光源；參數記錄於 manifest.lights | 1 |  | toolbox | <SpotLight> |
| 3D UI 面板（CanvasTexture 動態文字，Unity 重做） | 1 |  | toolbox | ToolInfoPanel |

## 展開的 InstancedMesh

| 檔案群組 | 名稱 | 實例數 | 三角形（展開後） | 逐實例顏色 |
|---|---|---:|---:|---|
| exterior | DomeRivets | 888 | 18648 |  |
| vestibule | WainscotRivets | 32 | 672 |  |
| vestibule | WallGears_L | 8 | 42656 |  |
| vestibule | WallGears_M | 3 | 2880 |  |
| vestibule | WallGears_S | 5 | 4000 |  |
| vestibule | Nails | 12 | 252 |  |
| vestibule | Nails | 12 | 252 |  |
| vestibule | RingTeeth | 48 | 576 |  |
| workshop | ShellRivets | 1296 | 27216 |  |
| workshop | DoorRivets | 30 | 630 |  |
| workshop | DomeRivets | 888 | 18648 |  |
| workshop | Balusters | 251 | 32128 |  |
| workshop | GalleryRivets | 238 | 4998 |  |
| workshop | GlowingCoals | 26 | 936 |  |
| workshop | CoalLumps | 40 | 1440 |  |
| workshop | BoilerRivets | 774 | 16254 |  |
| workshop | BoilerBolts | 70 | 1470 |  |
| workshop | SpokeRivets | 6 | 126 |  |
| workshop | SpokeRivets | 5 | 105 |  |
| workshop | SpokeRivets | 4 | 84 |  |
| workshop | SpokeRivets | 5 | 105 |  |
| workshop | PanelRivets | 194 | 4074 |  |
| workshop | BossBolts | 36 | 864 |  |
| workshop | ClockScrews | 4 | 84 |  |
| workshop | Scatter_gearB | 14 | 14112 |  |
| workshop | Scatter_screw | 40 | 8160 |  |
| workshop | Scatter_spring | 8 | 4480 |  |
| workshop | Scatter_screw | 26 | 5304 |  |
| workshop | Scatter_nut | 22 | 528 |  |
| workshop | Scatter_gearA | 9 | 3312 |  |
| workshop | Scatter_spring | 7 | 3920 |  |
| workshop | Scatter_gearB | 5 | 5040 |  |
| workshop | Scatter_washer | 24 | 2304 |  |
| workshop | Scatter_gearC | 3 | 4596 |  |
| workshop | Scatter_gearA | 6 | 2208 |  |
| workshop | Scatter_screw | 14 | 2856 |  |
| workshop | Scatter_nut | 8 | 192 |  |
| workshop | BenchBolts | 4 | 96 |  |
| workshop | Pegs | 24 | 768 |  |
| workshop | Scatter_screw | 60 | 12240 |  |
| workshop | Scatter_gearA | 10 | 3680 |  |
| workshop | ShelfRivets | 30 | 630 |  |
| workshop | Nails | 12 | 252 |  |
| workshop | Nails | 12 | 252 |  |
| workshop | Straw | 260 | 4160 |  |
| workshop | Nails | 12 | 252 |  |
| workshop | Nailheads | 43 | 903 |  |
| workshop | CoalLumps | 340 | 12240 |  |
| workshop | ChestRivets | 58 | 1218 |  |
| workshop | KeyStems | 44 | 880 |  |
| workshop | KeyCaps | 44 | 2464 |  |
| workshop | KeyRims | 44 | 4928 |  |
| workshop | Typebars | 30 | 360 |  |
| workshop | Bubbles | 14 | 504 |  |
| workshop | Chain | 47 | 3008 |  |
| workshop | Chain | 47 | 3008 |  |
| workshop | Chain | 47 | 3008 |  |
| workshop | Chain | 56 | 3584 |  |
| workshop | SteelShavings | 150 | 14400 |  |
| workshop | BrassSwarf | 150 | 10800 |  |
| workshop | Scatter_screw | 18 | 3672 |  |
| workshop | Scatter_nut | 12 | 288 |  |
| workshop | Scatter_washer | 10 | 960 |  |
| toolbox | <Mesh> | 18 | 1800 |  |
| toolbox | Toolbox_Rivets | 42 | 7560 |  |
| toolbox | <Mesh> | 460 | 9200 |  |
| toolbox | <Mesh> | 115 | 2300 |  |
| toolbox | <Mesh> | 48 | 960 |  |
| toolbox | <Mesh> | 48 | 480 |  |
| Tool_paint-brush | <Mesh> | 460 | 9200 |  |
| Tool_paint-brush | <Mesh> | 115 | 2300 |  |
| Tool_brass-brush | <Mesh> | 48 | 960 |  |
| Tool_brass-brush | <Mesh> | 48 | 480 |  |

## 警告（依類型彙總）

- 材質「…」用 onBeforeCompile 改過 shader，只匯出基底 PBR 參數 — 2959 處（例：exterior:Ground、exterior:Apron、exterior:OuterWall_0、exterior:Plinth_0、exterior:Cornice_0、exterior:Pilaster_0）
- 透明材質「…」：glTF 以 alphaMode=BLEND 匯出，渲染排序在 Unity 需手動設定 — 254 處（例：exterior:Glazing_clean、exterior:Glazing_dusty、exterior:Glazing_cracked、exterior:LanternGlass、exterior:Glass、vestibule:Lens）
- CanvasTexture 動態貼圖（面板／螢幕）：只烘下匯出當下那一格；Unity 端需用 RenderTexture 或 UI 重做 — 18 處（例：exterior:Face、vestibule:Face、vestibule:Sheet、vestibule:GaugeLabel、vestibule:LockedHint、vestibule:Paper）

## 燈光（未匯出，參數在 manifest `groups[].lights`）

- exterior：4 盞（HemisphereLight、DirectionalLight、PointLight）
- vestibule：2 盞（PointLight）
- workshop：8 盞（DirectionalLight、HemisphereLight、PointLight）
- toolbox：1 盞（SpotLight）

## 機台節點對照

- **lathe**：設定檔中的互動節點 23 個；模型中找不到：無。放置：rotationY=0.0000，offset=[-0.0837,-0.004,-0.0745]，鐵座=無
- **milling**：設定檔中的互動節點 11 個；模型中找不到：無。放置：rotationY=-1.5708，offset=[0.427,0.0011,0.0186]，鐵座=無
- **drill**：設定檔中的互動節點 7 個；模型中找不到：無。放置：rotationY=0.0000，offset=[-0.0315,0.7201,-0.0203]，鐵座=有

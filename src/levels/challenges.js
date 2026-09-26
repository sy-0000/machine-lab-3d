import { createHandleState, HANDLE_STOCK } from '../machining/WorkpieceState.js';
import { createHeadState } from '../machining/HeadWorkpieceState.js';

// Three independent challenges. Each starts from fresh stock; nothing carries over.
// Stars come only from the measured workpiece after submission.
export const BLOCK_STOCK = { lengthMm: 90, widthMm: 20, heightMm: 20 };
export const createBlockStock = () => createHeadState(BLOCK_STOCK);

// [3★, 2★, 1★] limits; beyond the 1★ limit the attempt earns no stars.
const starsFor = (error, limits) => error == null ? 0 : limits.findIndex(l => error <= l + 1e-9) < 0 ? 0 : 3 - limits.findIndex(l => error <= l + 1e-9);
const round = n => Math.round(n * 1000) / 1000;
const mm = n => n == null ? '—' : Number(n.toFixed(3)).toString();

const STOCK_DIAMETER = HANDLE_STOCK.radiusMm * 2;
/** Lathe: the turned run from the free end (cells clearly below the Ø20 stock) and its diameters. */
export function measureTurning(s) {
  const { resolutionMm: r, radiusMm } = s.profile, end = Math.min(radiusMm.length, Math.round(s.lengthMm / r));
  let i = end - 1; while (i >= 0 && radiusMm[i] * 2 < STOCK_DIAMETER - 0.1) i--;
  const lengthMm = (end - 1 - i) * r;
  // Diameter across the turned run, ignoring 1 mm at each end (edge cells).
  const zone = radiusMm.slice(i + 1 + 2, end - 2).map(v => v * 2);
  return { totalLengthMm: s.lengthMm, lengthMm, max: zone.length ? Math.max(...zone) : null, min: zone.length ? Math.min(...zone) : null };
}
/** Block: highest / lowest point of the top face and whether anything was cut. */
export function measureTop(s) {
  const tops = s.surface.topMm.filter(v => v > 0), max = Math.max(...tops), min = Math.min(...tops);
  return { max, min, cut: min < s.stock.heightMm - 1e-6 };
}
/** The hole nearest a drawing position (within 5 mm), or null. */
const holeAt = (s, xMm) => s.features.filter(f => f.type === 'hole' && Math.abs(f.xMm - xMm) <= 5)
  .sort((a, b) => Math.abs(a.xMm - xMm) - Math.abs(b.xMm - xMm))[0] || null;

// Drill task: two scribed centre lines; one M10 threaded hole, one plain Ø10 hole.
export const DRILL_HOLES = [
  { key: 'A', xMm: 25, diameterMm: 8.5, tapMm: 10, label: '孔 A（M10 螺紋孔）' },
  { key: 'B', xMm: 65, diameterMm: 10, label: '孔 B（Ø10 孔）' },
];
export const createDrillStock = () => ({ ...createBlockStock(), surfaceMarks: DRILL_HOLES.map(h => ({ type: 'scribe', xMm: h.xMm, yMm: BLOCK_STOCK.widthMm / 2 })) });

export const CHALLENGES = [
  {
    id: 'lathe', machine: 'lathe', minutes: 5, title: '車床：外徑車削', stock: 'Ø20 × 300 mm 圓棒',
    goal: '從自由端（右端）車出一段 Ø16 的台階，台階長 50 mm。工件總長不用改。',
    targets: [['外徑', 'Ø16.0 mm'], ['台階長度', '50 mm（從自由端量起，不是工件總長）']],
    steps: ['啟動主軸', '刀尖靠到自由端附近的外圓（光圈亮）→ X 歸零（或不歸零，直接看 X 讀值＝直徑）', 'Z＋ 退到自由端外，X 進刀到 −4.000（歸零後的讀值；沒歸零就是 16.000）', 'Z− 往夾頭車到 Z=250.000（Z 讀值是刀尖距工件左端的位置，自由端＝300）', 'X＋ 退刀、停主軸 → 繳交（右側「目前工件尺寸」可以隨時確認）'],
    limits: { diameter: [0.1, 0.3, 1], length: [0.5, 1.5, 4] },
    createStock: createHandleState,
    live(s) {
      const t = measureTurning(s);
      return [['原始毛胚', 'Ø20 × 300 mm'], ['工件總長', mm(t.totalLengthMm) + ' mm'],
        ['已車台階長', t.lengthMm ? mm(t.lengthMm) + ' mm' : '尚未車削'],
        ['台階外徑', t.min == null ? '—' : t.max - t.min < 0.001 ? 'Ø' + mm(t.min) + ' mm' : `Ø${mm(t.min)} ~ ${mm(t.max)} mm`]];
    },
    measure(s) {
      const { lengthMm, max, min } = measureTurning(s);
      const diameterError = max == null ? null : Math.max(Math.abs(max - 16), Math.abs(min - 16));
      const lengthError = lengthMm > 0 ? Math.abs(lengthMm - 50) : null;
      return [
        { label: '外徑（最大）', target: 16, actual: max, error: max == null ? null : round(max - 16), stars: starsFor(diameterError, this.limits.diameter) },
        { label: '外徑（最小）', target: 16, actual: min, error: min == null ? null : round(min - 16), stars: starsFor(diameterError, this.limits.diameter) },
        { label: '台階長度', target: 50, actual: lengthMm || null, error: lengthMm ? round(lengthMm - 50) : null, stars: starsFor(lengthError, this.limits.length) },
      ];
    },
  },
  {
    id: 'milling', machine: 'milling', minutes: 5, title: '銑床：面銑平面', stock: '20 × 20 × 90 mm 方料', tool: 'head_face_mill',
    goal: '用面銑刀把整個上表面銑平，高度從 20 mm 銑到 18.5 mm（吃刀 1.5 mm）。',
    targets: [['高度', '18.5 mm'], ['範圍', '整個上表面']],
    steps: ['X＋ 把刀移到工件上方（X 約 +40）', 'Z 升降：工作臺「上升」＝工件靠近刀。先用 1 mm 靠近，快碰到時換 0.01 / 0.05 mm 慢慢上升，光圈亮起「接觸」就停 → Z 歸零', '如果顯示「刀尖壓入工件」代表過頭了，Z− 下降退回再重新對刀', 'X− 退回工件外（X 讀值約 −40），Z＋ 上升到 1.500', '啟動主軸，X＋ 進給走過整個工件（X 讀值到 +130 以上）', '停主軸 → 繳交（右側「目前工件尺寸」會顯示銑過的高度）'],
    limits: { height: [0.1, 0.3, 1] },
    createStock: createBlockStock,
    live(s) {
      const t = measureTop(s);
      return [['原始毛胚', '20 × 20 × 90 mm'], ['上表面最高', mm(t.max) + ' mm'], ['上表面最低', mm(t.min) + ' mm'],
        ['狀態', !t.cut ? '尚未切削' : t.max - t.min < 0.001 ? '整面已銑平' : '還有沒銑到的地方']];
    },
    measure(s) {
      const { max, min, cut } = measureTop(s);
      const error = Math.max(Math.abs(max - 18.5), Math.abs(min - 18.5));
      const stars = cut ? starsFor(error, this.limits.height) : 0;
      return [
        { label: '表面最高點', target: 18.5, actual: round(max), error: round(max - 18.5), stars },
        { label: '表面最低點', target: 18.5, actual: round(min), error: round(min - 18.5), stars },
      ];
    },
  },
  {
    id: 'drill', machine: 'drill', minutes: 8, title: '鑽床：定位鑽孔與攻牙', stock: '20 × 20 × 90 mm 方料（已劃線）', tool: 'head_drill_10', toolChoice: true,
    goal: '工件上有兩條劃線。在 X=25 做一個 M10 螺紋孔（先鑽底孔再攻牙），在 X=65 鑽一個 Ø10 孔。要自己選對鑽頭、移動工件對準劃線。',
    targets: [['孔 A　X=25', 'M10 螺紋孔：攻牙深 ≥ 10'], ['孔 B　X=65', 'Ø10 孔'], ['提示', 'M10×1.5 底孔徑 = 10 − 1.5']],
    steps: ['軸選「工件定位 X」，把鑽頭中心移到 X=25.000（主軸停止、鑽頭在上方才能移）', '目前裝的是 Ø10 鑽頭。孔 A 要攻 M10，刀具先換成底孔鑽頭（Ø8.5）', '啟動主軸 → 按住進給往下鑽底孔（要比攻牙深，超過 10 mm）→ 退刀、停主軸', '換 M10 絲攻：按住下降碰到表面（光圈亮）記下讀值，深度擋塊 = 碰面讀值 − 10，勾選 → 啟動主軸攻牙', '停主軸，工件移到 X=65.000，換 Ø10 鑽頭 → 啟動主軸鑽孔', '停主軸 → 繳交'],
    limits: { position: [0.2, 0.5, 1], tap: [0.3, 1, 3] },
    createStock: createDrillStock,
    live(s) {
      const rows = [['原始毛胚', '20 × 20 × 90 mm']];
      for (const h of s.features.filter(f => f.type === 'hole').sort((a, b) => a.xMm - b.xMm))
        rows.push([`孔 @ X=${mm(h.xMm)}`, `Ø${mm(h.diameterMm)} 深 ${mm(h.depthMm)}${h.through ? '（鑽穿）' : ''}${h.thread ? ` · ${h.thread.designation} 攻牙 ${mm(h.thread.tappedDepthMm)}` : ''}`]);
      if (rows.length === 1) rows.push(['孔', '尚未鑽孔']);
      return rows;
    },
    measure(s) {
      const L = this.limits;
      return DRILL_HOLES.flatMap(t => {
        const h = holeAt(s, t.xMm), missing = { actual: null, error: null, stars: 0 };
        const rows = [
          { label: t.label + ' 位置 X', target: t.xMm, ...(h ? { actual: round(h.xMm), error: round(h.xMm - t.xMm), stars: starsFor(Math.abs(h.xMm - t.xMm), L.position) } : missing) },
          { label: t.label + ' 孔徑', target: t.diameterMm, ...(h ? { actual: h.diameterMm, error: round(h.diameterMm - t.diameterMm), stars: Math.abs(h.diameterMm - t.diameterMm) < 0.01 ? 3 : 0 } : missing) },
        ];
        if (t.tapMm) {
          // Deeper threads are fine; only a short thread loses stars.
          const tapped = h?.thread?.tappedDepthMm ?? null;
          rows.push({ label: t.label + ' 攻牙深', target: '≥ ' + t.tapMm, actual: tapped == null ? null : round(tapped),
            error: tapped == null ? null : round(Math.min(0, tapped - t.tapMm)), stars: tapped == null ? 0 : starsFor(Math.max(0, t.tapMm - tapped), L.tap) });
        }
        return rows;
      });
    },
  },
];
export const challengeById = id => CHALLENGES.find(c => c.id === id);
/** Overall result: the weakest measured item decides the stars. */
export function grade(challenge, state) {
  const rows = challenge.measure(state);
  return { rows, stars: Math.min(...rows.map(r => r.stars)) };
}

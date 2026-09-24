import { createHandleState } from '../machining/WorkpieceState.js';
import { createHeadState } from '../machining/HeadWorkpieceState.js';

// Three independent 5-minute challenges. Each starts from fresh stock; nothing carries over.
// Stars come only from the measured workpiece after submission.
export const BLOCK_STOCK = { lengthMm: 90, widthMm: 20, heightMm: 20 };
export const createBlockStock = () => createHeadState(BLOCK_STOCK);

// [3★, 2★, 1★] limits; beyond the 1★ limit the attempt earns no stars.
const starsFor = (error, limits) => error == null ? 0 : limits.findIndex(l => error <= l + 1e-9) < 0 ? 0 : 3 - limits.findIndex(l => error <= l + 1e-9);
const round = n => Math.round(n * 1000) / 1000;

export const CHALLENGES = [
  {
    id: 'lathe', machine: 'lathe', title: '車床：外徑車削', stock: 'Ø20 × 300 mm 圓棒',
    goal: '從自由端車出一段 Ø16 × 長 50 mm 的外徑。',
    targets: [['外徑', 'Ø16.0 mm'], ['長度', '50 mm（從自由端量）']],
    steps: ['啟動主軸', '刀尖靠到自由端附近的外圓（光圈亮）→ X 歸零', 'Z＋ 退到自由端外，X 進刀到 −4.000（直徑讀值）', 'Z− 往夾頭車進 50 mm（看 Z 讀值）', 'X＋ 退刀、停主軸 → 繳交'],
    limits: { diameter: [0.1, 0.3, 1], length: [0.5, 1.5, 4] },
    createStock: createHandleState,
    measure(s) {
      const { resolutionMm: r, radiusMm } = s.profile, end = Math.min(radiusMm.length, Math.round(s.lengthMm / r));
      // Turned length: run of cells from the free end that are clearly below the Ø20 stock.
      let i = end - 1; while (i >= 0 && radiusMm[i] * 2 < 19.9) i--;
      const lengthMm = (end - 1 - i) * r;
      // Diameter across the turned run, ignoring 1 mm at each end (edge cells).
      const zone = radiusMm.slice(i + 1 + 2, end - 2).map(v => v * 2);
      const max = zone.length ? Math.max(...zone) : null, min = zone.length ? Math.min(...zone) : null;
      const diameterError = zone.length ? Math.max(Math.abs(max - 16), Math.abs(min - 16)) : null;
      const lengthError = lengthMm > 0 ? Math.abs(lengthMm - 50) : null;
      return [
        { label: '外徑（最大）', target: 16, actual: max, error: max == null ? null : round(max - 16), stars: starsFor(diameterError, this.limits.diameter) },
        { label: '外徑（最小）', target: 16, actual: min, error: min == null ? null : round(min - 16), stars: starsFor(diameterError, this.limits.diameter) },
        { label: '車削長度', target: 50, actual: lengthMm || null, error: lengthMm ? round(lengthMm - 50) : null, stars: starsFor(lengthError, this.limits.length) },
      ];
    },
  },
  {
    id: 'milling', machine: 'milling', title: '銑床：面銑平面', stock: '20 × 20 × 90 mm 方料', tool: 'head_face_mill',
    goal: '用面銑刀把整個上表面銑平，高度從 20 mm 銑到 18.5 mm。',
    targets: [['高度', '18.5 mm'], ['範圍', '整個上表面']],
    steps: ['X＋ 把刀移到工件上方', 'Z 上升讓刀碰到上表面（光圈亮）→ Z 歸零', 'X− 退回工件外，Z 上升 1.5', '啟動主軸，X＋ 進給走過整個工件', '停主軸 → 繳交'],
    limits: { height: [0.1, 0.3, 1] },
    createStock: createBlockStock,
    measure(s) {
      const tops = s.surface.topMm.filter(v => v > 0), max = Math.max(...tops), min = Math.min(...tops);
      const error = Math.max(Math.abs(max - 18.5), Math.abs(min - 18.5)), cut = min < BLOCK_STOCK.heightMm - 1e-6;
      const stars = cut ? starsFor(error, this.limits.height) : 0;
      return [
        { label: '表面最高點', target: 18.5, actual: round(max), error: round(max - 18.5), stars },
        { label: '表面最低點', target: 18.5, actual: round(min), error: round(min - 18.5), stars },
      ];
    },
  },
  {
    id: 'drill', machine: 'drill', title: '鑽床：定深鑽孔', stock: '20 × 20 × 90 mm 方料', tool: 'head_drill_85',
    goal: '工件已對準鑽孔位置。鑽一個 Ø8.5、深 10 mm 的盲孔（不要鑽穿）。',
    targets: [['孔徑', 'Ø8.5 mm'], ['孔深', '10 mm（盲孔）']],
    steps: ['按住「進給−」讓鑽頭慢慢碰到表面（光圈亮），記下這時的讀值（例如 −5.0），放開', '深度擋塊設成「碰面讀值 − 10」（例如 −15）並勾選', '啟動主軸', '按住「進給−」鑽到擋塊停住，放開自動退回', '停主軸 → 繳交'],
    limits: { depth: [0.2, 0.5, 1.5] },
    createStock: createBlockStock,
    measure(s) {
      const hole = s.features.find(f => f.type === 'hole'), depth = hole ? round(hole.depthMm) : null;
      const stars = hole && !hole.through ? starsFor(Math.abs(depth - 10), this.limits.depth) : 0;
      return [{ label: hole?.through ? '孔深（已鑽穿）' : '孔深', target: 10, actual: depth, error: depth == null ? null : round(depth - 10), stars }];
    },
  },
];
export const challengeById = id => CHALLENGES.find(c => c.id === id);
/** Overall result: the weakest measured item decides the stars. */
export function grade(challenge, state) {
  const rows = challenge.measure(state);
  return { rows, stars: Math.min(...rows.map(r => r.stars)) };
}

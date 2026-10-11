// 銑床繪本動畫的繪圖程式：網站的 previews/milling.html 與 VR 大門口的動畫螢幕共用這一份。
// createAnimation(ctx) 回傳的 drawFrame(simTime, sdt, playing) 畫出動畫時間 simTime 的一格；
// sdt 是這一格前進的動畫秒數（旋轉角度與切屑會累積，所以要逐格呼叫）。版面由呼叫端用 layout() 指定。
export function createAnimation(ctx){
  /* ---------- 尺寸（正視圖：x 向右，v 向下） ---------- */
  const A = 2.5, H = 1.0, D = 0.22;
  const RC = 1.7, RB = 1.52, INSERTS = 6;
  const W_MAX = 2.6;
  const CUT_V = D, UP_V = -1.1;
  const WX_REST = -6.2, WX_START = -(A + RC + 0.2), WX_END = A + RC + 0.2, WX_BACK = -2.2;
  const VIEW = { x0: -5.6, x1: 5.6, z0: -3.8, z1: 1.55 };

  const stages = [
    { type:'spin',    dur:2.2, to:{wx:WX_REST,  cv:UP_V},  name:'主軸啟動',
      desc:'面銑刀盤開始轉囉！銑床和車床剛好相反：刀具在轉，工件不轉。' },
    { type:'rapid',   dur:1.5, to:{wx:WX_START, cv:UP_V},  name:'工件靠近',
      desc:'工作台載著工件，快快地往刀盤移動，這時還碰不到刀。' },
    { type:'infeed',  dur:1.3, to:{wx:WX_START, cv:CUT_V}, name:'刀盤下刀',
      desc:'刀盤往下降一點點。刀片比工件表面低多少，這一刀就削掉多厚。' },
    { type:'feed',    dur:10,  to:{wx:WX_END,   cv:CUT_V}, name:'工作台進給',
      desc:'工件慢慢從刀盤下面經過。金黃色的刀片一片接一片削過表面，走過的地方就變得又平又亮。' },
    { type:'retract', dur:1.3, to:{wx:WX_END,   cv:UP_V},  name:'刀盤上升',
      desc:'削完了，刀盤往上抬起來。' },
    { type:'stop',    dur:1.6, to:{wx:WX_END,   cv:UP_V},  name:'主軸停止',
      desc:'刀盤停下來休息。' },
    { type:'return',  dur:2.2, to:{wx:WX_BACK,  cv:UP_V},  name:'工件回來',
      desc:'工件回來給你看：上面整片被削平，變矮了一層，表面也亮晶晶的。' }
  ];
  let acc = 0, prevTo = stages[0].to;
  stages.forEach(s => { s.start = acc; acc += s.dur; s.from = prevTo; prevTo = s.to; });
  const TOTAL = acc;
  const smooth = p => p * p * (3 - 2 * p);
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function stateAt(t){
    let k = stages.length - 1;
    for (let i = 0; i < stages.length; i++){ if (t < stages[i].start + stages[i].dur){ k = i; break; } }
    const s = stages[k];
    const p = clamp01((t - s.start) / s.dur);
    const e = s.type === 'feed' ? p : smooth(p);
    const wx = s.from.wx + (s.to.wx - s.from.wx) * e;
    const cv = s.from.cv + (s.to.cv - s.from.cv) * e;
    let omega = W_MAX;
    if (s.type === 'spin') omega = W_MAX * smooth(p);
    if (s.type === 'stop') omega = W_MAX * (1 - smooth(p));
    if (s.type === 'return') omega = 0;
    const front = k < 3 ? Infinity : -(k === 3 ? wx : WX_END);   // 刀盤中心在工件座標的位置
    const moving = p < 1 && (s.from.wx !== s.to.wx || s.from.cv !== s.to.cv);
    return { k, wx, cv, omega, front, moving, dirX: Math.sign(s.to.wx - s.from.wx), dirV: Math.sign(s.to.cv - s.from.cv) };
  }

  let dpr = 1, S = 50, OX = 0, OY = 0, CW = 0, CH = 0, CLIP_X = 0, spin = 0;
  const THEME = {};

  const X = x => OX + x * S, Y = z => OY + z * S;

  // 紙張顆粒
  let grain = null;
  function makeGrain(){
    const g = document.createElement('canvas'); g.width = g.height = 220;
    const gc = g.getContext('2d'), img = gc.createImageData(220, 220);
    for (let i = 0; i < img.data.length; i += 4){
      const v = 200 + Math.random() * 55;
      img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    // 幾道淡淡的纖維
    gc.strokeStyle = 'rgba(120,90,60,0.12)'; gc.lineWidth = 1;
    for (let i = 0; i < 26; i++){
      const x = Math.random() * 220, y = Math.random() * 220, a = Math.random() * Math.PI;
      gc.beginPath(); gc.moveTo(x, y); gc.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); gc.stroke();
    }
    grain = ctx.createPattern(g, 'repeat');
  }

  /* ---------- 手繪線條 ---------- */
  const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  function wobblePath(pts, closed){
    // pts：螢幕座標；沿邊細分並加入些微抖動，像手繪線
    ctx.beginPath();
    const n = pts.length, last = closed ? n : n - 1;
    for (let i = 0; i < last; i++){
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(len / 16));
      for (let s = 0; s < steps; s++){
        const t = s / steps;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const jx = (hash(Math.round(x / 6), Math.round(y / 6)) - 0.5) * 1.6;
        const jy = (hash(Math.round(y / 6) + 7, Math.round(x / 6)) - 0.5) * 1.6;
        if (i === 0 && s === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy);
      }
    }
    if (closed) ctx.closePath();
    else { const e = pts[n - 1]; ctx.lineTo(e[0], e[1]); }
  }
  function rrPts(x, y, w, h, r){
    const pts = [], seg = 5;
    const corner = (cx, cy, a0) => { for (let i = 0; i <= seg; i++){ const a = a0 + (Math.PI / 2) * i / seg; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
  }
  function shape(pts, fill, opts){
    opts = opts || {};
    const sh = opts.shadow !== false;
    if (sh){
      ctx.save(); ctx.translate(5, 6);
      wobblePath(pts, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill();
      ctx.restore();
    }
    wobblePath(pts, true);
    ctx.fillStyle = fill; ctx.fill();
    if (opts.stroke !== false){
      ctx.lineWidth = opts.lw || 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = THEME['--ink'] || '#4B3A30'; ctx.stroke();
    }
  }
  function mix(hex, amt){  // amt>0 變亮，<0 變暗
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt > 0 ? 255 : 0, a = Math.abs(amt);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function star(x, y, r){
    ctx.beginPath();
    for (let i = 0; i < 8; i++){
      const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }  function arrow(x1, y1, x2, y2, color, curveTo){
    const ink = INK();
    const draw = (w, c) => {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (curveTo) ctx.quadraticCurveTo(curveTo[0], curveTo[1], x2, y2); else ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    draw(9, ink); draw(5, color);
    // 箭頭
    let dx, dy;
    if (curveTo){ dx = x2 - curveTo[0]; dy = y2 - curveTo[1]; } else { dx = x2 - x1; dy = y2 - y1; }
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const hs = 15, px = -dy, py = dx;
    ctx.beginPath();
    ctx.moveTo(x2 + dx * hs * 0.9, y2 + dy * hs * 0.9);
    ctx.lineTo(x2 + px * hs * 0.7, y2 + py * hs * 0.7);
    ctx.lineTo(x2 - px * hs * 0.7, y2 - py * hs * 0.7);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.strokeStyle = ink; ctx.stroke();
  }  function pill(text, x, y, color){
    ctx.font = '700 15px "LXGW WenKai TC","Kaiti TC","PingFang TC",serif';
    const w = ctx.measureText(text).width + 22, h = 28;
    const pts = rrPts(x - w / 2, y - h, w, h, 13);
    shape(pts, color, { lw: 2.2 });
    ctx.fillStyle = '#FFFBF2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2 + 1);
  }

  /* ---------- 繪製 ---------- */
  const INK = () => THEME['--ink'] || '#4B3A30';
  const C_RAW = '#A3B4BF', C_CUT = '#EEF5F8', C_BODY = '#6F8494', C_ARBOR = '#AFC0CC';
  const C_INS = '#F2C14E', C_INS_BACK = '#B8923A', C_TABLE = '#E9D2B0', C_CHIP = '#E0913A', C_CHALK = '#F4C542';

  function backdrop(){
    ctx.fillStyle = THEME['--paper'] || '#F7F0E1';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = THEME['--blob1'] || '#E6F0E2';
    ctx.beginPath(); ctx.ellipse(X(0), Y(-0.6), S * 5.8, S * 2.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = THEME['--blob2'] || '#FCE6D2';
    ctx.beginPath(); ctx.ellipse(X(-3.8), Y(-2.4), S * 1.4, S * 1.1, 0.2, 0, Math.PI * 2); ctx.fill();
  }

  function hGrad(x0, x1, base){   // 圓柱側面的左右明暗
    const g = ctx.createLinearGradient(X(x0), 0, X(x1), 0);
    g.addColorStop(0, mix(base, -0.22));
    g.addColorStop(0.3, mix(base, 0.3));
    g.addColorStop(0.5, base);
    g.addColorStop(1, mix(base, -0.25));
    return g;
  }

  function drawTable(wx){
    // 工作台跟著工件移動，上面的 T 型槽記號也一起走
    const top = H, h = 0.32;
    shape(rrPts(X(wx - 7), Y(top), S * 14, S * h, S * 0.1), C_TABLE);
    ctx.strokeStyle = mix(C_TABLE, -0.25); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let x = -6.5; x <= 6.5; x += 1.0){
      wobblePath([[X(wx + x), Y(top + 0.1)], [X(wx + x + 0.35), Y(top + 0.1)]], false); ctx.stroke();
    }
  }

  function drawWork(st){
    const xl = st.wx - A, xr = st.wx + A;
    let step = null;
    if (st.front !== Infinity && st.front - RC < A) step = st.wx + Math.max(-A, st.front - RC);
    const pts = [];
    if (step === null){ pts.push([xl, 0], [xr, 0]); }
    else if (step <= xl + 1e-6){ pts.push([xl, D], [xr, D]); }
    else { pts.push([xl, 0], [step, 0], [step, D], [xr, D]); }
    pts.push([xr, H], [xl, H]);
    const scr = pts.map(p => [X(p[0]), Y(p[1])]);

    ctx.save(); ctx.translate(5, 6);
    wobblePath(scr, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill();
    ctx.restore();
    wobblePath(scr, true);
    const g = ctx.createLinearGradient(0, Y(0), 0, Y(H));
    g.addColorStop(0, mix(C_RAW, 0.18)); g.addColorStop(1, mix(C_RAW, -0.12));
    ctx.fillStyle = g; ctx.fill();

    // 銑過的新表面：亮亮的一條，加上小閃光
    if (step !== null){
      const a = Math.max(xl, step);
      ctx.fillStyle = C_CUT;
      ctx.fillRect(X(a), Y(D), (xr - a) * S, S * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let x = a + 0.5; x < xr - 0.2; x += 1.3) star(X(x), Y(D + 0.3), S * 0.07);
    }
    // 還沒加工的上表面：黃色粉筆記號
    const rawEnd = step === null ? xr : step;
    if (rawEnd > xl + 0.2){
      ctx.strokeStyle = C_CHALK; ctx.lineWidth = Math.max(2, S * 0.05); ctx.lineCap = 'round';
      wobblePath([[X(xl + 0.2), Y(0.12)], [X(rawEnd - 0.1), Y(0.12)]], false); ctx.stroke();
    }
    wobblePath(scr, true);
    ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.strokeStyle = INK(); ctx.stroke();
    // 虛線：原本的上表面高度，看得出削掉了多少
    if (step !== null){
      const a = Math.max(xl, step);
      ctx.save();
      ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = INK(); ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(X(a), Y(0)); ctx.lineTo(X(xr), Y(0)); ctx.lineTo(X(xr), Y(D)); ctx.stroke();
      ctx.restore();
    }
  }

  function inserts(front, cv){
    const list = [];
    for (let n = 0; n < INSERTS; n++){
      const th = spin + n * 2 * Math.PI / INSERTS;
      list.push({ s: Math.sin(th), c: Math.cos(th) });
    }
    list.filter(j => (j.c > 0) === front).sort((a, b) => a.c - b.c).forEach(j => {
      const xc = 1.53 * j.s;
      const w = 0.12 + 0.2 * Math.abs(j.s);
      if (front){
        // 刀片前方的排屑槽
        const gx = xc - (w / 2 + 0.16) * Math.max(0.35, j.c);
        shape(rrPts(X(gx - 0.08), Y(cv - 0.5), S * 0.16 * Math.max(0.4, j.c), S * 0.38, S * 0.04), mix(C_BODY, -0.45), { shadow: false, stroke: false });
      }
      shape(rrPts(X(xc - w / 2), Y(cv - 0.36), S * w, S * 0.36, S * 0.04), front ? C_INS : C_INS_BACK, { shadow: front, lw: 2.2 });
      if (front && j.c > 0.35){
        ctx.fillStyle = INK();
        ctx.beginPath(); ctx.arc(X(xc), Y(cv - 0.18), S * 0.04, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function drawCutter(st){
    const cv = st.cv;
    inserts(false, cv);
    // 刀盤本體
    const bodyPts = rrPts(X(-RB), Y(cv - 0.8), S * 2 * RB, S * 0.7, S * 0.1);
    ctx.save(); ctx.translate(5, 6); wobblePath(bodyPts, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill(); ctx.restore();
    wobblePath(bodyPts, true); ctx.fillStyle = hGrad(-RB, RB, C_BODY); ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = INK(); ctx.stroke();
    inserts(true, cv);
    // 刀軸
    const arbPts = rrPts(X(-0.62), Y(cv - 2.12), S * 1.24, S * 1.34, S * 0.06);
    wobblePath(arbPts, true); ctx.fillStyle = hGrad(-0.62, 0.62, C_ARBOR); ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = INK(); ctx.stroke();
    // 刀軸上的粉筆線，跟著轉
    const c = Math.cos(spin), sx = 0.56 * Math.sin(spin);
    if (c > 0){
      ctx.globalAlpha = Math.min(1, c * 1.8);
      ctx.strokeStyle = C_CHALK; ctx.lineWidth = Math.max(2, S * 0.07 * c); ctx.lineCap = 'round';
      wobblePath([[X(sx), Y(cv - 1.98)], [X(sx), Y(cv - 0.95)]], false); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 主軸頭
    shape(rrPts(X(-0.95), Y(cv - 2.55), S * 1.9, S * 0.45, S * 0.14), '#86AED0');
  }

  /* ---------- 切屑 ---------- */
  const chips = [];
  let chipTimer = 0;
  function spawnChip(x, v){
    chips.push({ x, z: v, vx: -(0.9 + Math.random() * 1.3), vz: -(0.8 + Math.random() * 1.2),
                 rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, life: 0 });
    if (chips.length > 70) chips.shift();
  }
  function drawChips(dt){
    for (let i = chips.length - 1; i >= 0; i--){
      const c = chips[i];
      c.life += dt; c.x += c.vx * dt; c.z += c.vz * dt; c.vz += 3.2 * dt; c.rot += c.vr * dt;
      if (c.life > 1.5){ chips.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = c.life > 1.0 ? (1.5 - c.life) / 0.5 : 1;
      ctx.translate(X(c.x), Y(c.z)); ctx.rotate(c.rot);
      ctx.strokeStyle = C_CHIP; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.06){
        const ang = t * Math.PI * 2.4, rr = S * 0.08 * (0.4 + t * 0.6);
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFrame(simTime, sdt, playing){
    const st = stateAt(simTime), s = stages[st.k];
    spin -= st.omega * sdt;                       // 俯視順時針：正面的刀片往左走

    if (playing && s.type === 'feed'){
      const lead = st.front - RC;
      if (lead < A && lead > -A){
        chipTimer += sdt;
        while (chipTimer > 0.05){ chipTimer -= 0.05; spawnChip(st.wx + lead - 0.05, D - 0.05); }
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop();
    if (CLIP_X){ ctx.save(); ctx.beginPath(); ctx.rect(CLIP_X, 0, CW - CLIP_X, CH); ctx.clip(); }
    drawTable(st.wx);
    drawWork(st);
    drawCutter(st);
    drawChips(sdt);

    const spinVis = st.omega / W_MAX;
    if (spinVis > 0.05){
      ctx.globalAlpha = Math.min(1, spinVis * 1.4);
      const va = st.cv - 1.55, col = THEME['--rot'] || '#3D7CC9';
      arrow(X(1.1), Y(va), X(-1.1), Y(va - 0.05), col, [X(0), Y(va + 0.75)]);
      pill('刀盤旋轉', X(-1.55), Y(va - 0.2), col);
      ctx.globalAlpha = 1;
    }

    if (st.moving && s.type !== 'spin' && s.type !== 'stop'){
      const isCut = s.type === 'feed' || s.type === 'infeed';
      const col = isCut ? (THEME['--feed'] || '#E35D4F') : (THEME['--rapid'] || '#A0928A');
      if (s.type === 'infeed' || s.type === 'retract'){
        const x = RB + 0.75, vc = st.cv - 0.6;
        arrow(X(x), Y(vc - 0.45 * st.dirV), X(x), Y(vc + 0.45 * st.dirV), col);
        pill(s.type === 'infeed' ? '下刀' : '抬刀', X(x), Y(vc - 0.6), col);
      } else {
        const vc = 0.62;
        arrow(X(st.wx - 0.6 * st.dirX), Y(vc), X(st.wx + 0.6 * st.dirX), Y(vc), col);
        pill(s.type === 'feed' ? '工件進給' : '快速移動', X(st.wx), Y(vc - 0.1), col);
      }
    }

    if (CLIP_X) ctx.restore();

    if (grain){
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = grain; ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    return st;
  }

  return {
    stages, TOTAL, VIEW, stateAt, drawFrame, theme: THEME,
    /** 版面：dpr、畫布 CSS 寬高、左側裁切線 clipX、世界→畫面比例 S 與原點 OX/OY */
    layout(o){ dpr = o.dpr; CW = o.width; CH = o.height; CLIP_X = o.clipX || 0; S = o.S; OX = o.OX; OY = o.OY; makeGrain(); },
    /** 換頁或重播時清掉還在飛的切屑 */
    clearChips(){ chips.length = 0; },
  };
}

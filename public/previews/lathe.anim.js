// 車床繪本動畫的繪圖程式：網站的 previews/lathe.html 與 VR 大門口的動畫螢幕共用這一份。
// createAnimation(ctx) 回傳的 drawFrame(simTime, sdt, playing) 畫出動畫時間 simTime 的一格；
// sdt 是這一格前進的動畫秒數（旋轉角度與切屑會累積，所以要逐格呼叫）。版面由呼叫端用 layout() 指定。
export function createAnimation(ctx){
  /* ---------- 尺寸（世界座標：俯視圖，x 向右，z 向下＝朝向操作者） ---------- */
  const R0 = 1.0, R1 = 0.8, R2 = 0.6;
  const L1 = 3.0, FACE = -3.0;              // 工件右端、夾頭端面
  const W_MAX = 7.0;
  const REST = { x: 4.4, z: 2.5 };
  const START_X = L1 + 0.35;
  const FEED1_END = -1.8, FEED2_END = 0.4;
  const VIEW = { x0: -4.5, x1: 5.4, z0: -2.1, z1: 4.4 };

  const stages = [
    { type:'spin',    dur:2.0, to:REST, name:'主軸啟動',
      desc:'夾頭夾住圓棒，開始轉呀轉。工件的旋轉就是車削的「主運動」。' },
    { type:'rapid',   dur:1.6, to:{x:START_X, z:R0+0.3}, name:'快速接近',
      desc:'車刀快快地跑到工件右邊，還沒碰到工件，所以不會切削。' },
    { type:'infeed',  dur:1.0, to:{x:START_X, z:R1}, name:'徑向進刀',
      desc:'車刀往工件中心靠近一點點，決定這一刀要削掉多厚。' },
    { type:'feed',    dur:5.5, to:{x:FEED1_END, z:R1}, name:'縱向進給（第一刀）',
      desc:'車刀沿著工件慢慢往左走。工件每轉一圈，刀就前進一小步，走過的地方就變細了。' },
    { type:'retract', dur:0.8, to:{x:FEED1_END, z:R1+0.35}, name:'徑向退刀',
      desc:'刀尖先離開工件，回去的時候才不會刮傷剛削好的表面。' },
    { type:'rapid',   dur:1.4, to:{x:START_X, z:R1+0.35}, name:'快速回位',
      desc:'車刀快快跑回右邊，準備削第二刀。' },
    { type:'infeed',  dur:1.0, to:{x:START_X, z:R2}, name:'徑向進刀',
      desc:'這次再靠近中心一點，要削得更深。' },
    { type:'feed',    dur:4.0, to:{x:FEED2_END, z:R2}, name:'縱向進給（第二刀）',
      desc:'第二刀只走一半的路。工件出現兩種粗細，像階梯一樣，叫做階梯軸。' },
    { type:'retract', dur:0.8, to:{x:FEED2_END, z:R2+0.55}, name:'徑向退刀',
      desc:'刀尖離開工件。' },
    { type:'rapid',   dur:1.8, to:REST, name:'回到原位',
      desc:'車刀回到一開始的位置休息。' },
    { type:'stop',    dur:1.5, to:REST, name:'主軸停止',
      desc:'工件停下來了。原本的圓棒，被削成了一根階梯軸！' }
  ];
  let acc = 0, prevTo = REST;
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
    const x = s.from.x + (s.to.x - s.from.x) * e;
    const z = s.from.z + (s.to.z - s.from.z) * e;
    let omega = W_MAX;
    if (s.type === 'spin') omega = W_MAX * smooth(p);
    if (s.type === 'stop') omega = W_MAX * (1 - smooth(p));
    const f1 = k < 3 ? L1 : (k === 3 ? Math.min(L1, x) : FEED1_END);
    const f2 = k < 7 ? L1 : (k === 7 ? Math.min(L1, x) : FEED2_END);
    const moving = p < 1 && (s.from.x !== s.to.x || s.from.z !== s.to.z);
    return { k, x, z, omega, f1, f2, moving, dx: s.to.x - s.from.x, dz: s.to.z - s.from.z };
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

  /* ---------- 繪製各部件 ---------- */
  const INK = () => THEME['--ink'] || '#4B3A30';
  const C_RAW = '#A3B4BF', C_CUT = '#E9F1F5', C_CHALK = '#F4C542';
  const C_CHUCK = '#86AED0', C_JAW = '#5F8BB0', C_HOLDER = '#F29E4C', C_INSERT = '#4E525C', C_CHIP = '#E0913A';

  function backdrop(){
    ctx.fillStyle = THEME['--paper'] || '#F7F0E1';
    ctx.fillRect(0, 0, CW, CH);
    // 背景色塊，像繪本裡的底色
    ctx.fillStyle = THEME['--blob1'] || '#E6F0E2';
    ctx.beginPath(); ctx.ellipse(X(-0.4), Y(0.9), S * 5.6, S * 3.2, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = THEME['--blob2'] || '#FCE6D2';
    ctx.beginPath(); ctx.ellipse(X(3.9), Y(2.6), S * 1.8, S * 1.5, 0.3, 0, Math.PI * 2); ctx.fill();
  }

  function drawChuck(){
    shape(rrPts(X(-4.25), Y(-1.8), S * 1.25, S * 3.6, S * 0.22), C_CHUCK);
    // 端面的圓環示意
    ctx.strokeStyle = mix('#86AED0', -0.25); ctx.lineWidth = 2;
    wobblePath([[X(-3.35), Y(-1.5)], [X(-3.35), Y(1.5)]], false); ctx.stroke();
  }
  function drawJaws(front){
    const rj = R0 + 0.21;
    const list = [];
    for (let n = 0; n < 3; n++){
      const th = spin + n * 2 * Math.PI / 3 + 0.5;
      list.push({ th, c: Math.cos(th), s: Math.sin(th) });
    }
    list.forEach(j => {
      const visible = j.c > 0;
      if (visible !== front) return;
      const h = 0.46 * Math.abs(j.c) + 0.2;
      const yc = rj * j.s;
      const col = visible ? C_JAW : mix(C_JAW, -0.25);
      shape(rrPts(X(-3.05), Y(yc - h / 2), S * 0.52, S * h, S * 0.07), col, { shadow: visible, lw: 2.2 });
    });
  }

  function cylGrad(r, base){
    const g = ctx.createLinearGradient(0, Y(-r), 0, Y(r));
    g.addColorStop(0, mix(base, -0.08));
    g.addColorStop(0.2, mix(base, 0.35));
    g.addColorStop(0.38, base);
    g.addColorStop(0.8, mix(base, -0.1));
    g.addColorStop(1, mix(base, -0.22));
    return g;
  }

  function drawWorkpiece(st){
    const segs = [];
    if (st.f1 > FACE) segs.push({ a: FACE, b: st.f1, r: R0, cut: false });
    if (st.f2 > st.f1) segs.push({ a: st.f1, b: st.f2, r: R1, cut: true });
    if (L1 > st.f2) segs.push({ a: st.f2, b: L1, r: R2, cut: true });

    // 外形（階梯輪廓）
    const top = [], bot = [];
    segs.forEach(sg => { top.push([X(sg.a), Y(-sg.r)], [X(sg.b), Y(-sg.r)]); bot.push([X(sg.a), Y(sg.r)], [X(sg.b), Y(sg.r)]); });
    const outline = top.concat(bot.reverse());

    // 陰影
    ctx.save(); ctx.translate(5, 7);
    wobblePath(outline, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill();
    ctx.restore();

    // 各段上色：圓柱漸層＋車削紋
    segs.forEach(sg => {
      ctx.fillStyle = cylGrad(sg.r, sg.cut ? C_CUT : C_RAW);
      ctx.fillRect(X(sg.a) - 0.5, Y(-sg.r), (sg.b - sg.a) * S + 1, 2 * sg.r * S);
      if (sg.cut){
        ctx.strokeStyle = 'rgba(90,120,140,0.16)'; ctx.lineWidth = 1;
        for (let x = sg.a + 0.03; x < sg.b; x += 0.075){
          ctx.beginPath(); ctx.moveTo(X(x), Y(-sg.r) + 2); ctx.lineTo(X(x) + S * 0.02, Y(sg.r) - 2); ctx.stroke();
        }
        // 亮晶晶的光點
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const mx = (sg.a + sg.b) / 2;
        star(X(mx), Y(-sg.r * 0.55), S * 0.07);
      }
    });

    // 粉筆線：畫在未加工的表面上，會跟著旋轉，被車刀削掉
    const raw = segs.find(s => !s.cut);
    if (raw){
      for (let n = 0; n < 2; n++){
        const th = spin + n * Math.PI;
        const c = Math.cos(th);
        if (c <= 0) continue;
        const yy = raw.r * Math.sin(th);
        ctx.strokeStyle = C_CHALK; ctx.globalAlpha = Math.min(1, c * 1.6);
        ctx.lineWidth = Math.max(2, S * 0.07 * c); ctx.lineCap = 'round';
        wobblePath([[X(-2.5), Y(yy)], [X(raw.b) - 3, Y(yy)]], false); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 外框線
    wobblePath(outline, true);
    ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.strokeStyle = INK(); ctx.stroke();
  }

  function star(x, y, r){
    ctx.beginPath();
    for (let i = 0; i < 8; i++){
      const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawTool(st){
    const tx = st.x, tz = st.z;
    // 刀桿
    shape(rrPts(X(tx - 0.08), Y(tz + 0.24), S * 0.48, S * 1.9, S * 0.08), C_HOLDER);
    // 刀桿上的小裝飾線
    ctx.strokeStyle = mix(C_HOLDER, -0.2); ctx.lineWidth = 2;
    wobblePath([[X(tx + 0.02), Y(tz + 1.0)], [X(tx + 0.3), Y(tz + 1.0)]], false); ctx.stroke();
    // 刀片（菱形），刀尖在 (tx, tz)
    const a = 0.3, pts = [[0, 0], [0.24, 0.36], [0, 0.72], [-0.24, 0.36]].map(([px, pz]) => {
      const rx = px * Math.cos(a) - pz * Math.sin(a), rz = px * Math.sin(a) + pz * Math.cos(a);
      return [X(tx + rx), Y(tz + rz)];
    });
    shape(pts, C_INSERT, { lw: 2.4 });
    ctx.fillStyle = '#C9CED6';
    ctx.beginPath(); ctx.arc(X(tx - 0.1), Y(tz + 0.34), S * 0.055, 0, Math.PI * 2); ctx.fill();
  }

  function arrow(x1, y1, x2, y2, color, curveTo){
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
  }

  function pill(text, x, y, color){
    ctx.font = '700 15px "LXGW WenKai TC","Kaiti TC","PingFang TC",serif';
    const w = ctx.measureText(text).width + 22, h = 28;
    const pts = rrPts(x - w / 2, y - h, w, h, 13);
    shape(pts, color, { lw: 2.2 });
    ctx.fillStyle = '#FFFBF2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2 + 1);
  }

  /* ---------- 切屑 ---------- */
  const chips = [];
  let chipTimer = 0;
  function spawnChip(x, z){
    chips.push({ x: x + 0.05, z: z + 0.05, vx: 0.3 + Math.random() * 0.9, vz: 1.0 + Math.random() * 1.2,
                 rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 0 });
    if (chips.length > 60) chips.shift();
  }
  function drawChips(dt){
    for (let i = chips.length - 1; i >= 0; i--){
      const c = chips[i];
      c.life += dt; c.x += c.vx * dt; c.z += c.vz * dt; c.vz += 1.6 * dt; c.rot += c.vr * dt;
      if (c.life > 1.6){ chips.splice(i, 1); continue; }
      const a = c.life > 1.1 ? (1.6 - c.life) / 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(X(c.x), Y(c.z)); ctx.rotate(c.rot);
      ctx.strokeStyle = C_CHIP; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05){
        const ang = t * Math.PI * 4, rr = S * 0.1 * (0.3 + t * 0.7);
        const px = Math.cos(ang) * rr + t * S * 0.12, py = Math.sin(ang) * rr;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFrame(simTime, sdt, playing){
    const st = stateAt(simTime), s = stages[st.k];
    spin += st.omega * sdt;

    if (playing && s.type === 'feed' && st.x <= L1 + 0.02){
      chipTimer += sdt;
      while (chipTimer > 0.08){ chipTimer -= 0.08; spawnChip(st.x, st.z); }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop();
    if (CLIP_X){ ctx.save(); ctx.beginPath(); ctx.rect(CLIP_X, 0, CW - CLIP_X, CH); ctx.clip(); }
    drawChuck();
    drawJaws(false);
    drawWorkpiece(st);
    drawJaws(true);

    // 旋轉箭頭：看得到的那一面往下（朝車刀方向）轉
    const spinVis = st.omega / W_MAX;
    if (spinVis > 0.05){
      ctx.globalAlpha = Math.min(1, spinVis * 1.4);
      const ax = -1.95;
      arrow(X(ax), Y(-1.4), X(ax + 0.05), Y(1.35), THEME['--rot'] || '#3D7CC9', [X(ax + 0.95), Y(0)]);
      pill('工件旋轉', X(ax), Y(-1.5), THEME['--rot'] || '#3D7CC9');
      ctx.globalAlpha = 1;
    }

    drawTool(st);
    drawChips(sdt);

    // 刀具移動箭頭
    if (st.moving && s.type !== 'spin' && s.type !== 'stop'){
      const L = Math.hypot(st.dx, st.dz) || 1, ux = st.dx / L, uz = st.dz / L;
      const cx = st.x + 1.15, cz = st.z + 0.95;
      const isCut = s.type === 'feed' || s.type === 'infeed';
      const col = isCut ? (THEME['--feed'] || '#E35D4F') : (THEME['--rapid'] || '#A0928A');
      arrow(X(cx - ux * 0.45), Y(cz - uz * 0.45), X(cx + ux * 0.45), Y(cz + uz * 0.45), col);
      const label = { rapid:'快速移動', infeed:'進刀', feed:'進給', retract:'退刀' }[s.type];
      pill(label, X(cx), Y(cz - 0.55), col);
    }

    if (CLIP_X) ctx.restore();

    // 紙張質感
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

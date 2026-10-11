// 鑽床繪本動畫的繪圖程式：網站的 previews/drill.html 與 VR 大門口的動畫螢幕共用這一份。
// createAnimation(ctx) 回傳的 drawFrame(simTime, sdt, playing) 畫出動畫時間 simTime 的一格；
// sdt 是這一格前進的動畫秒數（旋轉角度與切屑會累積，所以要逐格呼叫）。版面由呼叫端用 layout() 指定。
export function createAnimation(ctx){
  /* ---------- 尺寸（剖面正視圖：x 向右，v 向下，工件上表面 v=0） ---------- */
  const BX = 1.6, BH = 1.8, RH = 0.38;
  const TAN59 = Math.tan(59 * Math.PI / 180);
  const CONE_H = RH / TAN59;
  const FLUTE_L = 1.9, SHANK_L = 0.6, PITCH = 1.45;
  const W_MAX = 5.0;
  const UP_Y = 0.65, NEAR_Y = 0.12, PECK_D = 0.7, FINAL_D = 1.3;
  const VIEW = { x0: -2.7, x1: 3.0, z0: -4.2, z1: 2.1 };

  const stages = [
    { type:'spin',    dur:2.0, to:UP_Y,           name:'主軸啟動',
      desc:'鑽頭開始轉囉！鑽孔和銑削一樣，是刀具在轉，工件乖乖不動。工件切開一半，讓你看得到孔的裡面。' },
    { type:'rapid',   dur:1.2, to:NEAR_Y,         name:'快速下降',
      desc:'鑽頭快快降到工件上方，還沒碰到工件。' },
    { type:'feed',    dur:3.4, to:-PECK_D,        name:'往下鑽',
      desc:'鑽頭一邊轉一邊往下。尖尖的鑽尖把材料削下來，切屑順著螺旋溝槽一路往上爬出來。' },
    { type:'retract', dur:1.0, to:0.3,            name:'啄鑽：先退出來',
      desc:'鑽到一半先整支退出來，把溝槽裡的切屑甩掉。這叫「啄鑽」，像小鳥啄東西一樣一下一下地鑽，切屑才不會卡住。' },
    { type:'rapid',   dur:0.8, to:-PECK_D + 0.08, name:'回到孔裡',
      desc:'鑽頭快快回到剛剛的深度附近。' },
    { type:'feed',    dur:3.0, to:-FINAL_D,       name:'繼續往下鑽',
      desc:'繼續鑽到需要的深度。孔底留下尖尖的錐形，因為鑽尖就是這個形狀。沒有鑽穿的孔叫做盲孔。' },
    { type:'retract', dur:1.4, to:UP_Y,           name:'退刀',
      desc:'鑽頭退出孔外，回到上面。' },
    { type:'stop',    dur:1.5, to:UP_Y,           name:'主軸停止',
      desc:'鑽頭停下來休息，一個漂亮的孔完成了！' }
  ];
  let acc = 0, prevTo = UP_Y;
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
    const tipY = s.from + (s.to - s.from) * e;
    let omega = W_MAX;
    if (s.type === 'spin') omega = W_MAX * smooth(p);
    if (s.type === 'stop') omega = W_MAX * (1 - smooth(p));
    let depth = 0;
    if (k === 2) depth = Math.max(0, -tipY);
    else if (k > 2 && k < 5) depth = PECK_D;
    else if (k === 5) depth = Math.max(PECK_D, -tipY);
    else if (k > 5) depth = FINAL_D;
    return { k, tipV: -tipY, omega, depth, moving: p < 1 && s.from !== s.to, dirV: -Math.sign(s.to - s.from) };
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
  const C_SEC = '#F6DCC0', C_HATCH = 'rgba(160,110,70,0.45)', C_HOLE = '#E4ECF1';
  const C_LAND = '#DCE5EA', C_FLUTE = '#7A8893', C_SHANK = '#BFCBD3', C_CHUCK = '#86AED0', C_CHIP = '#E0913A', C_CHALK = '#F4C542';

  let hatch = null;
  function makeHatch(){
    const c = document.createElement('canvas'); c.width = c.height = 18;
    const g = c.getContext('2d');
    g.fillStyle = C_SEC; g.fillRect(0, 0, 18, 18);
    g.strokeStyle = C_HATCH; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-2, 20); g.lineTo(20, -2); g.stroke();
    g.beginPath(); g.moveTo(-2, 2); g.lineTo(2, -2); g.stroke();
    g.beginPath(); g.moveTo(16, 20); g.lineTo(20, 16); g.stroke();
    hatch = ctx.createPattern(c, 'repeat');
  }

  function backdrop(){
    ctx.fillStyle = THEME['--paper'] || '#F7F0E1';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = THEME['--blob1'] || '#E6F0E2';
    ctx.beginPath(); ctx.ellipse(X(0.1), Y(-0.6), S * 3.2, S * 3.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = THEME['--blob2'] || '#FCE6D2';
    ctx.beginPath(); ctx.ellipse(X(2.2), Y(-3.0), S * 0.9, S * 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
  }

  function holePts(d){
    const rTop = Math.min(RH, d * TAN59);
    if (d <= 0) return null;
    if (d <= CONE_H) return [[-rTop, 0], [0, d], [rTop, 0]];
    return [[-RH, 0], [-RH, d - CONE_H], [0, d], [RH, d - CONE_H], [RH, 0]];
  }

  function drawWork(d){
    const hp = holePts(d);
    const pts = [[-BX, 0]];
    if (hp) hp.forEach(p => pts.push(p));
    pts.push([BX, 0], [BX, BH], [-BX, BH]);
    const scr = pts.map(p => [X(p[0]), Y(p[1])]);
    ctx.save(); ctx.translate(5, 6); wobblePath(scr, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill(); ctx.restore();
    // 剖面：斜線
    wobblePath(scr, true);
    ctx.save(); ctx.translate(X(0), Y(0)); ctx.fillStyle = hatch; ctx.fill(); ctx.restore();
    // 孔的內壁（後半圈），中間亮、兩側暗
    if (hp){
      const hs = hp.map(p => [X(p[0]), Y(p[1])]);
      ctx.beginPath(); hs.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      const g = ctx.createLinearGradient(X(-RH), 0, X(RH), 0);
      g.addColorStop(0, mix(C_HOLE, -0.3)); g.addColorStop(0.35, mix(C_HOLE, 0.4)); g.addColorStop(1, mix(C_HOLE, -0.35));
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      if (d > 0.4) star(X(-RH * 0.35), Y(d * 0.45), S * 0.06);
    }
    wobblePath(scr, true);
    ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.strokeStyle = INK(); ctx.stroke();
  }

  function drawDrill(tipV){
    const top = tipV - FLUTE_L;
    const body = [[0, tipV], [-RH, tipV - CONE_H], [-RH, top], [RH, top], [RH, tipV - CONE_H]].map(p => [X(p[0]), Y(p[1])]);
    // 陰影
    ctx.save(); ctx.translate(5, 6); wobblePath(body, true); ctx.fillStyle = 'rgba(75,58,48,0.13)'; ctx.fill(); ctx.restore();

    // 刃帶底色
    ctx.save();
    wobblePath(body, true); ctx.clip();
    ctx.fillStyle = C_LAND; ctx.fillRect(X(-RH) - 4, Y(top) - 2, S * 2 * RH + 8, S * FLUTE_L + 4);
    // 螺旋溝槽：逐列計算正面看得到的溝槽範圍，旋轉時溝槽看起來往上爬
    ctx.fillStyle = C_FLUTE;
    const k = 2 * Math.PI / PITCH;
    const rowH = 1.5 / S;
    for (let v = top; v < tipV; v += rowH){
      const y = tipV - v;                                   // 從鑽尖往上的距離
      const w = RH * Math.min(1, y / CONE_H);
      const c = (((k * y + spin) % Math.PI) + Math.PI) % Math.PI;
      for (let n = -3; n <= 2; n++){
        let a0 = c + Math.PI / 2 + n * Math.PI, a1 = c + Math.PI + n * Math.PI;
        a0 = Math.max(a0, -Math.PI / 2); a1 = Math.min(a1, Math.PI / 2);
        if (a1 <= a0) continue;
        const x0 = w * Math.sin(a0), x1 = w * Math.sin(a1);
        ctx.fillRect(X(x0), Y(v), (x1 - x0) * S, 1.8);
      }
    }
    // 圓柱明暗
    const g = ctx.createLinearGradient(X(-RH), 0, X(RH), 0);
    g.addColorStop(0, 'rgba(60,50,40,0.28)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,50,40,0.32)');
    ctx.fillStyle = g; ctx.fillRect(X(-RH) - 4, Y(top) - 2, S * 2 * RH + 8, S * FLUTE_L + 4);
    ctx.restore();
    wobblePath(body, true);
    ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.strokeStyle = INK(); ctx.stroke();

    // 鑽柄
    const sh = rrPts(X(-RH * 0.95), Y(top - SHANK_L), S * RH * 1.9, S * (SHANK_L + 0.03), S * 0.03);
    wobblePath(sh, true);
    const g2 = ctx.createLinearGradient(X(-RH), 0, X(RH), 0);
    g2.addColorStop(0, mix(C_SHANK, -0.2)); g2.addColorStop(0.3, mix(C_SHANK, 0.35)); g2.addColorStop(1, mix(C_SHANK, -0.25));
    ctx.fillStyle = g2; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK(); ctx.stroke();

    // 鑽夾頭
    const cTop = top - SHANK_L;
    shape([[X(-0.45), Y(cTop + 0.02)], [X(0.45), Y(cTop + 0.02)], [X(0.72), Y(cTop - 0.32)], [X(-0.72), Y(cTop - 0.32)]], C_CHUCK);
    shape(rrPts(X(-0.72), Y(cTop - 1.0), S * 1.44, S * 0.7, S * 0.1), mix(C_CHUCK, -0.08));
    // 夾頭上的粉筆線，跟著轉
    for (let n = 0; n < 2; n++){
      const th = spin + n * Math.PI, c = Math.cos(th);
      if (c <= 0) continue;
      ctx.globalAlpha = Math.min(1, c * 1.8);
      ctx.strokeStyle = C_CHALK; ctx.lineWidth = Math.max(2, S * 0.07 * c); ctx.lineCap = 'round';
      const sx = 0.62 * Math.sin(th);
      wobblePath([[X(sx), Y(cTop - 0.9)], [X(sx), Y(cTop - 0.4)]], false); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return cTop;
  }

  /* ---------- 切屑 ---------- */
  const chips = [];
  let chipTimer = 0, burstDone = false;
  function spawnChip(v, fling){
    const side = Math.random() < 0.5 ? -1 : 1;
    chips.push({ x: side * RH * 0.95, z: v, vx: side * ((fling ? 1.8 : 0.8) + Math.random() * 0.9), vz: -(1.2 + Math.random() * 1.2),
                 rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, life: 0 });
    if (chips.length > 70) chips.shift();
  }
  function drawChips(dt){
    for (let i = chips.length - 1; i >= 0; i--){
      const c = chips[i];
      c.life += dt; c.x += c.vx * dt; c.z += c.vz * dt; c.vz += 4.5 * dt; c.rot += c.vr * dt;
      if (Math.abs(c.x) < BX + 0.1 && Math.abs(c.x) > RH && c.z > -0.04 && c.vz > 0){ c.z = -0.04; c.vx = 0; c.vz = 0; c.vr = 0; }
      if (c.life > 1.8){ chips.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = c.life > 1.3 ? (1.8 - c.life) / 0.5 : 1;
      ctx.translate(X(c.x), Y(c.z)); ctx.rotate(c.rot);
      ctx.strokeStyle = C_CHIP; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05){
        const ang = t * Math.PI * 3.6, rr = S * 0.08 * (0.3 + t * 0.7);
        const px = Math.cos(ang) * rr + t * S * 0.1, py = Math.sin(ang) * rr;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFrame(simTime, sdt, playing){
    const st = stateAt(simTime), s = stages[st.k];
    spin -= st.omega * sdt;               // 俯視順時針

    if (playing && s.type === 'feed' && st.tipV > 0){
      chipTimer += sdt;
      while (chipTimer > 0.09){ chipTimer -= 0.09; spawnChip(-0.05, false); }
    }
    if (st.k === 3 && st.tipV < -0.05 && !burstDone && playing){
      burstDone = true;
      for (let i = 0; i < 12; i++) spawnChip(-0.1 - Math.random() * 0.6, true);
    }
    if (st.k < 3) burstDone = false;

    if (!hatch) makeHatch();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop();
    if (CLIP_X){ ctx.save(); ctx.beginPath(); ctx.rect(CLIP_X, 0, CW - CLIP_X, CH); ctx.clip(); }
    // 地面
    shape(rrPts(X(-2.4), Y(BH), S * 4.8, S * 0.22, S * 0.1), '#E9D2B0');
    drawWork(st.depth);
    const cTop = drawDrill(st.tipV);
    drawChips(sdt);

    const spinVis = st.omega / W_MAX;
    if (spinVis > 0.05){
      ctx.globalAlpha = Math.min(1, spinVis * 1.4);
      const va = st.tipV - FLUTE_L - 0.3, col = THEME['--rot'] || '#3D7CC9';
      arrow(X(0.85), Y(va), X(-0.85), Y(va - 0.04), col, [X(0), Y(va + 0.55)]);
      pill('鑽頭旋轉', X(-1.35), Y(va - 0.15), col);
      ctx.globalAlpha = 1;
    }

    if (st.moving && s.type !== 'spin' && s.type !== 'stop'){
      const isCut = s.type === 'feed';
      const col = isCut ? (THEME['--feed'] || '#E35D4F') : (THEME['--rapid'] || '#A0928A');
      const x = RH + 0.75, vc = st.tipV - 0.9;
      arrow(X(x), Y(vc - 0.4 * st.dirV), X(x), Y(vc + 0.4 * st.dirV), col);
      const label = { rapid: '快速移動', feed: '往下進給', retract: '退刀' }[s.type];
      pill(label, X(x + 0.35), Y(vc - 0.6), col);
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

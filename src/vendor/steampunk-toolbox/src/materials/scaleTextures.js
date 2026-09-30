// 刻度貼花：公制 / 英制 / 游標，透明底的黑色蝕刻刻線
import * as THREE from 'three';
import { makeCanvas, toTexture } from './textures.js';

// spanMm：貼花涵蓋的實際長度；ticks：[{from, count, stepMm, edge:'bottom'|'top', long, mid, labelEvery, label}]
export function etchedScale({ spanMm, heightMm, pxPerMm = 22, marks = [], texts = [] }) {
  const W = Math.round(spanMm * pxPerMm), H = Math.round(heightMm * pxPerMm);
  const c = makeCanvas(Math.min(W, 4096), H);
  const k = c.width / W; // 若超出上限則等比縮
  const ctx = c.getContext('2d');
  ctx.scale(k, 1);
  ctx.strokeStyle = '#17130f'; ctx.fillStyle = '#17130f';
  for (const m of marks) {
    for (let i = 0; i <= m.count; i++) {
      const x = (m.from + i * m.stepMm) * pxPerMm;
      const isLong = i % m.long === 0, isMid = m.mid && i % m.mid === 0;
      const len = (isLong ? m.lenLong : isMid ? m.lenMid : m.lenShort) * pxPerMm;
      ctx.lineWidth = (isLong ? 0.32 : 0.22) * pxPerMm;
      const y0 = m.edge === 'bottom' ? H : 0, y1 = m.edge === 'bottom' ? H - len : len;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      if (m.labelEvery && i % m.labelEvery === 0 && m.label) {
        const s = m.label(i);
        if (s === null) continue;
        ctx.font = `600 ${m.fontMm * pxPerMm}px Georgia, serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const ty = m.edge === 'bottom' ? H - len - m.fontMm * pxPerMm * 0.75 : len + m.fontMm * pxPerMm * 0.75;
        ctx.fillText(s, x + (m.labelOffsetMm || 0) * pxPerMm, ty);
      }
    }
  }
  for (const t of texts) {
    ctx.font = `${t.style || 'italic'} ${t.sizeMm * pxPerMm}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.text, t.xMm * pxPerMm, t.yMm * pxPerMm);
  }
  const tex = toTexture(c, { srgb: true });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// 平貼在上表面的刻度面（中心位置、寬、深皆為場景單位）
export function scaleDecal(texture, width, depth) {
  const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.55, metalness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

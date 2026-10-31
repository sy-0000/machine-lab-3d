// 把玄關放映幕的三段繪本動畫（網站 src/xr/AnimationScreen.js，與 VR 版同一份繪圖程式與排版）錄成影片，給 Unity 的 VideoPlayer 用。
// 用法：先 npm run dev（埠號用 PORT，預設 5199），再 node scripts/record-previews.mjs
// 做法：無頭 Chromium 開網站，以固定 1/30 秒步進呼叫 screen.update，每格把畫布存成 JPEG，最後用 ffmpeg 編成 H.264 MP4（Quest 3 硬體解碼）。
// 每段從頭錄到「播完」再停 1.6 秒（與網站換下一段前的停頓相同）。產出：unity/MachineYard/Assets/Videos/preview_<id>.mp4
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const port = process.env.PORT || 5199, FPS = 30, HOLD = 1.6;
const out = 'unity/MachineYard/Assets/Videos', tmp = '/tmp/preview-frames';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/`);
const clips = await page.evaluate(async () => {
  const { createAnimationScreen } = await import('/src/xr/AnimationScreen.js');
  const s = await createAnimationScreen();
  window.__screen = s; window.__done = null;
  s.onComplete(id => { window.__done = id; });
  return s.clips.map(c => c.id);
});
for (let i = 0; i < clips.length; i++) {
  const id = clips[i];
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  let frame = 0, hold = -1;
  while (true) {
    const batch = await page.evaluate(n => {
      const s = window.__screen, imgs = [];
      for (let k = 0; k < n; k++) {
        s.update(1 / 30);
        imgs.push(s.texture.image.toDataURL('image/jpeg', 0.92).split(',')[1]);
        if (window.__done) break;
      }
      const done = window.__done; window.__done = null;
      return { imgs, done };
    }, 30);
    for (const b of batch.imgs) writeFileSync(join(tmp, `f${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(b, 'base64'));
    if (batch.done && hold < 0) hold = Math.round(HOLD * FPS);
    if (hold >= 0) {
      // 停頓：完整播完後最後一格停 1.6 秒（網站在這段時間不再推進動畫）
      const last = join(tmp, `f${String(frame - 1).padStart(5, '0')}.jpg`);
      for (let k = 0; k < hold; k++) execFileSync('cp', [last, join(tmp, `f${String(frame++).padStart(5, '0')}.jpg`)]);
      break;
    }
    if (frame > FPS * 600) throw new Error('動畫超過 10 分鐘沒有播完：' + id);
  }
  const file = join(out, `preview_${id}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%05d.jpg'), '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', file]);
  console.log(`${file}：${frame} 格（${(frame / FPS).toFixed(1)} 秒），${(statSync(file).size / 1024).toFixed(0)} KB`);
  if (i + 1 < clips.length) await page.evaluate(() => { window.__screen.next(); window.__done = null; });
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });

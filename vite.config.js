import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
// Dev-only: the glb export tool (src/dev/exportTool.js) POSTs files here and they land in ./exports/ (git-ignored).
// `apply: 'serve'` keeps it out of `vite build`.
const exportSink = () => ({
  name: 'export-sink',
  apply: 'serve',
  configureServer(server) {
    const root = resolve(process.cwd(), 'exports');
    server.middlewares.use('/__export/', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
      const target = resolve(root, name);
      if (!name || !target.startsWith(root + '/')) { res.statusCode = 400; return res.end('bad path'); }
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.concat(chunks));
        res.statusCode = 200; res.end('ok');
      });
    });
  },
});
// The site shows package.json's version (header and footer), so there is one place to bump it.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// `npm run dev:xr` (--mode xr) serves HTTPS with a self-signed certificate: WebXR needs a secure context,
// and the Quest opens the site by LAN IP. `npm run dev`, the build and Playwright stay on plain HTTP.
export default defineConfig(({ mode }) => ({
  plugins: [react(), exportSink(), ...(mode === 'xr' ? [basicSsl()] : [])],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
}));

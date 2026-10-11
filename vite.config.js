import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
// The site shows package.json's version (header and footer), so there is one place to bump it.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// `npm run dev:xr` (--mode xr) serves HTTPS with a self-signed certificate: WebXR needs a secure context,
// and the Quest opens the site by LAN IP. `npm run dev`, the build and Playwright stay on plain HTTP.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'xr' ? [basicSsl()] : [])],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
}));

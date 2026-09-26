import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The site shows package.json's version (header and footer), so there is one place to bump it.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({ plugins: [react()], base: './', define: { __APP_VERSION__: JSON.stringify(version) } });

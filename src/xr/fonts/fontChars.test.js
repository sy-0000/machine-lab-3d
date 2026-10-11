import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectChars } from './fontChars.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('VR 子集字型包含所有會畫到的字（缺字時執行 npm run fonts 重新產生）', () => {
  const have = new Set(readFileSync(join(root, 'src/xr/fonts/chars.txt'), 'utf8'));
  const missing = [...collectChars(root)].filter(ch => !have.has(ch));
  assert.deepEqual(missing, [], `子集字型缺字：${missing.join('')}`);
});

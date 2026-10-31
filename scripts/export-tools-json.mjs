// 把工具箱 13 件工具的名稱、說明、數量、展示角度與縮放輸出給 Unity（unity/MachineYard/Assets/Resources/tools.json）。
// 用法：node scripts/export-tools-json.mjs
import fs from 'node:fs';
import { TOOLS } from '../src/vendor/steampunk-toolbox/src/config/tools.config.js';

const out = TOOLS.map((t, index) => ({
  index, id: t.id, name: t.name, quantity: t.quantity ?? null, description: t.description,
  display: { rotation: t.display?.rotation ?? [0, 0, 0], scale: t.display?.scale ?? 1 },
}));
fs.mkdirSync('unity/MachineYard/Assets/Resources', { recursive: true });
fs.writeFileSync('unity/MachineYard/Assets/Resources/tools.json', JSON.stringify(out, null, 1));
console.log(`tools.json: ${out.length} 件`);

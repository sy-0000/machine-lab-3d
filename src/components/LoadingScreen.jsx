import { useEffect, useState } from 'react';
import MachineIcon from './MachineIcon.jsx';

// Shown one at a time while the model downloads, so the wait teaches something.
const TIPS = [
  '操作車床、鑽床時不可戴手套，以免被旋轉部件捲入。',
  '啟動主軸前，確認夾頭扳手已經取下。',
  '長髮要綁起、袖口扣好，不要穿戴垂落的飾品。',
  '切屑又熱又利，要用毛刷清除，不可徒手撥。',
  '量測工件尺寸前，一定要先停止主軸。',
  '進刀量越大，切削阻力越大；精修時用小進刀。',
  '鑽孔前先打中心衝，鑽頭才不會偏移。',
];

/** Scene loading: the machine's line drawing is traced as it gets ready (`progress` 0–100); `done` fades it out. */
export default function LoadingScreen({ progress, stage, machineId = 'lathe', done = false }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const id = setInterval(() => setTip(t => (t + 1) % TIPS.length), 5000);
    return () => clearInterval(id);
  }, []);
  return <div className={'scene-overlay loading-screen' + (done ? ' done' : '')} role="status">
    <div className="loading-art" style={{ '--p': (progress || 0) / 100 }}>
      <MachineIcon id={machineId} />
      <MachineIcon id={machineId} />
    </div>
    <strong>正在準備 3D 工具機</strong>
    <progress max="100" value={progress} aria-label="模型載入進度" />
    <span>{stage}</span>
    <p className="loading-tip" key={tip}><b>小知識</b>{TIPS[tip]}</p>
  </div>;
}

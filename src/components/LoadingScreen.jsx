export default function LoadingScreen({ progress }) {
  return <div className="scene-overlay" role="status"><span className="spinner"/><strong>正在準備 3D 工具機</strong><progress max="100" value={progress} aria-label="模型載入進度"/><span>{progress ? `載入 ${progress}%` : 'Loading · 讀取模型與材質'}</span></div>;
}

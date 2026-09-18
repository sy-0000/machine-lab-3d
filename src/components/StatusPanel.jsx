import { AXES, LATHE_PARTS } from '../lathe';
export default function StatusPanel({ controls: c, warning, ready }) {
  return <section className="status-panel"><div className="section-label"><h2>即時狀態</h2><span className="eyebrow">LIVE TELEMETRY</span></div><div className="telemetry"><div><span>主軸</span><strong>{!ready?'尚未就緒':c.drive.phase}</strong></div><div><span>設定 / 實際 RPM</span><strong>{c.rpm} / {Math.round(c.drive.actualRpm)}</strong></div>{Object.entries(AXES).map(([key]) => <div key={key}><span>{key === 'quill' ? '套筒' : key === 'tail' ? '尾座' : `${key.toUpperCase()} 軸`}位置</span><strong>{c.offsets[key].toFixed(3)}</strong></div>)}</div><p className="tool-lock">拉桿角度：{c.drive.leverAngle.toFixed(2)} rad ／ Hover：{LATHE_PARTS[c.interaction.hover]?.label || '無'}</p><div className={`notice ${warning?.level || ''}`} role="status" aria-live="polite">{warning ? warning.text : ready ? '● 目前無警告' : '○ 等待模型載入'}</div></section>;
}


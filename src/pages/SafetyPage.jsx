import rules from '../data/safety-rules.json';

// 工安守則的內容在 src/data/safety-rules.json（VR 玄關的告示板也讀同一份）。
// 每一條是一串文字片段，strong: true 的片段以粗體顯示。
export default function SafetyPage() {
  return (
    <main className="info-page safety-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>{rules.title}</h1>
        <p className="subtitle">{rules.subtitle}</p>
      </div>

      <div className="info-content">
        {rules.sections.map(section => (
          <section key={section.id} className={`safety-card ${section.id}`}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item, i) => (
                <li key={i}>{item.map((seg, j) => seg.strong ? <strong key={j}>{seg.text}</strong> : seg.text)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

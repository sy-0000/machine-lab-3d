import { lazy, Suspense, useEffect, useState } from 'react';
import { MACHINES } from './machines/catalog';
import GameWorkspace from './pages/GameWorkspace';
import { useTheme } from './theme.js';
import { challengeById } from './levels/challenges.js';
import MachineIcon from './components/MachineIcon.jsx';

const SafetyPage = lazy(() => import('./pages/SafetyPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const LevelsPage = lazy(() => import('./pages/LevelsPage'));

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(2));
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    const change = () => setRoute(location.hash.slice(2));
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);

  const isGameRoute = ['lathe', 'milling', 'drill', 'game'].includes(route);
  const challenge = route.startsWith('challenge/') ? challengeById(route.slice(10)) : null;
  const isLevelRoute = route === 'levels' || !!challenge;

  return (
    <>
      <header>
        <a className="brand" href="#/">
          <span className="brand-mark">
            M<span>↗</span>
          </span>
          <span>
            MACHINE<span className="brand-light"> LAB</span>
            <small>工具機 3D 互動教學 · v1.0</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="全站主導覽">
          <a className={`nav-link ${!route || route === 'home' ? 'active' : ''}`} href="#/">
            首頁
          </a>
          <a className={`nav-link ${route === 'safety' ? 'active' : ''}`} href="#/safety">
            工安守則
          </a>
          <a className={`nav-link ${route === 'tools' ? 'active' : ''}`} href="#/tools">
            刀具介紹
          </a>
          <a className={`nav-link ${isGameRoute ? 'active' : ''}`} href="#/lathe">
            加工教室
          </a>
          <a className={`nav-link ${isLevelRoute ? 'active' : ''}`} href="#/levels">
            加工關卡
          </a>
        </nav>

        <div className="header-end">
          <span className="header-tag">觀察構造 · 理解連動</span>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'} title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}>
            {theme === 'dark' ? '☀️ 淺色' : '🌙 深色'}
          </button>
        </div>
      </header>

      {route === 'safety' ? (
        <Suspense fallback={<main>正在載入工安規範…</main>}>
          <SafetyPage />
        </Suspense>
      ) : route === 'tools' ? (
        <Suspense fallback={<main>正在載入刀具目錄…</main>}>
          <ToolsPage />
        </Suspense>
      ) : route === 'levels' ? (
        <Suspense fallback={<main>正在載入關卡路線…</main>}>
          <LevelsPage />
        </Suspense>
      ) : challenge ? (
        <GameWorkspace key={'challenge-' + challenge.id} challenge={challenge} />
      ) : isGameRoute ? (
        <GameWorkspace initialMachineId={route === 'game' ? 'lathe' : route} key="shared-game-scene" />
      ) : (
        <main className="home">
          <div className="home-intro">
            <span className="eyebrow green">LEARN BY OPERATING</span>
            <h1>
              從每一次轉動，<br />
              理解工具機。
            </h1>
            <p>
              選擇一台機器，探索零件構造與運動關係。<br />
              旋轉視角、操作手輪，觀察每一次進給。
            </p>
          </div>

          <ol className="course-route" aria-label="課程路線">
            <li><a href="#/safety"><b>01</b>工安守則<small>進工場前必讀</small></a></li>
            <li><a href="#/tools"><b>02</b>刀具介紹<small>認識加工刀具</small></a></li>
            <li><a href="#/lathe"><b>03</b>加工教室<small>車床・銑床・鑽床功能</small></a></li>
            <li><a href="#/levels"><b>04</b>加工關卡<small>車床・銑床・鑽床 限時挑戰</small></a></li>
          </ol>

          <section className="machine-cards" aria-label="選擇工具機">
            {MACHINES.map(machine => (
              <a className="machine-card" key={machine.id} href={`#/${machine.id}`}>
                <div className="card-visual" aria-hidden="true"><MachineIcon id={machine.id} /></div>
                <div className="card-content">
                  <span className="card-number">{machine.number} / INTERACTIVE LESSON</span>
                  <h2>
                    {machine.name}
                    <span>↗</span>
                  </h2>
                  <small>{machine.subtitle}</small>
                  <p>{machine.description}</p>
                  <span className="card-action">進入互動教室 →</span>
                </div>
              </a>
            ))}
          </section>

          <div className="home-notes">
            <p>
              <b>01　觀察</b>旋轉、縮放與平移 3D 模型
            </p>
            <p>
              <b>02　操作</b>滑桿、滑鼠與觸控雙向進給
            </p>
            <p>
              <b>03　理解</b>檢視真實節點與設定限制
            </p>
          </div>
        </main>
      )}

      <footer>
        <span>MACHINE LAB / 工具機互動學習 · Machine System v1.0</span>
        <span>
          模型由使用者提供 · 來源與授權待確認 · 教學模擬不替代實機操作訓練
        </span>
      </footer>
    </>
  );
}

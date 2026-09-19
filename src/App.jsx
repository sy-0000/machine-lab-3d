import { lazy, Suspense, useEffect, useState } from 'react';
import { MACHINES } from './machines/catalog';
import GameWorkspace from './pages/GameWorkspace';

const SafetyPage = lazy(() => import('./pages/SafetyPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const LevelsPage = lazy(() => import('./pages/LevelsPage'));

function MachineIcon({ id }) {
  return (
    <svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <path d="M20 170H300M40 180H280" stroke="#34524c" />
      <g stroke="#91dec2" strokeWidth="3" strokeLinejoin="round">
        {id === 'lathe' ? (
          <>
            <path d="M45 150V65H103V130H270V150ZM245 130V95H270V150M103 106H245M152 106V88H186V129M59 65V38H100V65" />
            <circle cx="92" cy="87" r="14" />
            <circle cx="162" cy="122" r="10" />
            <path d="M104 86H134M200 105V84H236V105M55 150V168M255 150V168" />
          </>
        ) : id === 'milling' ? (
          <>
            <path d="M65 165V38H134V165ZM49 165H173V176H49ZM108 39V23H212V48H108ZM185 48V74H204V48M194 74V98M108 115H274V132H108ZM130 132V154H242V132" />
            <circle cx="259" cy="142" r="11" />
            <path d="M68 63H100M166 115V102H228V115" />
          </>
        ) : (
          <>
            <path d="M74 169H240V181H74ZM104 169V32H119V169M80 32V17H227V51H80ZM192 51V71H216V51M203 71V105M119 121H243V132H119" />
            <circle cx="230" cy="56" r="8" />
            <path d="M235 52L263 29M237 60L269 73M228 64L222 98" />
          </>
        )}
      </g>
    </svg>
  );
}

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(2));

  useEffect(() => {
    const change = () => setRoute(location.hash.slice(2));
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);

  const isGameRoute = ['lathe', 'milling', 'drill', 'game'].includes(route);

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
          <a className={`nav-link ${route === 'levels' ? 'active' : ''}`} href="#/levels">
            關卡選擇
          </a>
          <a className={`nav-link ${isGameRoute ? 'active' : ''}`} href="#/lathe">
            加工教室
          </a>
        </nav>

        <span className="header-tag">觀察構造 · 理解連動</span>
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
        <Suspense fallback={<main>正在載入關卡規劃…</main>}>
          <LevelsPage />
        </Suspense>
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

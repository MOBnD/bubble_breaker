import type { PropsWithChildren } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useJourney } from '../state/JourneyContext';

interface AppShellProps extends PropsWithChildren {
  compact?: boolean;
}

export function AppShell({ children, compact = false }: AppShellProps) {
  const { state, exitDemo } = useJourney();
  const navigate = useNavigate();

  function leaveDemo() {
    exitDemo();
    navigate('/');
  }

  return (
    <div className={`app-shell ${compact ? 'app-shell--compact' : ''}`}>
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <header className="site-header">
        <Link className="brand" to={state.isDemo ? '/demo' : '/'} aria-label="BubbleBreaker ホーム">
          <span className="brand__mark" aria-hidden="true">◌</span>
          <span><strong>BubbleBreaker</strong><small>Information Adventure</small></span>
        </Link>
        <nav aria-label="メインナビゲーション">
          {state.isDemo && <span className="demo-badge">DEMO</span>}
          <NavLink to="/world">世界地図</NavLink>
          <NavLink to="/log">冒険記</NavLink>
          {state.isDemo && <button className="text-button" onClick={leaveDemo}>デモを終了</button>}
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}

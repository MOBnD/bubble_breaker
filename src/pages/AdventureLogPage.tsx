import { Navigate, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DemoGuide } from '../components/DemoGuide';
import { WorldMap } from '../components/WorldMap';
import { getTopic } from '../data/topics';
import { explorationByCategory, uniqueVisitedTopicIds } from '../lib/journey';
import { useJourney } from '../state/JourneyContext';

export function AdventureLogPage() {
  const navigate = useNavigate();
  const { activeJourney, state } = useJourney();
  if (!activeJourney) return <Navigate to={state.isDemo ? '/demo' : '/'} replace />;

  const visited = uniqueVisitedTopicIds(activeJourney);
  const surprising = activeJourney.steps.filter((step) => step.surpriseScore >= 7).length;
  const categories = explorationByCategory(activeJourney);
  const date = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(new Date(activeJourney.startedAt));

  return (
    <AppShell>
      <article className="log-page">
        <header className="log-heading">
          <span className="eyebrow">YOUR ADVENTURE LOG</span>
          <h1>あなたの冒険記</h1>
          <p>{date} · {getTopic(activeJourney.startTopicId).name}から始まった旅</p>
        </header>
        <section className="log-stats" aria-label="冒険の記録">
          <div><small>発見</small><strong>{visited.size}</strong><span>地点</span></div>
          <div><small>歩いた道</small><strong>{Math.max(0, activeJourney.steps.length - 1)}</strong><span>本</span></div>
          <div><small>意外な接続</small><strong>{surprising}</strong><span>個</span></div>
          <div><small>開拓領域</small><strong>{categories.length}</strong><span>分野</span></div>
        </section>
        <section className="log-map-section">
          <div className="log-section-title"><span className="eyebrow">THE WORLD YOU WALKED</span><h2>歩いた情報世界</h2></div>
          <WorldMap journey={activeJourney} readOnly compact />
        </section>
        <section className="journey-timeline">
          <div className="log-section-title"><span className="eyebrow">TODAY'S ROUTE</span><h2>今日の道のり</h2></div>
          <ol>
            {activeJourney.steps.map((step, index) => {
              const topic = getTopic(step.topicId);
              return (
                <li key={`${step.topicId}-${index}`}>
                  <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span>
                  <i style={{ background: topic.accent }} />
                  <div><small>{topic.categoryLabel}</small><strong>{topic.name}</strong>{step.explanation && <p>{step.explanation}</p>}</div>
                  {step.surpriseScore >= 7 && <em>意外な接続</em>}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="next-horizon">
          <div><span className="eyebrow">STILL UNDISCOVERED</span><h2>あなたがまだ知らない世界</h2><p>地図の霧の向こうで、新しい道が待っています。</p></div>
          <div className="unknown-landmarks" aria-label="未踏領域"><span>?</span><span>?</span><span>?</span></div>
          <button className="primary-button" onClick={() => navigate('/world')}>次は、この先へ。 <span>→</span></button>
        </section>
      </article>
      {state.isDemo && <DemoGuide screen="log" topicId={activeJourney.currentTopicId} />}
    </AppShell>
  );
}

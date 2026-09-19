import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DemoGuide } from '../components/DemoGuide';
import { DEMO_STEPS, findDemoStep } from '../data/demo';
import { BRANCH_LABELS, getBranchConnections, getTopic, TOPIC_BY_ID } from '../data/topics';
import { explorationByCategory } from '../lib/journey';
import { useJourney } from '../state/JourneyContext';
import type { TopicConnection } from '../types';

export function DiscoveryPage() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();
  const { activeJourney, state, travelTo } = useJourney();
  if (!activeJourney || !TOPIC_BY_ID.has(topicId)) return <Navigate to={state.isDemo ? '/demo' : '/'} replace />;

  const topic = getTopic(topicId);
  const lastStep = [...activeJourney.steps].reverse().find((step) => step.topicId === topic.id);
  const from = lastStep?.fromTopicId ? getTopic(lastStep.fromTopicId) : null;
  const branches = getBranchConnections(topic.id);
  const demoIndex = state.isDemo ? findDemoStep('discovery', topic.id) : -1;
  const guidedTargetId = demoIndex >= 0 ? DEMO_STEPS[demoIndex].targetTopicId : undefined;
  const exploration = explorationByCategory(activeJourney);

  function choose(connection: TopicConnection) {
    travelTo(connection.id);
    navigate(`/discovery/${connection.toTopicId}`);
  }

  return (
    <AppShell>
      <article className="discovery-page">
        <header className="discovery-hero" style={{ '--discovery-color': topic.accent } as React.CSSProperties}>
          <div className="discovery-rings" aria-hidden="true"><i /><i /><i /></div>
          <span className="eyebrow">✦ NEW DISCOVERY</span>
          <span className="discovery-landmark">{topic.landmark}</span>
          <h1>{topic.name}</h1>
          <p>{topic.summary}</p>
          <button className="map-return" onClick={() => navigate('/world')}>世界地図で見る <span>↗</span></button>
        </header>

        {from && lastStep && (
          <section className="connection-story" aria-labelledby="why-here">
            <div className="section-index">01</div>
            <div className="connection-story__content">
              <span className="eyebrow">THE HIDDEN CONNECTION</span>
              <h2 id="why-here">なぜ、ここへ来たのか？</h2>
              <div className="connection-path" aria-label={`${from.name}から${topic.name}への接続`}>
                <span className="connection-path__major">{from.name}</span>
                {lastStep.bridgeLabels.map((label) => <span key={label}><i>→</i>{label}</span>)}
                <span className="connection-path__major is-new"><i>→</i>{topic.name}</span>
              </div>
              <blockquote>{lastStep.explanation}</blockquote>
              <div className="surprise-meter"><span>意外な接続</span><i><b style={{ width: `${lastStep.surpriseScore * 10}%` }} /></i><strong>{lastStep.surpriseScore}/10</strong></div>
            </div>
          </section>
        )}

        {activeJourney.steps.length >= 4 && (
          <section className="bias-observation">
            <div><span className="eyebrow">YOUR CURRENT HORIZON</span><h2>いま歩いている世界</h2><p>評価ではなく、これまでの足跡です。細い道の先には、まだ歩いていない分野があります。</p></div>
            <div className="bias-bars">
              {exploration.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.ratio * 100}%` }} /></i><small>{item.count}</small></div>)}
              <div className="bias-bars__unknown"><span>まだ見ていない世界</span><i><b /></i><small>?</small></div>
            </div>
          </section>
        )}

        <section className="branch-section" aria-labelledby="next-way">
          <div className="section-index">02</div>
          <span className="eyebrow">CHOOSE YOUR NEXT PATH</span>
          <h2 id="next-way">この先、どの道へ？</h2>
          <div className="branch-grid">
            {branches.map((connection) => {
              const destination = getTopic(connection.toTopicId);
              const label = BRANCH_LABELS[connection.branchKind];
              const guided = guidedTargetId === connection.toTopicId;
              return (
                <button key={connection.id} className={`branch-card branch-card--${connection.branchKind} ${guided ? 'is-guided' : ''}`} onClick={() => choose(connection)}>
                  <span className="branch-card__icon">{label.icon}</span>
                  <small>{label.title}</small>
                  <strong>{destination.name}</strong>
                  <p>{label.description}</p>
                  <i>{connection.relationshipType} <b>→</b></i>
                </button>
              );
            })}
          </div>
          {state.isDemo && topic.id === 'disaster-evacuation' && (
            <button className="primary-button log-cta is-guided" onClick={() => navigate('/log')}>今日の冒険を振り返る <span>→</span></button>
          )}
        </section>
      </article>
      {state.isDemo && <DemoGuide screen="discovery" topicId={topic.id} />}
    </AppShell>
  );
}

import { Navigate, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DemoGuide } from '../components/DemoGuide';
import { WorldMap } from '../components/WorldMap';
import { DEMO_STEPS, findDemoStep } from '../data/demo';
import { getBranchConnections, getTopic } from '../data/topics';
import { useJourney } from '../state/JourneyContext';
import type { TopicConnection } from '../types';

export function WorldPage() {
  const navigate = useNavigate();
  const { activeJourney, state, travelTo } = useJourney();
  if (!activeJourney) return <Navigate to={state.isDemo ? '/demo' : '/'} replace />;

  const current = getTopic(activeJourney.currentTopicId);
  const available = getBranchConnections(current.id);
  const demoIndex = state.isDemo ? findDemoStep('world', current.id) : -1;
  const guidedTargetId = demoIndex >= 0 ? DEMO_STEPS[demoIndex].targetTopicId : undefined;

  function travel(connection: TopicConnection) {
    travelTo(connection.id);
    navigate(`/discovery/${connection.toTopicId}`);
  }

  return (
    <AppShell compact>
      <section className="world-page">
        <div className="world-heading">
          <div><span className="eyebrow">WORLD MAP · {current.categoryLabel}</span><h1>{current.name}から、どこへ行く？</h1></div>
          <div className="world-stats"><span><small>現在地</small>{current.name}</span><span><small>発見</small>{new Set(activeJourney.steps.map((step) => step.topicId)).size} 地点</span></div>
        </div>
        <WorldMap journey={activeJourney} onTravel={travel} guidedTargetId={guidedTargetId} />
        <div className="route-preview">
          <span>見えている道</span>
          {available.map((connection) => (
            <button key={connection.id} onClick={() => travel(connection)} className={guidedTargetId === connection.toTopicId ? 'is-guided' : ''}>
              <i /> <strong>{getTopic(connection.toTopicId).name}</strong><small>{connection.relationshipType}</small>
            </button>
          ))}
        </div>
      </section>
      {state.isDemo && <DemoGuide screen="world" topicId={current.id} />}
    </AppShell>
  );
}

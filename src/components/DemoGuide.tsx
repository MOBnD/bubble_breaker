import { DEMO_STEPS, findDemoStep } from '../data/demo';
import type { DemoStep } from '../types';

interface DemoGuideProps {
  screen: DemoStep['screen'];
  topicId: string | null;
}

export function DemoGuide({ screen, topicId }: DemoGuideProps) {
  const index = findDemoStep(screen, topicId);
  if (index < 0) return null;
  const step = DEMO_STEPS[index];

  return (
    <aside className="demo-guide" aria-live="polite" data-testid="demo-guide">
      <span className="eyebrow">GUIDED ADVENTURE</span>
      <div className="demo-guide__heading">
        <strong>{step.title}</strong>
        <span>{index + 1} / {DEMO_STEPS.length}</span>
      </div>
      <p>{step.instruction}</p>
      <div className="demo-guide__progress" aria-hidden="true">
        <i style={{ width: `${((index + 1) / DEMO_STEPS.length) * 100}%` }} />
      </div>
    </aside>
  );
}

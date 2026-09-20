import { useEffect, useRef } from 'react';
import { CHOICE_BY_KIND, CONTINUATION_CHOICES, FIRST_DISCOVERY, SECOND_DISCOVERY } from '../data/adventureContent';
import { getSource } from '../data/knowledgeGraph';
import type { ContinuationKind, DiscoveryDefinition, ExperienceStage } from '../types';

interface ExperiencePanelProps {
  stage: ExperienceStage;
  selectedContinuation: ContinuationKind | null;
  onStart: () => void;
  onRevealFirst: () => void;
  onExpandFirst: () => void;
  onRevealSecond: () => void;
  onExpandSecond: () => void;
  onBackToArrival: () => void;
  onBackToFirstExpansion: () => void;
  onChoose: (kind: ContinuationKind) => void;
  onBackToChoice: () => void;
  onOpenJournal: () => void;
}

function Sources({ discovery }: { discovery: DiscoveryDefinition }) {
  return (
    <details className="source-details">
      <summary>出典を見る</summary>
      <div className="source-list">
        {discovery.sourceIds.map((sourceId) => {
          const source = getSource(sourceId);
          return (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
              <strong>{source.title}</strong>
              <span>{source.authors} · {source.year}</span>
              <small>{source.note}</small>
            </a>
          );
        })}
      </div>
    </details>
  );
}

function ConnectionReveal({ discovery, onContinue }: { discovery: DiscoveryDefinition; onContinue: () => void }) {
  return (
    <section className="experience-panel reveal-panel" aria-labelledby={discovery.id + '-title'}>
      <span className="panel-kicker">DISCOVERY UNLOCKED</span>
      <h1 id={discovery.id + '-title'}>{discovery.revealTitle}</h1>
      <div className="connection-chain" aria-label={discovery.chain.join('から')}>
        {discovery.chain.map((label, index) => (
          <span key={label} className={index === discovery.chain.length - 1 ? 'is-destination' : ''}>
            {index > 0 && <i aria-hidden="true">→</i>}
            <strong>{label}</strong>
          </span>
        ))}
      </div>
      <p className="reveal-explanation">{discovery.explanation}</p>
      <div className="next-uncertainty">
        <small>まだ分からないこと</small>
        <p>{discovery.nextUncertainty}</p>
      </div>
      <div className="panel-actions">
        <button className="primary-action" onClick={onContinue}>世界を見る <span aria-hidden="true">→</span></button>
        <Sources discovery={discovery} />
      </div>
    </section>
  );
}

export function ExperiencePanel(props: ExperiencePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.stage !== 'departure') {
      panelRef.current?.querySelector<HTMLElement>('h1, h2')?.focus();
    }
  }, [props.stage]);

  let content: React.ReactNode;
  switch (props.stage) {
    case 'departure':
      content = (
        <section className="experience-panel departure-panel" aria-labelledby="departure-title">
          <span className="panel-kicker">A QUIET FRONTIER</span>
          <h1 id="departure-title">どこから旅を<br />始めますか？</h1>
          <p>よく知る場所をひとつだけ選んでください。<br />その先に何があるかは、まだ見えません。</p>
          <div className="departure-options">
            <button className="departure-choice" onClick={props.onStart}>
              <span className="choice-glyph" aria-hidden="true">◇</span>
              <strong>ゲーム</strong>
              <small>ここから旅を始める</small>
            </button>
            <span className="fogged-departure" aria-hidden="true"><i>?</i><small>霧の向こう</small></span>
            <span className="fogged-departure" aria-hidden="true"><i>?</i><small>まだ見えない入口</small></span>
          </div>
        </section>
      );
      break;
    case 'arrival':
      content = (
        <section className="experience-panel scene-caption" aria-labelledby="arrival-title">
          <span className="panel-kicker">ARRIVAL · ゲームの辺境</span>
          <h1 id="arrival-title" tabIndex={-1}>見慣れた景色の外れに、<br />一本だけ知らない道がある。</h1>
          <p>崩れた足場、遠くの光。まだ、それが何につながるのかは分からない。</p>
          <span className="look-hint">景色の中の気配を探してください</span>
        </section>
      );
      break;
    case 'firstEncounter':
      content = (
        <section className="experience-panel encounter-panel" aria-labelledby="first-question">
          <button className="back-action" onClick={props.onBackToArrival}>← 景色へ戻る</button>
          <span className="panel-kicker">A QUESTION ON THE ROAD</span>
          <p className="encounter-signal">{FIRST_DISCOVERY.signal}</p>
          <h1 id="first-question" tabIndex={-1}>{FIRST_DISCOVERY.question}</h1>
          <button className="primary-action" onClick={props.onRevealFirst}>調べる <span aria-hidden="true">→</span></button>
        </section>
      );
      break;
    case 'firstReveal':
      content = <ConnectionReveal discovery={FIRST_DISCOVERY} onContinue={props.onExpandFirst} />;
      break;
    case 'firstExpansion':
      content = (
        <section className="experience-panel scene-caption expansion-caption" aria-labelledby="first-expansion-title">
          <span className="panel-kicker">THE WORLD RESPONDED</span>
          <h1 id="first-expansion-title" tabIndex={-1}>霧が晴れた。<br />橋の向こうに、都市がある。</h1>
          <p>{FIRST_DISCOVERY.unlockDescription}</p>
          <span className="look-hint">新しく現れた光を追ってください</span>
        </section>
      );
      break;
    case 'secondEncounter':
      content = (
        <section className="experience-panel encounter-panel" aria-labelledby="second-question">
          <button className="back-action" onClick={props.onBackToFirstExpansion}>← 開いた道へ戻る</button>
          <span className="panel-kicker">A STRANGE CITY EDGE</span>
          <p className="encounter-signal">{SECOND_DISCOVERY.signal}</p>
          <h1 id="second-question" tabIndex={-1}>{SECOND_DISCOVERY.question}</h1>
          <button className="primary-action" onClick={props.onRevealSecond}>調べる <span aria-hidden="true">→</span></button>
        </section>
      );
      break;
    case 'secondReveal':
      content = <ConnectionReveal discovery={SECOND_DISCOVERY} onContinue={props.onExpandSecond} />;
      break;
    case 'choice':
      content = (
        <section className="experience-panel choice-panel" aria-labelledby="choice-title">
          <span className="panel-kicker">THREE UNEXPLAINED SIGNALS</span>
          <h1 id="choice-title" tabIndex={-1}>この先、どうする？</h1>
          <p>行き先の名前ではなく、いまの好奇心で選んでください。</p>
          <div className="curiosity-choices">
            {CONTINUATION_CHOICES.map((choice) => (
              <button key={choice.kind} className={'curiosity-choice choice-' + choice.kind} onClick={() => props.onChoose(choice.kind)}>
                <span aria-hidden="true">{choice.kind === 'pursue' ? '⌁' : choice.kind === 'detour' ? '↝' : '⌄'}</span>
                <strong>{choice.title}</strong>
                <small>{choice.description}</small>
              </button>
            ))}
          </div>
        </section>
      );
      break;
    case 'continuationEncounter': {
      const choice = props.selectedContinuation ? CHOICE_BY_KIND.get(props.selectedContinuation) : null;
      content = choice ? (
        <section className="experience-panel encounter-panel continuation-panel" aria-labelledby="continuation-question">
          <button className="back-action" onClick={props.onBackToChoice}>← 別の気配を選ぶ</button>
          <span className="panel-kicker">{choice.title} · THE NEXT ENCOUNTER</span>
          <p className="encounter-signal">{choice.signal}</p>
          <h1 id="continuation-question" tabIndex={-1}>{choice.encounterQuestion}</h1>
          <p className="vertical-slice-end">答えは、まだ霧の向こうにある。今回の旅で見つけたつながりは、冒険記に残りました。</p>
          <button className="primary-action" onClick={props.onOpenJournal}>冒険記を見る <span aria-hidden="true">→</span></button>
        </section>
      ) : null;
      break;
    }
  }

  return <div ref={panelRef} className={'panel-layer panel-stage-' + props.stage}>{content}</div>;
}

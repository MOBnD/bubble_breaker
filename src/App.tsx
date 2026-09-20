import { useEffect, useState } from 'react';
import { AdventureJournal } from './components/AdventureJournal';
import { AdventureScene } from './components/AdventureScene';
import { ExperiencePanel } from './components/ExperiencePanel';
import { useAdventure } from './state/AdventureContext';
import type { ExperienceStage } from './types';

const CONTEXT_LABELS: Record<ExperienceStage, string> = {
  departure: '静かな辺境',
  arrival: 'ゲームの辺境',
  firstEncounter: '崩れた道',
  firstReveal: '最初の発見',
  firstExpansion: '新しく開いた道',
  secondEncounter: '都市の入口',
  secondReveal: '二つ目の発見',
  choice: '三つの気配',
  continuationEncounter: 'まだ名前のない場所',
};

const STAGE_ANNOUNCEMENTS: Record<ExperienceStage, string> = {
  departure: '旅の出発地点です。',
  arrival: 'ゲームの辺境に到着しました。説明のない気配が見えます。',
  firstEncounter: '最初の問いに遭遇しました。',
  firstReveal: 'ゲーム空間とウェイファインディングの接続を発見しました。',
  firstExpansion: '霧が晴れ、新しい道と都市が現れました。',
  secondEncounter: '都市の入口で二つ目の問いに遭遇しました。',
  secondReveal: '空間構成と経路選択の接続を発見しました。',
  choice: '世界が広がり、三つの新しい気配が現れました。',
  continuationEncounter: '選んだ道の先で、次の問いに遭遇しました。',
};

export function App() {
  const { state, dispatch, chooseContinuation, resetAdventure } = useAdventure();
  const [journalOpen, setJournalOpen] = useState(false);

  useEffect(() => {
    if (window.location.hash !== '#/') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
    }
  }, []);

  function reset() {
    if (window.confirm('今回の発見と開いた世界を消して、旅を最初から始めますか？')) {
      setJournalOpen(false);
      resetAdventure();
    }
  }

  return (
    <div className="adventure-app">
      <a className="skip-link" href="#main-experience">体験へ移動</a>
      <header className="adventure-header">
        <div className="brand" aria-label="BubbleBreaker">
          <span className="brand-mark" aria-hidden="true">◌</span>
          <span><strong>BubbleBreaker</strong><small>Adventure Core</small></span>
        </div>
        <div className="current-context" aria-label={'現在地: ' + CONTEXT_LABELS[state.stage]}>
          <small>CURRENT CONTEXT</small>
          <span>{CONTEXT_LABELS[state.stage]}</span>
        </div>
        <nav aria-label="冒険の操作">
          {state.stage !== 'departure' && <button className="header-action" onClick={reset}>旅を最初から</button>}
          <button className="journal-button" onClick={() => setJournalOpen(true)}>
            <span aria-hidden="true">▤</span> 冒険記
            {state.journalEntries.length > 0 && <b aria-label={state.journalEntries.length + '件の発見'}>{state.journalEntries.length}</b>}
          </button>
        </nav>
      </header>

      <main id="main-experience">
        <AdventureScene
          stage={state.stage}
          continuationKind={state.selectedContinuation}
          onFirstSignal={() => dispatch({ type: 'OPEN_FIRST_ENCOUNTER' })}
          onSecondSignal={() => dispatch({ type: 'FOLLOW_REVEALED_PATH' })}
        />
        <ExperiencePanel
          stage={state.stage}
          selectedContinuation={state.selectedContinuation}
          onStart={() => dispatch({ type: 'START_GAME' })}
          onRevealFirst={() => dispatch({ type: 'REVEAL_FIRST' })}
          onExpandFirst={() => dispatch({ type: 'EXPAND_FIRST' })}
          onRevealSecond={() => dispatch({ type: 'REVEAL_SECOND' })}
          onExpandSecond={() => dispatch({ type: 'EXPAND_SECOND' })}
          onBackToArrival={() => dispatch({ type: 'RETURN_TO_ARRIVAL' })}
          onBackToFirstExpansion={() => dispatch({ type: 'RETURN_TO_FIRST_EXPANSION' })}
          onChoose={chooseContinuation}
          onBackToChoice={() => dispatch({ type: 'RETURN_TO_CHOICE' })}
          onOpenJournal={() => setJournalOpen(true)}
        />
        <p className="sr-only" aria-live="polite">{STAGE_ANNOUNCEMENTS[state.stage]}</p>
      </main>

      {journalOpen && <AdventureJournal entries={state.journalEntries} onClose={() => setJournalOpen(false)} />}
    </div>
  );
}

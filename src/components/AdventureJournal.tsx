import { useEffect, useRef } from 'react';
import { getSource } from '../data/knowledgeGraph';
import type { JournalEntry } from '../types';

interface AdventureJournalProps {
  entries: JournalEntry[];
  onClose: () => void;
}

function MemoryMap({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="memory-map" aria-label="これまでの発見から作られた地図">
      <svg viewBox="0 0 560 210" role="img" aria-label={'ゲームから始まり、' + entries.length + '件の発見へ続く道'}>
        <path className={entries.length >= 1 ? 'is-known' : ''} d="M105 118C180 72 219 72 284 107" />
        <path className={entries.length >= 2 ? 'is-known' : ''} d="M284 107C365 139 405 114 470 72" />
        <g className="memory-node is-known" transform="translate(88 128)"><circle r="18" /><text y="5">◇</text><title>出発地点</title></g>
        <g className={'memory-node ' + (entries.length >= 1 ? 'is-known' : '')} transform="translate(284 107)"><circle r="18" /><text y="5">{entries.length >= 1 ? '◆' : '?'}</text><title>最初の発見</title></g>
        <g className={'memory-node ' + (entries.length >= 2 ? 'is-known' : '')} transform="translate(470 72)"><circle r="18" /><text y="5">{entries.length >= 2 ? '◆' : '?'}</text><title>二つ目の発見</title></g>
        <g className="memory-unknown" transform="translate(500 165)"><circle r="14" /><text y="5">?</text></g>
      </svg>
      <p>歩いた場所だけが、地図に残る。</p>
    </div>
  );
}

export function AdventureJournal({ entries, onClose }: AdventureJournalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="journal-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="journal-drawer" role="dialog" aria-modal="true" aria-labelledby="journal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="journal-heading">
          <div><span className="panel-kicker">ADVENTURE JOURNAL</span><h1 id="journal-title">あなたの冒険記</h1></div>
          <button ref={closeRef} className="journal-close" onClick={onClose} aria-label="冒険記を閉じる">×</button>
        </header>
        <MemoryMap entries={entries} />
        {entries.length === 0 ? (
          <div className="empty-journal">
            <span aria-hidden="true">◌</span>
            <h2>まだ、発見は記されていない。</h2>
            <p>気になるものへ近づくと、ここに道とつながりが残ります。</p>
          </div>
        ) : (
          <ol className="journal-entries">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <div className="journal-entry-number">発見 #{String(index + 1).padStart(2, '0')}</div>
                <h2>{entry.title}</h2>
                <div className="journal-chain">
                  {entry.chain.map((label, labelIndex) => (
                    <span key={label}>{labelIndex > 0 && <i>→</i>}<strong>{label}</strong></span>
                  ))}
                </div>
                <p>{entry.explanation}</p>
                <blockquote><small>新しく見えたもの</small>{entry.openedWorld}</blockquote>
                <details>
                  <summary>この発見の出典</summary>
                  {entry.sourceIds.map((sourceId) => {
                    const source = getSource(sourceId);
                    return <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} <span>↗</span></a>;
                  })}
                </details>
              </li>
            ))}
          </ol>
        )}
        <footer className="journal-footer">地図の外には、まだ名前のない気配が残っています。</footer>
      </aside>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { TOPICS } from '../data/topics';

interface TopicPickerProps {
  title: string;
  description: string;
  forcedTopicId?: string;
  submitLabel?: string;
  onChoose: (topicId: string) => void;
  onClose: () => void;
}

export function TopicPicker({
  title,
  description,
  forcedTopicId,
  submitLabel = 'この場所から出発',
  onChoose,
  onClose,
}: TopicPickerProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(forcedTopicId ?? 'game');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ja');
    if (!normalized) return TOPICS;
    return TOPICS.filter((topic) =>
      `${topic.name} ${topic.categoryLabel} ${topic.summary}`.toLocaleLowerCase('ja').includes(normalized),
    );
  }, [query]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="topic-picker" role="dialog" aria-modal="true" aria-labelledby="topic-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="閉じる">×</button>
        <span className="eyebrow">DEPARTURE</span>
        <h2 id="topic-picker-title">{title}</h2>
        <p>{description}</p>
        {!forcedTopicId && (
          <label className="search-field">
            <span>テーマを探す</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：ゲーム、科学、歴史" autoFocus />
          </label>
        )}
        <div className="topic-options" role="listbox" aria-label="出発テーマ">
          {filtered.map((topic) => (
            <button
              key={topic.id}
              type="button"
              role="option"
              aria-selected={selected === topic.id}
              className={selected === topic.id ? 'selected' : ''}
              onClick={() => setSelected(topic.id)}
              disabled={Boolean(forcedTopicId && forcedTopicId !== topic.id)}
            >
              <i style={{ background: topic.accent }} />
              <span><strong>{topic.name}</strong><small>{topic.categoryLabel}</small></span>
            </button>
          ))}
          {filtered.length === 0 && <p className="empty-message">その言葉はまだ霧の向こうです。12の候補から選んでください。</p>}
        </div>
        <button className="primary-button primary-button--wide" onClick={() => onChoose(selected)}>{submitLabel}</button>
      </section>
    </div>
  );
}

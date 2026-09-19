import { useMemo, useRef, useState } from 'react';
import { CONNECTIONS, getBranchConnections, getTopic, TOPICS } from '../data/topics';
import type { Journey, TopicConnection } from '../types';

interface WorldMapProps {
  journey: Journey;
  onTravel?: (connection: TopicConnection) => void;
  guidedTargetId?: string;
  readOnly?: boolean;
  compact?: boolean;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const SYMBOLS = {
  kingdom: '♜',
  city: '◆',
  village: '▲',
  ruin: '⌂',
  tower: '♢',
};

export function WorldMap({ journey, onTravel, guidedTargetId, readOnly = false, compact = false }: WorldMapProps) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragOrigin = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const visited = useMemo(() => new Set(journey.steps.map((step) => step.topicId)), [journey.steps]);
  const available = useMemo(() => getBranchConnections(journey.currentTopicId), [journey.currentTopicId]);
  const availableByTopic = useMemo(() => new Map(available.map((connection) => [connection.toTopicId, connection])), [available]);
  const revealed = useMemo(() => new Set([...visited, ...available.map((connection) => connection.toTopicId)]), [visited, available]);
  const traversed = useMemo(() => new Set(journey.steps.map((step) => step.connectionId).filter(Boolean)), [journey.steps]);

  function zoom(delta: number, centerX = 0, centerY = 0) {
    setTransform((current) => {
      const scale = Math.min(2.2, Math.max(0.72, current.scale * delta));
      const ratio = scale / current.scale;
      return {
        scale,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      };
    });
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return;
    if ((event.target as Element).closest('.map-node[role="button"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragOrigin.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId) || readOnly) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) zoom(distance / pinchDistance.current, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDistance.current = distance;
    } else if (dragOrigin.current) {
      setTransform((current) => ({
        ...current,
        x: dragOrigin.current!.tx + event.clientX - dragOrigin.current!.x,
        y: dragOrigin.current!.ty + event.clientY - dragOrigin.current!.y,
      }));
    }
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    dragOrigin.current = null;
    pinchDistance.current = null;
  }

  function handleNode(connection: TopicConnection | undefined) {
    if (!readOnly && connection && onTravel) onTravel(connection);
  }

  const visibleConnections = CONNECTIONS.filter((connection) => {
    const isTraversed = traversed.has(connection.id);
    const isAvailable = connection.fromTopicId === journey.currentTopicId && availableByTopic.has(connection.toTopicId);
    return isTraversed || isAvailable;
  });

  return (
    <div className={`world-map ${compact ? 'world-map--compact' : ''}`}>
      <svg
        viewBox="0 0 1200 760"
        role="img"
        aria-label="発見した情報世界と、次に進める場所の地図"
        onWheel={(event) => {
          if (readOnly) return;
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1.12 : 0.89, event.clientX, event.clientY);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <filter id="map-glow"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="sea-light"><stop offset="0" stopColor="#1a4c4c" /><stop offset="1" stopColor="#081d23" /></radialGradient>
          <pattern id="map-grid" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M 46 0 L 0 0 0 46" fill="none" stroke="#9cc8b5" strokeOpacity=".045" /></pattern>
        </defs>
        <rect width="1200" height="760" fill="url(#sea-light)" />
        <rect width="1200" height="760" fill="url(#map-grid)" />
        <g className="map-contours" aria-hidden="true">
          <path d="M43 180 C180 64 315 78 392 151 C463 216 543 84 650 105 C785 132 773 37 925 50 C1082 64 1180 169 1146 279" />
          <path d="M43 594 C151 676 272 662 346 596 C444 507 524 706 683 684 C799 668 869 733 1156 628" />
          <path d="M293 20 C353 114 247 201 313 276 C371 342 304 435 208 477" />
        </g>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`} className="map-layer">
          {visibleConnections.map((connection) => {
            const from = getTopic(connection.fromTopicId);
            const to = getTopic(connection.toTopicId);
            const active = connection.fromTopicId === journey.currentTopicId;
            return (
              <path
                key={connection.id}
                className={`map-road ${active ? 'map-road--available' : 'map-road--traversed'}`}
                d={`M ${from.position.x} ${from.position.y} Q ${(from.position.x + to.position.x) / 2} ${(from.position.y + to.position.y) / 2 - 42} ${to.position.x} ${to.position.y}`}
              />
            );
          })}
          {TOPICS.map((topic) => {
            const isCurrent = topic.id === journey.currentTopicId;
            const wasVisited = visited.has(topic.id);
            const connection = availableByTopic.get(topic.id);
            const isRevealed = revealed.has(topic.id);
            const guided = guidedTargetId === topic.id;
            return (
              <g
                key={topic.id}
                className={`map-node ${isCurrent ? 'map-node--current' : ''} ${wasVisited ? 'map-node--visited' : ''} ${connection ? 'map-node--available' : ''} ${isRevealed ? '' : 'map-node--fogged'} ${guided ? 'is-guided' : ''}`}
                transform={`translate(${topic.position.x} ${topic.position.y})`}
                role={connection && !readOnly ? 'button' : undefined}
                tabIndex={connection && !readOnly ? 0 : undefined}
                aria-label={isRevealed ? `${topic.name}${connection ? 'へ移動' : ''}` : '未踏領域'}
                data-topic-id={topic.id}
                onClick={(event) => { event.stopPropagation(); handleNode(connection); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleNode(connection); }
                }}
              >
                <circle className="map-node__hit" r="46" fill="transparent" />
                {!isRevealed && <circle className="map-node__fog" r="68" />}
                <circle className="map-node__pulse" r="41" />
                <circle className="map-node__land" r={isCurrent ? 34 : 27} style={{ '--topic-color': topic.accent } as React.CSSProperties} />
                <text className="map-node__symbol" textAnchor="middle" y="7">{isRevealed ? SYMBOLS[topic.worldType] : '?'}</text>
                <text className="map-node__name" textAnchor="middle" y="58">{isRevealed ? topic.name : '？？？'}</text>
                {isCurrent && <text className="map-node__status" textAnchor="middle" y="78">現在地</text>}
                {connection && !isCurrent && <text className="map-node__hint" textAnchor="middle" y="78">{connection.relationshipType}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      {!readOnly && (
        <div className="map-controls" aria-label="地図操作">
          <button onClick={() => zoom(1.15)} aria-label="拡大">＋</button>
          <button onClick={() => zoom(0.87)} aria-label="縮小">−</button>
          <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} aria-label="全体表示">⌂</button>
        </div>
      )}
      {!readOnly && <p className="map-gesture-hint">ドラッグで移動 · ホイールまたはボタンで拡大</p>}
    </div>
  );
}

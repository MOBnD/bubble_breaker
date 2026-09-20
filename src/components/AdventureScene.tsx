import type { ExperienceStage } from '../types';

interface AdventureSceneProps {
  stage: ExperienceStage;
  continuationKind: string | null;
  onFirstSignal: () => void;
  onSecondSignal: () => void;
}

const FIRST_EXPANDED_STAGES: ExperienceStage[] = [
  'firstExpansion', 'secondEncounter', 'secondReveal', 'choice', 'continuationEncounter',
];
const SECOND_EXPANDED_STAGES: ExperienceStage[] = ['choice', 'continuationEncounter'];

export function AdventureScene({ stage, continuationKind, onFirstSignal, onSecondSignal }: AdventureSceneProps) {
  const started = stage !== 'departure';
  const firstExpanded = FIRST_EXPANDED_STAGES.includes(stage);
  const secondExpanded = SECOND_EXPANDED_STAGES.includes(stage);

  return (
    <section
      className={'adventure-scene stage-' + stage + (continuationKind ? ' continuation-' + continuationKind : '')}
      data-testid="adventure-scene"
      data-first-expanded={firstExpanded}
      data-second-expanded={secondExpanded}
      aria-label="霧に包まれた冒険世界"
    >
      <svg className="scene-art" viewBox="0 0 1600 900" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#07151f" />
            <stop offset=".58" stopColor="#12313b" />
            <stop offset="1" stopColor="#07171b" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="1" y2=".4">
            <stop stopColor="#142f2d" />
            <stop offset="1" stopColor="#061315" />
          </linearGradient>
          <linearGradient id="road" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#bfa668" stopOpacity=".14" />
            <stop offset="1" stopColor="#f2d68d" stopOpacity=".7" />
          </linearGradient>
          <radialGradient id="horizon-glow">
            <stop stopColor="#dbbd72" stopOpacity=".55" />
            <stop offset=".38" stopColor="#4d887b" stopOpacity=".2" />
            <stop offset="1" stopColor="#102c33" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fog-blur"><feGaussianBlur stdDeviation="28" /></filter>
          <pattern id="game-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" fill="none" stroke="#9bc2ac" strokeOpacity=".08" />
          </pattern>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />
        <circle className="horizon-glow" cx="1170" cy="390" r="390" fill="url(#horizon-glow)" />
        <g className="stars">
          <circle cx="196" cy="126" r="2" /><circle cx="360" cy="94" r="1.5" /><circle cx="590" cy="171" r="2" />
          <circle cx="795" cy="81" r="1.4" /><circle cx="1055" cy="142" r="2" /><circle cx="1410" cy="102" r="1.5" />
        </g>
        <path className="mountains far" d="M0 520L160 330 266 446 423 266 610 475 742 353 910 490 1098 286 1260 454 1420 304 1600 500V900H0Z" />
        <path className="mountains near" d="M0 605L214 438 386 566 590 399 792 574 1018 414 1202 560 1392 421 1600 570V900H0Z" />
        <path className="ground" d="M0 622C301 568 486 604 710 574C948 542 1187 558 1600 614V900H0Z" fill="url(#ground)" />
        <rect className="ground-grid" x="0" y="560" width="1600" height="340" fill="url(#game-grid)" />

        <g className={'starting-ruins ' + (started ? 'is-visible' : '')}>
          <path d="M154 618V493H202V457H250V538H303V618Z" />
          <path d="M337 618V528H387V492H427V618Z" />
          <rect x="186" y="520" width="21" height="21" /><rect x="232" y="493" width="20" height="20" />
          <circle cx="289" cy="571" r="13" /><path className="ruin-flag" d="M383 492V430M385 433l52 15-52 17" />
        </g>

        <path className={'broken-road ' + (started ? 'is-visible' : '')} d="M270 689C438 668 547 630 678 578" />
        <path className={'revealed-road ' + (firstExpanded ? 'is-visible' : '')} d="M676 578C841 525 975 500 1135 496" stroke="url(#road)" />
        <path className={'revealed-road second-road ' + (secondExpanded ? 'is-visible' : '')} d="M1135 496C1263 474 1372 443 1481 385" stroke="url(#road)" />

        <g className={'distant-city ' + (firstExpanded ? 'is-visible' : '')}>
          <path d="M1015 505V382H1055V346H1091V505M1110 505V420H1150V382H1180V505M1202 505V350H1238V310H1272V505M1295 505V404H1330V366H1361V505" />
          <path className="city-bridge" d="M942 522Q1085 433 1218 511" />
          <g className="city-lights"><circle cx="1068" cy="407" r="4" /><circle cx="1220" cy="381" r="4" /><circle cx="1320" cy="426" r="4" /></g>
        </g>

        <g className={'far-observatory ' + (secondExpanded ? 'is-visible' : '')}>
          <path d="M1417 420V279H1480V420Z" />
          <path d="M1394 284Q1448 211 1503 284Z" />
          <circle cx="1448" cy="264" r="40" />
          <path className="observatory-ray" d="M1448 225L1515 128" />
        </g>

        <g className={'continuation-signals ' + (secondExpanded ? 'is-visible' : '')}>
          <circle className="signal-one" cx="1295" cy="443" r="8" />
          <circle className="signal-two" cx="1370" cy="524" r="8" />
          <circle className="signal-three" cx="1464" cy="344" r="8" />
        </g>

        <g className="fog-banks" filter="url(#fog-blur)">
          <ellipse cx="270" cy="596" rx="370" ry="76" /><ellipse cx="855" cy="548" rx="470" ry="78" />
          <ellipse className="fog-far" cx="1320" cy="473" rx="430" ry="88" />
        </g>
      </svg>

      {stage === 'arrival' && (
        <button className="world-signal world-signal--first" onClick={onFirstSignal}>
          <span className="world-signal__pulse" aria-hidden="true" />
          <span className="world-signal__label"><small>説明のない気配</small>近づいてみる</span>
        </button>
      )}
      {stage === 'firstExpansion' && (
        <button className="world-signal world-signal--second" onClick={onSecondSignal}>
          <span className="world-signal__pulse" aria-hidden="true" />
          <span className="world-signal__label"><small>新しく現れた道</small>光を追う</span>
        </button>
      )}
      <div className="scene-vignette" aria-hidden="true" />
    </section>
  );
}

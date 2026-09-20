import type { ContinuationChoice, DiscoveryDefinition } from '../types';

export const FIRST_DISCOVERY: DiscoveryDefinition = {
  id: 'discover-wayfinding',
  encounterId: 'clue-distant-road',
  question: 'なぜ、人は“次の場所へ行きたくなる”ように作られた世界に惹かれるのだろう？',
  signal: '崩れた道の先で、ひとつの光だけが進む方向を示している。',
  revealTitle: 'ゲームの道は、現実の道とつながっていた',
  chain: ['ゲーム世界', '空間／レベル設計', 'ランドマーク', 'ウェイファインディング'],
  explanation: 'ゲームの空間も、目印や見通しを使って「どこへ進めそうか」を伝えています。現実世界から得られたナビゲーションの原則は、仮想空間の設計にも応用されています。',
  connectionId: 'game-to-wayfinding',
  discoveredConceptIds: ['level-design', 'landmarks', 'wayfinding'],
  unlockRegionId: 'city-threshold',
  unlockDescription: '霧の向こうに、橋と都市の輪郭が現れた。',
  nextUncertainty: 'その都市では、なぜ一本の道だけが目に入るのだろう？',
  sourceIds: ['darken-1994', 'sharma-2017'],
};

export const SECOND_DISCOVERY: DiscoveryDefinition = {
  id: 'discover-route-choice',
  encounterId: 'clue-city-lines',
  question: 'なぜ、同じ目的地でも、自然に選びたくなる道があるのだろう？',
  signal: '都市へ続く三本の道。そのうち一本だけが、遠くまで見通せる。',
  revealTitle: '空間は、気づかないうちに選択へ働きかける',
  chain: ['ウェイファインディング', '視線と空間構成', '経路選択', '都市／建築'],
  explanation: '道を選ぶとき、人は案内板だけでなく、見通しや道のつながりといった空間の構造にも注意を向けます。研究では、視線と選択した経路の間に関係が示されています。',
  connectionId: 'wayfinding-to-route-choice',
  discoveredConceptIds: ['spatial-geometry', 'route-choice', 'architecture'],
  unlockRegionId: 'observatory-horizon',
  unlockDescription: '都市の奥に、塔、地下道、観測所へ続く三つの気配が現れた。',
  nextUncertainty: '目印、非常口、頭の中の地図――同じ道から三つの謎が枝分かれしている。',
  sourceIds: ['emo-2014', 'rodriguez-2015'],
};

export const CONTINUATION_CHOICES: ContinuationChoice[] = [
  {
    kind: 'pursue',
    title: '追う',
    description: 'その謎をさらに追う',
    signal: '交差点の向こうで、片側だけを照らす標が明滅している。',
    encounterQuestion: '曲がり角の目印は、どこにあると「進む方向」になるのだろう？',
    destinationConceptId: 'landmark-placement',
    regionId: 'signal-crossroads',
  },
  {
    kind: 'detour',
    title: '寄り道',
    description: '別の気配を探す',
    signal: '地下へ続く道から、短い警告音のような光が届く。',
    encounterQuestion: '時間がないとき、人は何を手掛かりに安全な出口を選ぶのだろう？',
    destinationConceptId: 'emergency-wayfinding',
    regionId: 'subterranean-gate',
  },
  {
    kind: 'deepen',
    title: '深く潜る',
    description: '今見つけたものをもっと理解する',
    signal: '観測所の床に、歩いたことのない道の図形が浮かんでいる。',
    encounterQuestion: '一度歩いた場所は、どうやって頭の中の地図になるのだろう？',
    destinationConceptId: 'cognitive-map',
    regionId: 'memory-observatory',
  },
];

export const CHOICE_BY_KIND = new Map(CONTINUATION_CHOICES.map((choice) => [choice.kind, choice]));

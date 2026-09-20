import type { ConceptNode, KnowledgeConnection, SourceReference } from '../types';

export const SOURCES: SourceReference[] = [
  {
    id: 'darken-1994',
    title: 'A Study of Navigation in Virtual Space',
    authors: 'Rudy Darken, John L. Sibert, Randy Shumaker',
    year: 1994,
    url: 'https://ntrs.nasa.gov/api/citations/19940029513/downloads/19940029513.pdf',
    note: '現実世界のナビゲーション原則を仮想空間へ応用する研究。',
  },
  {
    id: 'sharma-2017',
    title: 'Influence of Landmarks on Wayfinding and Brain Connectivity in Immersive Virtual Reality Environment',
    authors: 'Greeshma Sharma et al.',
    year: 2017,
    url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.01220/full',
    note: 'ランドマークの有無が仮想迷路の経路探索へ与える影響を調べた実験。',
  },
  {
    id: 'emo-2014',
    title: 'Seeing the Axial Line: Evidence from Wayfinding Experiments',
    authors: 'Beatrix Emo',
    year: 2014,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4219269/',
    note: '都市空間の構造、視線、経路選択の関係を眼球運動から調べた研究。',
  },
  {
    id: 'rodriguez-2015',
    title: 'Influence of the Built Environment on Pedestrian Route Choices of Adolescent Girls',
    authors: 'Daniel A. Rodríguez et al.',
    year: 2015,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4426267/',
    note: '限定された対象集団における、建造環境と歩行経路選択の観察研究。',
  },
];

export const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

const legacyConceptSeeds: Array<[string, string, string, string]> = [
  ['game', 'ゲーム', '創造と表現', 'ルール、物語、技術が重なり、人の選択と感情を動かす体験。'],
  ['music', '音楽', '創造と表現', '音と時間の組み合わせが、記憶や文化、感情を運ぶ領域。'],
  ['human-psychology', '人間心理', '心と行動', '注意、感情、記憶、意思決定から人の行動を理解する領域。'],
  ['advertising', '広告', '創造と表現', '表現とデータを用いて、人の注意と選択に働きかける領域。'],
  ['algorithms', 'アルゴリズム', '技術と計算', '問題を解く手順が、検索、推薦、予測の仕組みを形づくる領域。'],
  ['crowd-simulation', '群衆シミュレーション', '技術と計算', '多数の人の動きをモデル化し、混雑や流れを予測する領域。'],
  ['disaster-evacuation', '災害避難', '社会と暮らし', '人命を守るため、情報、空間、人の行動を結びつける領域。'],
  ['urban-planning', '都市計画', '社会と暮らし', '交通、防災、住環境を組み合わせ、都市の未来を設計する領域。'],
  ['architecture', '建築', '社会と暮らし', '素材、構造、文化から、人が過ごす空間をつくる領域。'],
  ['behavioral-economics', '行動経済学', '心と行動', '合理的とは限らない人の選択を、心理と経済の両面から探る領域。'],
  ['history', '歴史', '知識と時間', '過去の選択と変化をたどり、現在の背景を読み解く領域。'],
  ['science', '科学', '知識と時間', '観察と検証によって、世界の規則性を探究する領域。'],
];

const LEGACY_CONCEPTS: ConceptNode[] = legacyConceptSeeds.map(([id, label, domain, summary]) => ({
  id, label, domain, summary, legacy: true,
}));

const ADVENTURE_CONCEPTS: ConceptNode[] = [
  { id: 'level-design', label: '空間／レベル設計', domain: 'ゲームと空間', summary: '移動、視線、発見の順序を空間として設計する考え方。' },
  { id: 'landmarks', label: 'ランドマーク', domain: '空間認知', summary: '現在地や進む方向を理解する手掛かり。' },
  { id: 'wayfinding', label: 'ウェイファインディング', domain: '空間認知', summary: '周囲の手掛かりを使って進路を判断する過程。' },
  { id: 'spatial-geometry', label: '視線と空間構成', domain: '都市と建築', summary: '見通しや道のつながりが知覚に与える構造。' },
  { id: 'route-choice', label: '経路選択', domain: '行動', summary: '複数の道から進路を選ぶ行動。' },
  { id: 'landmark-placement', label: '目印の配置', domain: '空間認知', summary: '分岐点で方向を伝えるランドマークの位置。' },
  { id: 'emergency-wayfinding', label: '非常時の経路探索', domain: '防災', summary: '限られた情報と時間の中で安全な道を選ぶ過程。' },
  { id: 'cognitive-map', label: '認知地図', domain: '記憶', summary: '場所どうしの関係について頭の中に作られる表象。' },
];

export const CONCEPTS: ConceptNode[] = [...LEGACY_CONCEPTS, ...ADVENTURE_CONCEPTS];
export const CONCEPT_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

const LEGACY_EDGES: Array<[string, string, string]> = [
  ['game', 'music', '体験を形づくる音'], ['game', 'human-psychology', '感情と注意の設計'], ['game', 'disaster-evacuation', '人の動きを読む技術'],
  ['music', 'game', '相互作用する音'], ['music', 'advertising', '記憶に残る表現'], ['music', 'architecture', '空間に響く音'],
  ['human-psychology', 'behavioral-economics', '選択の癖'],
  ['human-psychology', 'advertising', '注意と選択'], ['human-psychology', 'history', '時代を動かす心'], ['advertising', 'algorithms', '推薦の仕組み'],
  ['advertising', 'music', '音で伝える'], ['advertising', 'disaster-evacuation', '行動を促す伝達'],
  ['algorithms', 'crowd-simulation', '多数の動きを計算する'], ['algorithms', 'science', '仮説を検証する計算'],
  ['algorithms', 'history', '過去を読む計算'], ['crowd-simulation', 'science', 'モデルと観測'], ['crowd-simulation', 'disaster-evacuation', '安全な人の流れ'],
  ['crowd-simulation', 'algorithms', '動きを生む規則'],
  ['disaster-evacuation', 'urban-planning', '逃げられる都市'], ['disaster-evacuation', 'crowd-simulation', '避難行動の予測'], ['disaster-evacuation', 'music', '音で危険を知らせる'],
  ['urban-planning', 'architecture', '街を構成する空間'], ['urban-planning', 'disaster-evacuation', '防災の都市設計'], ['urban-planning', 'game', '都市を試す遊び'],
  ['architecture', 'urban-planning', '建物から街へ'], ['architecture', 'history', '空間に残る時代'], ['architecture', 'algorithms', '計算でつくる形'],
  ['behavioral-economics', 'human-psychology', '判断の仕組み'], ['behavioral-economics', 'advertising', '選ばれ方の設計'], ['behavioral-economics', 'science', '行動を確かめる実験'],
  ['history', 'architecture', '残された空間'], ['history', 'human-psychology', '集団の記憶'], ['history', 'algorithms', '史料の中のパターン'],
  ['science', 'algorithms', 'データから法則へ'], ['science', 'urban-planning', '知見を街へ生かす'], ['science', 'advertising', '検証される伝え方'],
];

const legacyConnections: KnowledgeConnection[] = LEGACY_EDGES.map(([fromConceptId, toConceptId, label]) => ({
  id: 'legacy-' + fromConceptId + '-' + toConceptId,
  fromConceptId,
  toConceptId,
  bridgeLabels: [label],
  explanation: '旧実装から保持した候補接続。出典確認まではAdventure Experienceで使用しない。',
  sourceIds: [],
  prototypeEligible: false,
}));

const curatedConnections: KnowledgeConnection[] = [
  {
    id: 'game-to-wayfinding',
    fromConceptId: 'game',
    toConceptId: 'wayfinding',
    bridgeLabels: ['空間／レベル設計', 'ランドマーク'],
    explanation: 'ゲームの空間も、目印や見通しを使って「どこへ進めそうか」を伝えています。現実世界から得られたナビゲーションの原則は、仮想空間の設計にも応用されています。',
    sourceIds: ['darken-1994', 'sharma-2017'],
    prototypeEligible: true,
  },
  {
    id: 'wayfinding-to-route-choice',
    fromConceptId: 'wayfinding',
    toConceptId: 'route-choice',
    bridgeLabels: ['視線と空間構成', '都市／建築'],
    explanation: '道を選ぶとき、人は案内板だけでなく、見通しや道のつながりといった空間の構造にも注意を向けます。研究では、視線と選択した経路の間に関係が示されています。',
    sourceIds: ['emo-2014', 'rodriguez-2015'],
    prototypeEligible: true,
  },
];

export const KNOWLEDGE_CONNECTIONS: KnowledgeConnection[] = [...legacyConnections, ...curatedConnections];
export const CONNECTION_BY_ID = new Map(KNOWLEDGE_CONNECTIONS.map((connection) => [connection.id, connection]));

export function getSource(sourceId: string): SourceReference {
  const source = SOURCE_BY_ID.get(sourceId);
  if (!source) throw new Error('Unknown source: ' + sourceId);
  return source;
}

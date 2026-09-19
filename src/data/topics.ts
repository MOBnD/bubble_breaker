import type { BranchKind, Topic, TopicConnection } from '../types';

export const TOPICS: Topic[] = [
  {
    id: 'game', name: 'ゲーム', categoryId: 'creative', categoryLabel: '創造と表現',
    summary: 'ルール、物語、技術が重なり、人の選択と感情を動かす体験の領域。',
    worldType: 'kingdom', landmark: '選択の城', position: { x: 190, y: 410 }, accent: '#f0b76a',
  },
  {
    id: 'music', name: '音楽', categoryId: 'creative', categoryLabel: '創造と表現',
    summary: '音と時間の組み合わせが、記憶や文化、感情を運ぶ領域。',
    worldType: 'village', landmark: '響きの森', position: { x: 120, y: 190 }, accent: '#db8fb4',
  },
  {
    id: 'human-psychology', name: '人間心理', categoryId: 'mind', categoryLabel: '心と行動',
    summary: '注意、感情、記憶、意思決定から人の行動を理解する領域。',
    worldType: 'city', landmark: '心象の都', position: { x: 410, y: 330 }, accent: '#c89ee8',
  },
  {
    id: 'advertising', name: '広告', categoryId: 'creative', categoryLabel: '創造と表現',
    summary: '表現とデータを用いて、人の注意と選択に働きかける領域。',
    worldType: 'city', landmark: '伝達の港', position: { x: 525, y: 150 }, accent: '#ef8c73',
  },
  {
    id: 'algorithms', name: 'アルゴリズム', categoryId: 'technology', categoryLabel: '技術と計算',
    summary: '問題を解く手順が、検索、推薦、予測の仕組みを形づくる領域。',
    worldType: 'tower', landmark: '計算の塔', position: { x: 710, y: 255 }, accent: '#72cfd0',
  },
  {
    id: 'crowd-simulation', name: '群衆シミュレーション', categoryId: 'technology', categoryLabel: '技術と計算',
    summary: '多数の人の動きをモデル化し、混雑や流れを予測する領域。',
    worldType: 'ruin', landmark: '流動の遺跡', position: { x: 855, y: 420 }, accent: '#75b9d3',
  },
  {
    id: 'disaster-evacuation', name: '災害避難', categoryId: 'society', categoryLabel: '社会と暮らし',
    summary: '人命を守るため、情報、空間、人の行動を結びつける領域。',
    worldType: 'kingdom', landmark: '灯台の砦', position: { x: 1040, y: 330 }, accent: '#f0c764',
  },
  {
    id: 'urban-planning', name: '都市計画', categoryId: 'society', categoryLabel: '社会と暮らし',
    summary: '交通、防災、住環境を組み合わせ、都市の未来を設計する領域。',
    worldType: 'city', landmark: '環状都市', position: { x: 1030, y: 565 }, accent: '#82c68f',
  },
  {
    id: 'architecture', name: '建築', categoryId: 'society', categoryLabel: '社会と暮らし',
    summary: '素材、構造、文化から、人が過ごす空間をつくる領域。',
    worldType: 'village', landmark: '構造の谷', position: { x: 760, y: 590 }, accent: '#d49c6b',
  },
  {
    id: 'behavioral-economics', name: '行動経済学', categoryId: 'mind', categoryLabel: '心と行動',
    summary: '合理的とは限らない人の選択を、心理と経済の両面から探る領域。',
    worldType: 'village', landmark: '選択の市場', position: { x: 390, y: 570 }, accent: '#b59ad8',
  },
  {
    id: 'history', name: '歴史', categoryId: 'knowledge', categoryLabel: '知識と時間',
    summary: '過去の選択と変化をたどり、現在の背景を読み解く領域。',
    worldType: 'ruin', landmark: '時の書庫', position: { x: 590, y: 665 }, accent: '#d8b879',
  },
  {
    id: 'science', name: '科学', categoryId: 'knowledge', categoryLabel: '知識と時間',
    summary: '観察と検証によって、世界の規則性を探究する領域。',
    worldType: 'tower', landmark: '観測の尖塔', position: { x: 895, y: 105 }, accent: '#8db9ee',
  },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

type LinkSeed = [
  from: string,
  to: string,
  kind: BranchKind,
  relationship: string,
  bridgeLabels: string[],
  explanation: string,
  surprise: number,
];

const LINK_SEEDS: LinkSeed[] = [
  ['game', 'music', 'deep', '体験を形づくる音', ['ゲーム体験', '音の演出'], 'ゲーム音楽は、操作や物語に感情のリズムを与えます。', 2],
  ['game', 'human-psychology', 'sideways', '感情と注意の設計', ['ユーザー体験', '感情'], 'ゲームは人の行動・感情・注意を設計するため、人間心理とつながっています。', 6],
  ['game', 'disaster-evacuation', 'uncharted', '人の動きを読む技術', ['群衆シミュレーション', '人間の行動モデル', '避難経路'], 'ゲームで使われる人の動きのモデルは、現実の避難計画にも関係します。', 10],

  ['music', 'game', 'deep', '相互作用する音', ['インタラクティブ音楽'], '操作に応じて変化する音楽は、ゲーム世界への没入を支えます。', 3],
  ['music', 'advertising', 'sideways', '記憶に残る表現', ['感情', 'ブランド記憶'], '音楽が呼び起こす感情と記憶は、広告表現にも活用されています。', 5],
  ['music', 'architecture', 'uncharted', '空間に響く音', ['音響', '空間設計'], '音の反射や響き方を考えることは、建築空間の設計にもつながります。', 8],

  ['human-psychology', 'behavioral-economics', 'deep', '選択の癖', ['認知バイアス', '意思決定'], '人の判断の癖を、経済活動の中で観察するのが行動経済学です。', 3],
  ['human-psychology', 'advertising', 'sideways', '注意と選択', ['注意', '感情', '意思決定'], '広告は、人が何に注意し、どう選ぶかという心理の知見と深く結びつきます。', 5],
  ['human-psychology', 'history', 'uncharted', '時代を動かす心', ['集団心理', '社会変化'], '歴史的な出来事の背景には、個人と集団の心理的な動きがあります。', 8],

  ['advertising', 'music', 'deep', '音で伝える', ['サウンドロゴ', '記憶'], '短い音や旋律は、言葉とは別の経路で印象を残します。', 3],
  ['advertising', 'algorithms', 'sideways', '推薦の仕組み', ['行動データ', '推薦システム'], '広告やおすすめは、行動データを処理するアルゴリズムによって選ばれます。', 6],
  ['advertising', 'disaster-evacuation', 'uncharted', '行動を促す伝達', ['リスク情報', '行動喚起'], '人に適切な行動を促す伝え方は、災害時の情報設計でも重要です。', 9],

  ['algorithms', 'crowd-simulation', 'deep', '多数の動きを計算する', ['エージェントモデル', '予測'], '個々の動きの規則を計算することで、群衆全体の流れを再現できます。', 4],
  ['algorithms', 'science', 'sideways', '仮説を検証する計算', ['データ解析', 'モデル'], '科学では、観測データから規則性を探すためにアルゴリズムが使われます。', 5],
  ['algorithms', 'history', 'uncharted', '過去を読む計算', ['史料のデジタル化', 'パターン発見'], '大量の史料を計算で比較すると、人だけでは見つけにくい変化が見えてきます。', 9],

  ['crowd-simulation', 'algorithms', 'deep', '動きを生む規則', ['局所ルール', '計算モデル'], '群衆モデルは、一人ひとりの単純な行動規則をアルゴリズムとして表します。', 3],
  ['crowd-simulation', 'science', 'sideways', 'モデルと観測', ['仮説', '検証'], 'シミュレーションと現実の観測を比べることで、モデルの妥当性を検証できます。', 5],
  ['crowd-simulation', 'disaster-evacuation', 'uncharted', '安全な人の流れ', ['人間の行動モデル', '避難経路'], '群衆の動きを考える技術は、混雑を避ける避難経路の設計に役立ちます。', 10],

  ['disaster-evacuation', 'urban-planning', 'deep', '逃げられる都市', ['避難場所', '道路網'], '都市計画は、災害時に人が安全に移動できる場所と道を準備します。', 4],
  ['disaster-evacuation', 'crowd-simulation', 'sideways', '避難行動の予測', ['混雑', '行動モデル'], '避難する人の流れを再現すると、危険な混雑を事前に見つけられます。', 5],
  ['disaster-evacuation', 'music', 'uncharted', '音で危険を知らせる', ['警報音', '注意'], '緊急時の音は、騒がしい環境でも危険と行動を素早く伝える必要があります。', 9],

  ['urban-planning', 'architecture', 'deep', '街を構成する空間', ['建物', '公共空間'], '建築の集まりとその間の空間が、都市の日常を形づくります。', 3],
  ['urban-planning', 'disaster-evacuation', 'sideways', '防災の都市設計', ['道路網', '避難拠点'], '道路や公園の配置は、平時の暮らしだけでなく災害時の安全も左右します。', 5],
  ['urban-planning', 'game', 'uncharted', '都市を試す遊び', ['都市シミュレーション', '選択'], '都市を題材にしたゲームは、政策や設計の結果を安全に試せる実験場になります。', 8],

  ['architecture', 'urban-planning', 'deep', '建物から街へ', ['公共空間', '街区'], '一つの建物の設計は、周囲の道や広場を通して都市全体へ影響します。', 3],
  ['architecture', 'history', 'sideways', '空間に残る時代', ['建築様式', '暮らし'], '建物には、その時代の技術、価値観、生活の痕跡が残されています。', 5],
  ['architecture', 'algorithms', 'uncharted', '計算でつくる形', ['生成設計', '構造最適化'], '条件から形を導くアルゴリズムは、建築の構造や空間の設計にも使われます。', 9],

  ['behavioral-economics', 'human-psychology', 'deep', '判断の仕組み', ['認知', '感情'], '行動経済学の選択モデルは、人間心理の実験や知見を土台にしています。', 3],
  ['behavioral-economics', 'advertising', 'sideways', '選ばれ方の設計', ['ナッジ', '選択肢'], '選択肢の見せ方が行動を変える知見は、広告や案内の設計にも使われます。', 5],
  ['behavioral-economics', 'science', 'uncharted', '行動を確かめる実験', ['仮説', '実験'], '直感だけでなく実験で選択を確かめる姿勢は、科学的方法と共通します。', 8],

  ['history', 'architecture', 'deep', '残された空間', ['遺構', '生活文化'], '古い建築を読むと、文書だけでは分からない過去の暮らしが見えてきます。', 3],
  ['history', 'human-psychology', 'sideways', '集団の記憶', ['価値観', '集団心理'], '人々が何を恐れ、望み、記憶したかは、歴史の動きを理解する鍵になります。', 6],
  ['history', 'algorithms', 'uncharted', '史料の中のパターン', ['デジタル史料', '分析'], '計算による史料分析は、長い時間にまたがる言葉や関係の変化を発見します。', 9],

  ['science', 'algorithms', 'deep', 'データから法則へ', ['測定', '分析'], '観測したデータを整理し規則性を見つけるため、アルゴリズムが活躍します。', 3],
  ['science', 'urban-planning', 'sideways', '知見を街へ生かす', ['環境測定', '政策設計'], '気候や交通の観測結果は、より安全で持続可能な都市づくりに使われます。', 6],
  ['science', 'advertising', 'uncharted', '検証される伝え方', ['認知実験', '効果測定'], '表現の効果を測定して検証する過程には、科学的な考え方が入り込んでいます。', 8],
];

const DISTANCE_BY_KIND: Record<BranchKind, number> = {
  deep: 1,
  sideways: 4,
  uncharted: 7,
};

export const CONNECTIONS: TopicConnection[] = LINK_SEEDS.map((seed) => {
  const [fromTopicId, toTopicId, branchKind, relationshipType, bridgeLabels, explanation, surpriseScore] = seed;
  return {
    id: `${fromTopicId}--${toTopicId}`,
    fromTopicId,
    toTopicId,
    branchKind,
    distance: DISTANCE_BY_KIND[branchKind],
    relationshipType,
    bridgeLabels,
    explanation,
    surpriseScore,
  };
});

export const CONNECTION_BY_ID = new Map(CONNECTIONS.map((connection) => [connection.id, connection]));

export function getTopic(topicId: string): Topic {
  const topic = TOPIC_BY_ID.get(topicId);
  if (!topic) throw new Error(`Unknown topic: ${topicId}`);
  return topic;
}

export function getBranchConnections(topicId: string): TopicConnection[] {
  return CONNECTIONS.filter((connection) => connection.fromTopicId === topicId).sort(
    (a, b) => DISTANCE_BY_KIND[a.branchKind] - DISTANCE_BY_KIND[b.branchKind],
  );
}

export function getConnection(connectionId: string): TopicConnection {
  const connection = CONNECTION_BY_ID.get(connectionId);
  if (!connection) throw new Error(`Unknown connection: ${connectionId}`);
  return connection;
}

export const BRANCH_LABELS: Record<BranchKind, { title: string; description: string; icon: string }> = {
  deep: { title: '深く潜る', description: '今いる領域を、もう一段深く知る', icon: '⌄' },
  sideways: { title: '横へ進む', description: '意味の橋を渡り、隣の分野へ', icon: '→' },
  uncharted: { title: '未踏の地へ', description: '遠い領域との意外な接続を探す', icon: '✦' },
};

export const STANDARD_DEMO_PATH = [
  'game',
  'human-psychology',
  'advertising',
  'algorithms',
  'crowd-simulation',
  'disaster-evacuation',
] as const;

import type { DemoStep } from '../types';

export const DEMO_STEPS: DemoStep[] = [
  {
    screen: 'home', currentTopicId: null, targetTopicId: 'game',
    title: '冒険の入口', instruction: '「興味から出発」を選び、ゲームから旅を始めましょう。',
  },
  {
    screen: 'world', currentTopicId: 'game', targetTopicId: 'human-psychology',
    title: '最初の予想外', instruction: '霧の向こうに現れた「人間心理」への道を選びます。',
  },
  {
    screen: 'discovery', currentTopicId: 'human-psychology', targetTopicId: 'advertising',
    title: '横へ進む', instruction: '心理から、注意と選択を扱う広告の領域へ進みます。',
  },
  {
    screen: 'discovery', currentTopicId: 'advertising', targetTopicId: 'algorithms',
    title: 'おすすめの裏側', instruction: '広告から推薦システムを経て、アルゴリズムへ進みます。',
  },
  {
    screen: 'discovery', currentTopicId: 'algorithms', targetTopicId: 'crowd-simulation',
    title: '計算を深く潜る', instruction: '多数の動きを計算する群衆シミュレーションを発見します。',
  },
  {
    screen: 'discovery', currentTopicId: 'crowd-simulation', targetTopicId: 'disaster-evacuation',
    title: '遠い大陸へ', instruction: '「未踏の地へ」を選び、災害避難との意外な接続をたどります。',
  },
  {
    screen: 'discovery', currentTopicId: 'disaster-evacuation',
    title: '大きな発見', instruction: 'ゲームからここまで歩いた道を、冒険記で振り返りましょう。',
  },
  {
    screen: 'log', currentTopicId: 'disaster-evacuation',
    title: '次は、この先へ', instruction: '冒険は終わりではありません。地図にはまだ未知が残っています。',
  },
];

export function findDemoStep(screen: DemoStep['screen'], topicId: string | null): number {
  return DEMO_STEPS.findIndex((step) => step.screen === screen && step.currentTopicId === topicId);
}

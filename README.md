# BubbleBreaker v2 — Information Adventure

興味の近くに閉じず、意味のある意外な接続をたどって未知の情報分野を冒険するUXプロトタイプです。既存v1とは独立したReact / TypeScriptプロジェクトです。

## 起動

Node.js 20.19以降を使用してください。

```powershell
cd BubbleBreaker_v2
npm install
npm run dev
```

表示されたURLをブラウザで開きます。`/#/demo`では「ゲーム」から「災害避難」までのガイド付き標準シナリオを体験できます。

## 画面

- `/#/` — 3つの出発方法を選ぶHOME
- `/#/world` — パン・ズーム可能な霧の世界地図
- `/#/discovery/:topicId` — 発見、到達理由、次の3方向
- `/#/log` — 歩いた道、発見、探索分野を残す冒険記
- `/#/demo` — 通常履歴を変更しないガイド付きデモ

## Phase 1のデータと保存

12テーマと36本の方向付き接続を固定データとして収録しています。各テーマには「深く潜る」「横へ進む」「未踏の地へ」が1本ずつあり、すべての遷移に説明可能な中間概念と到達理由があります。

通常の冒険は`bubble-breaker-v2:journeys:v1`としてlocalStorageへ保存します。デモ履歴はメモリ内だけに保持し、通常の冒険記には混在しません。バックエンド、OpenAI API、認証、BGMはPhase 1に含めていません。

## 検証

```powershell
npm run check
npm test
npm run build
npm run test:e2e
```

E2Eテストを初めて実行する環境では、先にChromiumを導入します。

```powershell
npx playwright install chromium
```

単体・コンポーネントテストはテーマグラフ、状態保存、出発画面、デモ開始を検査します。Playwrightはデスクトップとモバイルで標準シナリオと再読込後の継続を検査します。

# BubbleBreaker v2 — Information Adventure

興味の近くに閉じず、意味のある意外な接続をたどって未知の情報分野を冒険するUXプロトタイプです。

このブランチでは、v1の静的HTML／JavaScript構成をReact／TypeScript／Vite構成へ置き換えています。v1の実装は`main`ブランチのGit履歴にあり、関連資料は`docs/v1/`に保存しています。v2の要件定義は`docs/v2/`を参照してください。

## 動作環境

- Node.js `^20.19.0` または `>=22.12.0`
- npm

## セットアップと起動

リポジトリ直下で次のコマンドを実行します。

```powershell
npm ci
npm run dev
```

ターミナルに表示されたURLをブラウザで開きます。`/#/demo`では「ゲーム」から「災害避難」までのガイド付き標準シナリオを体験できます。

本番用ビルドとローカルプレビューは次のコマンドで実行できます。

```powershell
npm run build
npm run preview
```

ビルド成果物は`dist/`に生成され、Gitの追跡対象には含まれません。

## 画面

- `/#/` — 3つの出発方法を選ぶホーム画面
- `/#/world` — パン・ズーム可能な霧の世界地図
- `/#/discovery/:topicId` — 発見内容、到達理由、次の3方向を表示する画面
- `/#/log` — 歩いた道、発見、探索分野を残す冒険記
- `/#/demo` — 通常履歴を変更しないガイド付きデモ

## データと保存

Phase 1では、12テーマと36本の方向付き接続を固定データとして収録しています。各テーマには「深く潜る」「横へ進む」「未踏の地へ」が1本ずつあり、すべての遷移に説明可能な中間概念と到達理由があります。

通常の冒険は`bubble-breaker-v2:journeys:v1`としてブラウザのlocalStorageへ保存します。デモ履歴はメモリ内だけに保持し、通常の冒険記には混在しません。

現在のPhase 1には、バックエンド、OpenAI API、認証、BGMは含まれていません。

## 主なディレクトリ

- `src/pages/` — 各画面
- `src/components/` — 共通UIと世界地図
- `src/data/` — テーマ、接続、デモデータ
- `src/state/` — 冒険状態とlocalStorageへの保存処理
- `src/lib/` — 経路選択などのドメインロジック
- `src/test/` — Vitestの共通セットアップ
- `e2e/` — PlaywrightによるE2Eテスト
- `docs/v1/` — v1の資料
- `docs/v2/` — v2の要件定義

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

単体・コンポーネントテストでは、テーマグラフ、状態保存、出発画面、デモ開始を検証します。Playwrightでは、デスクトップとモバイルの標準シナリオ、および再読み込み後の継続動作を検証します。

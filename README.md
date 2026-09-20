# BubbleBreaker — Adventure Core

「ゲーム」への興味から出発し、問い、発見、意外な接続、世界の拡張を通して、普段は探さない情報領域へ進むUXプロトタイプです。

現在の唯一の仕様は **docs/v2/** のAdventure Core要件です。旧仕様のカテゴリブラウザではなく、次の感情ループを体験の中心にしています。

    好奇心 → 接近 → 発見 → 意外な接続 → 世界の拡張 → 次の好奇心

## 起動

Node.js ^20.19.0 または >=22.12.0 とnpmを使用します。

    npm ci
    npm run dev

ブラウザで表示されたURLを開きます。アプリは単一のAdventure Experienceで、進行状況は **bubble-breaker:v2:adventure-state:v1** としてlocalStorageへ保存されます。旧実装の保存データは読み込まず、削除もしません。

## 実装済み

- 「ゲーム」だけを操作可能にした静かな出発画面
- ラベルを明かす前に、問いと気配へ接近するEncounter
- ゲーム世界 → 空間／レベル設計 → ランドマーク → ウェイファインディングの第一発見
- 発見後に霧、道、橋、都市が現れる世界拡張
- ウェイファインディング → 視線と空間構成 → 経路選択 → 都市／建築の第二発見
- 「追う／寄り道／深く潜る」から選ぶ3つの次回Encounter
- 発見、接続、開いた世界と出典を残す最小冒険記
- 旧12テーマを非表示のKnowledge Graphとして保持し、検証済み接続だけをVertical Sliceで利用
- デスクトップ／モバイル、キーボード、reduced-motion対応

## 未実装

- 3つの次回Encounterより先のReveal
- ゲーム以外の出発地点
- 自動推薦、個人化、大規模Knowledge Graph
- アカウント、ソーシャル、ランキング、XP、戦闘、インベントリ
- バックエンド、音声

## 現在のUX上の課題

- CuriosityやAdventure feelingは自動テストだけでは判定できないため、初見ユーザーによる5分間の観察テストが必要です。
- MVPの事実コンテンツは少数の研究資料に基づく手動キュレーションです。対象集団が限定された研究は、その範囲を超えて一般化しない表現にしています。
- 世界表現はCSSとインラインSVGによるプロトタイプであり、音や高密度な環境演出は含みません。

## 構成

- **src/data/** — 非表示の知識グラフ、出典、キュレーション済み発見
- **src/lib/** — Adventure状態機械
- **src/state/** — React Contextとv2専用localStorage
- **src/components/** — 世界シーン、体験パネル、冒険記
- **e2e/** — デスクトップ／モバイルのVertical Slice検証
- **docs/v2/** — 唯一の現行要件

## 検証

    npm run check
    npm test
    npm run build
    npm run test:e2e

E2Eで使用するChromiumがない場合は、先に **npx playwright install chromium** を実行してください。

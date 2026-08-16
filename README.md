# BubbleBreaker

Web Searchを使って入力意見からバブル宇宙を生成するThree.jsプロトタイプです。

## 起動

1. `.env.example` を `.env` にコピーし、`OPENAI_API_KEY` を設定します。
2. `npm run build` を実行します。
3. `dist/bb_proto4.html` をWebサーバー経由で開きます。

APIキーを設定せずにビルドした場合は、既存の固定データへフォールバックします。生成HTMLにはAPIキーが含まれるため、公開配布時にはキーを埋め込まない構成を使用してください。

`npm run check` でHTML内のアプリケーションJavaScriptの構文を確認できます。

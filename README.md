# BubbleBreaker

Web Searchを使って入力意見からバブル宇宙を生成するThree.jsプロトタイプです。入力意見を含むカテゴリを起点に、親カテゴリ・対象カテゴリ・下位カテゴリの3階層を探索できます。

## ファイル構成

| ファイル | 説明 |
| --- | --- |
| `bb_proto4.html` | アプリ本体。UI、Three.js描画、画面遷移、Web Search API呼び出し、固定データフォールバックを含むソースHTML。 |
| `package.json` | ビルドと構文チェック用のnpmスクリプト定義。外部npm依存はありません。 |
| `scripts/build.mjs` | `.env`または環境変数からAPIキー・モデルを読み込み、`dist/bb_proto4.html`へ設定を注入するビルドスクリプト。 |
| `scripts/check-inline-script.mjs` | `bb_proto4.html`内のアプリケーションJavaScriptを抽出して構文チェックするスクリプト。 |
| `.env.example` | 必要な環境変数のサンプル。実際のキーは`.env`に設定します。 |
| `.gitignore` | `.env`、`dist/`、`node_modules/`をGit管理から除外します。 |
| `BubbleBreaker仕様書.xlsx` | 画面・データ・技術要件をまとめた仕様書です。 |

## 必要環境

- Node.js 18以降
- WebGL対応ブラウザ
- Web Searchを利用する場合はOpenAI APIキー
- CDN（Tailwind CSS、Three.js）へ接続できるネットワーク

## セットアップ

PowerShellの場合:

```powershell
Copy-Item .env.example .env
```

`.env`を編集し、次の値を設定します。

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.6-luna
```

`OPENAI_MODEL`は省略可能です。省略時は`gpt-5.6-luna`を使用します。

環境変数を変更した場合は、必ず`npm run build`を再実行してください。ブラウザで開くファイルはソースの`bb_proto4.html`ではなく、ビルド後の`dist/bb_proto4.html`です。

## コマンド

### ビルド

```powershell
npm run build
```

`bb_proto4.html`を読み込み、`dist/bb_proto4.html`を生成します。`.env`またはプロセス環境変数の`OPENAI_API_KEY`が設定されていれば、生成HTMLにAPIキーを注入します。キーがない場合もビルドは成功し、固定データへフォールバックするHTMLを生成します。

### JavaScript構文チェック

```powershell
npm run check
```

HTML内のインラインJavaScriptを検査します。API呼び出しやブラウザ表示は行いません。

## 起動

ビルド後、`dist/bb_proto4.html`をWebサーバー経由で開きます。`file://`で直接開くより、次のようなローカルサーバーの利用を推奨します。

```powershell
npx serve dist
```

表示されたURLをブラウザで開き、意見を入力して「宇宙へダイブ」を押します。APIキー未設定、APIエラー、検索結果の不正時は既存の固定データで動作します。

## APIとデータの挙動

- OpenAI Responses APIの`web_search`ツールで公開Web情報を検索します。
- Structured OutputsのJSON Schemaでバブル群データを受け取り、クライアント側で検証・正規化します。
- 検索結果は「親カテゴリ → 入力意見を含むカテゴリ → 下位カテゴリ」の3階層に正規化し、入力確定後は中央のカテゴリを表示します。
- 各バブル群は通常10個を生成し、検索で根拠を確認できる範囲で1〜10個を許容します。クライアント側でバブル同士が重ならないよう位置を分離します。
- バブルの割合、形成史、構成層は検索情報からの推定値として表示されます。
- 検索ソースのURLは解析詳細画面に表示します。
- API呼び出しは初回を含め最大2回（初回＋1回再試行）で、1回あたり最大120秒待機します。Web Searchの検索コンテキストは`medium`に設定しています。
- APIキーがない場合や最終的に失敗した場合は固定DBへフォールバックします。
- API通信の状態、HTTPステータス、リトライ、レスポンス解析、フォールバック理由はブラウザの開発者ツール（F12）のConsoleで確認できます。APIキーやAuthorizationヘッダーはログに出力しません。

### APIエラーの確認

1. F12で開発者ツールを開き、`Console`タブを選択します。
2. 意見を入力して「宇宙へダイブ」を押します。
3. `[BubbleBreaker][OpenAI]`で始まるログを確認します。

`401`はAPIキー、`400`はモデル名またはリクエスト形式、`429`は利用上限・レート制限、`5xx`はOpenAI側の一時的なエラーです。`API_TIMEOUT`は120秒以内に応答がなかった場合、`API_NETWORK_ERROR`は通信・CORS・DNSなどのエラーです。APIキー未設定の場合は、リクエストを送らず固定データへフォールバックするログが表示されます。

## セキュリティ上の注意

このプロトタイプはブラウザからOpenAI APIを直接呼び出すため、ビルド生成物にAPIキーが含まれます。`dist/bb_proto4.html`を公開配布する場合、キーが利用者から見えることを前提にしてください。本番利用では、APIキーをブラウザへ渡さないバックエンドプロキシ構成に変更してください。

`.env`と`dist/`は`.gitignore`で除外されています。実際のAPIキーをコミットしないでください。

## 起動

1. `.env.example` を `.env` にコピーし、`OPENAI_API_KEY` を設定します。
2. `npm run build` を実行します。
3. `dist/bb_proto4.html` をWebサーバー経由で開きます。

APIキーを設定せずにビルドした場合は、既存の固定データへフォールバックします。生成HTMLにはAPIキーが含まれるため、公開配布時にはキーを埋め込まない構成を使用してください。

`npm run check` でHTML内のアプリケーションJavaScriptの構文を確認できます。

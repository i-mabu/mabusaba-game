# mabusaba Game Bot

`mabusaba-game` は、`mabusaba` から分離された**ゲーム専用 Discord Bot**です。メインの管理ボットとは別の Discord Application、Bot Token、Client ID を使用します。同じ Discord サーバーへ両方を導入できます。

## 提供機能

| 区分 | 内容 |
| --- | --- |
| ゲーム | `/game` からサイコロ、コイントス、じゃんけん、HIGH & LOW、スロット、Blackjack、Roulette、Quiz、数字当てを提供 |
| 統計・履歴 | `/game-logs`、`/game-points`、`/game-stats`、`/profile`、`/ranking` |
| 永続化 | `src/data/games.db` にユーザーのポイントとゲーム履歴を保存 |
| 任意の通知 | `AUDIT_LOG_CHANNEL_ID` を設定すると、ゲーム結果を Discord チャンネルへ Embed で通知 |
| Node.js | `>=20 <27` |

> **Game Bot は `moderation.db` を作成・使用しません。** モデレーション Case や管理用監査ログは Main Bot 側で管理してください。

## セットアップ

Node.js 20 以上を用意し、Game Bot 用のDiscord認証情報を設定して起動します。Main Bot と同一の Bot Token または Client ID を使わないでください。

```bash
cp .env.example .env
npm ci
npm run deploy
npm start
```

```env
DISCORD_TOKEN=YOUR_GAME_BOT_TOKEN
CLIENT_ID=YOUR_GAME_APPLICATION_ID
GUILD_ID=YOUR_GUILD_ID
AUDIT_LOG_CHANNEL_ID=
DB_BACKUP_ON_START=true
DB_BACKUP_RETENTION=10
```

Game Bot は通常のスラッシュコマンド操作に必要な **Guilds** のみを要求します。Message Content Intent や Server Members Intent は不要です。監査通知を有効にする場合は、通知先チャンネルに View Channel、Send Messages、Embed Links の権限を付与してください。

## 既存ゲームデータの移行

旧統合版または Main Bot 側に残っているゲームデータを利用する場合は、両ボットを停止してから `games.db` をコピーします。コピー先に同名ファイルがある場合は、先に安全な場所へ退避してください。

```bash
mkdir -p /path/to/mabusaba-game/src/data
cp /path/to/mabusaba-main/src/data/games.db /path/to/mabusaba-game/src/data/games.db
```

起動時にDB整合性を確認し、足りない列・インデックスだけを追加します。既存のユーザー、ポイント、ゲーム履歴は削除も上書きもされません。バックアップは標準で `src/data/backups/<timestamp>/` に保存され、保持世代数は `DB_BACKUP_RETENTION` で設定できます。

## ポイントの整合性

ゲーム結果のポイント更新とログ保存は同一トランザクションで実行されます。修正版では、結果適用後にポイントが負数となる操作を拒否します。ランキング、ゲームログ、最近の履歴の取得件数も最大100件に制限され、過大なリクエストによる負荷を抑えます。

## 品質確認

以下は外部サービスへの接続なしで実行できます。`npm test` は一時ディレクトリで、ゲーム専用DBの作成、モデレーションDB非作成、ポイントの負残高防止を確認します。

```bash
npm run check
npm test
npm run db:check
npm run db:backup
```

実データに触れずに個別検証する必要がある場合は、`MABUSABA_DATA_DIR` に一時ディレクトリを指定してください。

## コンテナ実行

`.env` を設定済みであれば、ホストのゲームデータを永続化した状態でコンテナを起動できます。

```bash
docker compose build
docker compose up -d
```

`compose.yaml` は `./src/data` をコンテナへマウントします。コンテナ再作成前にも、必要に応じて `src/data/games.db` を別の場所へバックアップしてください。

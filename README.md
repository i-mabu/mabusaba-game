# mabusaba 改良版

Discord.js v14 + SQLite (`better-sqlite3`) のコミュニティBotです。

## 主な追加機能

### モデレーション
- `/moderation history user:@user` — 処罰履歴（ページング）
- `/moderation case id:123` — Case詳細
- `/moderation search query:...` — Case検索
- `/moderation stats [user]` — 処罰統計
- `/moderation note id:123` — 管理者メモ
- `/warn`, `/mute`, `/kick`, `/ban`, `/unmute`, `/unban`
- すべての処罰にCase IDを付与
- 処罰情報を `src/data/moderation.db` に保存

### 監査ログ
Bot独自の監査ログDBに以下を保存します。
- MEMBER
- MODERATION
- MESSAGE
- CHANNEL
- ROLE
- BOT
- GAME
- SYSTEM

検索:
`/audit-log [type] [query] [user]`

ログ送信先は以下の環境変数を上から順に使用します。

```env
AUDIT_LOG_CHANNEL_ID=
MOD_LOG_CHANNEL_ID=
LOG_CHANNEL_ID=
```

### ゲーム
既存の `/game` を維持しつつ、以下を追加。

`/game-plus blackjack`
`/game-plus roulette`
`/game-plus quiz`
`/game-plus numberguess`

結果は既存のゲームポイント・ゲームログへ記録されます。

## 起動

```bash
npm install
npm run deploy
npm start
```

`.env`:

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
CLIENT_ID=YOUR_APPLICATION_ID
GUILD_ID=YOUR_TEST_GUILD_ID

AUDIT_LOG_CHANNEL_ID=123456789012345678
AUTO_ROLE_ID=YOUR_ROLE_ID
```

`deploy-commands.js` の既存設定に合わせて `CLIENT_ID` / `GUILD_ID` を設定してください。

## 注意

- SQLite DBは実行時に自動作成されます。
- `src/data/*.db` はGit管理対象外です。
- Botには必要な権限（Moderate Members / Ban Members / Kick Members / View Audit Log / Embed Links等）を付与してください。

## DB自動移行・バックアップ

v1.2.2では起動時にSQLiteの整合性を確認し、旧版の `games.db` に不足している列・インデックスを追加する安全な加算型マイグレーションを実行します。既存行は削除・上書きしません。

### バックアップ

デフォルトで起動前の既存DBを `src/data/backups/YYYYMMDDTHHMMSSZ/` にバックアップします。保持数は `DB_BACKUP_RETENTION`（既定10世代）で設定できます。

### 手動確認

```bash
npm run db:check
```

### 手動バックアップ＋移行

```bash
npm run db:backup
```

### 互換性について

- v1.1.x以前の `games.db` は既存の `users` / `game_logs` データを維持して利用します。
- 不足列がある場合のみ `ALTER TABLE ... ADD COLUMN` で補完します。
- 主キー構造そのものが壊れているDBは自動変換せず停止し、バックアップからの復元を促します。
- `moderation.db` はv1.2.0以降のCase・監査ログDBとして自動生成/更新されます。


## 旧版DB互換性確認

v1.2.2では起動前に既存DBをバックアップし、SQLite整合性を確認したうえで加算型マイグレーションを行います。
`games.db` の既存 `users` / `game_logs` / `fixed_messages` / `welcome_messages` の行数を移行前後で比較し、既存データが減少した場合は起動を停止します。
主キーなど自動変更できない構造差は安全側に倒して停止します。

バックアップは `src/data/backups/` に世代別で保存され、既定で10世代保持します。WAL利用中はチェックポイントを試行し、失敗時には `.db` と `.db-wal` / `.db-shm` をセットで保存します。


## 監査ログの設定

`.env` の `AUDIT_LOG_CHANNEL_ID` に、監査ログを送信したいDiscordチャンネルのIDを設定してください。

```env
AUDIT_LOG_CHANNEL_ID=123456789012345678
```

旧版との互換性のため `MOD_LOG_CHANNEL_ID` / `LOG_CHANNEL_ID` も利用できます。優先順位は `AUDIT_LOG_CHANNEL_ID` → `MOD_LOG_CHANNEL_ID` → `LOG_CHANNEL_ID` です。

Botには対象チャンネルで **View Channel / Send Messages / Embed Links** 権限が必要です。

起動時にコンソールへ `📜 監査ログ送信先:` が表示されれば設定済みです。`/test` でも監査ログ設定を確認できます。

## v1.2.5 - 公開Case履歴
- `/moderation history` を公開表示に変更
- `/moderation case` を公開表示に変更
- Case IDをサーバー内の処罰履歴として他ユーザーも確認可能
- `/moderation search` と `/moderation note` は引き続きモデレーター専用
- 管理者メモは公開Case詳細には表示しない

# mabusaba-game v1.2.7 — Game Bot

ゲーム機能を完全分離した専用Botです。

## 含まれるコマンド
- /game
- /game-logs
- /game-points
- /game-stats
- /profile
- /ranking

`/game` は v1.2.6 のゲーム統合版をそのままGame Bot側で提供します。

## Discordアプリ
Main Botとは**別のDiscord Application / Bot Token / Client ID**を使用してください。
同じGUILD_IDを指定すれば同じサーバーに両方を導入できます。

## DB
ゲームデータは `src/data/games.db` のみで管理します。
Main BotとはSQLite DBを共有しません。

## 起動
cp .env.example .env
npm install
npm run deploy
npm run start

Docker:
docker compose build
docker compose up -d

## 旧DB移行
v1.2.6で使用していた `src/data/games.db` を、このプロジェクトの
`src/data/games.db` にコピーしてください。既存のゲームデータを保持したまま
Game Botとして利用できます。

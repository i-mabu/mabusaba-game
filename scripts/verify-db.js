'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mabusaba-game-verify-'));
process.env.MABUSABA_DATA_DIR = dataDir;
process.env.DB_BACKUP_ON_START = 'false';

const { migrateDatabase } = require('../src/utils/database');
const report = migrateDatabase();
assert.ok(fs.existsSync(path.join(dataDir, 'games.db')), 'ゲームDBを作成すること');
assert.ok(!fs.existsSync(path.join(dataDir, 'moderation.db')), 'モデレーションDBを作成しないこと');
assert.equal(report.afterChecks[0].ok, true, 'ゲームDBの整合性が保たれること');

const {
  getUser,
  recordGame,
  getGameLogs,
  getRanking,
  closeDatabase,
} = require('../src/utils/gameData');

assert.equal(getUser('player-1', 'Player One').points, 100);
assert.equal(recordGame({ userId: 'player-1', username: 'Player One', game: 'dice', result: 'lose', points: -95 }).points, 5);
assert.equal(recordGame({ userId: 'player-1', username: 'Player One', game: 'dice', result: 'lose', points: -5 }).points, 0);
assert.throws(
  () => recordGame({ userId: 'player-1', username: 'Player One', game: 'dice', result: 'lose', points: -5 }),
  /ポイントが不足/, '負残高となる結果を拒否すること'
);
assert.equal(getGameLogs({ userId: 'player-1', limit: 999 }).length, 2, 'ログ上限を安全に処理すること');
assert.equal(getRanking(999).length, 1, 'ランキング上限を安全に処理すること');
closeDatabase();

console.log('✅ Game DB isolation and point-integrity verified');

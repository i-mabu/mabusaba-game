const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILES = ['games.db', 'moderation.db'];
const COMPAT_TABLES = ['users', 'game_logs', 'fixed_messages', 'welcome_messages'];
const RETENTION = Math.max(1, Number(process.env.DB_BACKUP_RETENTION || 10));

const REQUIRED = {
  users: {
    user_id: "TEXT PRIMARY KEY",
    username: "TEXT NOT NULL DEFAULT ''",
    points: 'INTEGER NOT NULL DEFAULT 100',
    games: 'INTEGER NOT NULL DEFAULT 0',
    wins: 'INTEGER NOT NULL DEFAULT 0',
    losses: 'INTEGER NOT NULL DEFAULT 0',
    created_at: 'INTEGER NOT NULL DEFAULT (unixepoch())',
    updated_at: 'INTEGER NOT NULL DEFAULT (unixepoch())',
  },
  game_logs: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    user_id: 'TEXT NOT NULL',
    username: "TEXT NOT NULL DEFAULT ''",
    game: 'TEXT NOT NULL',
    result: 'TEXT NOT NULL',
    points_before: 'INTEGER NOT NULL DEFAULT 0',
    points_change: 'INTEGER NOT NULL DEFAULT 0',
    points_after: 'INTEGER NOT NULL DEFAULT 0',
    created_at: 'INTEGER NOT NULL DEFAULT (unixepoch())',
    metadata: 'TEXT',
  },
};

const MODERATION_REQUIRED = {
  moderation_cases: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT', guild_id: 'TEXT NOT NULL', user_id: 'TEXT NOT NULL',
    user_tag: "TEXT NOT NULL DEFAULT ''", moderator_id: 'TEXT NOT NULL', moderator_tag: "TEXT NOT NULL DEFAULT ''",
    action: 'TEXT NOT NULL', reason: "TEXT NOT NULL DEFAULT '理由なし'", duration: 'INTEGER',
    status: "TEXT NOT NULL DEFAULT 'active'", channel_id: 'TEXT', message_id: 'TEXT',
    created_at: 'INTEGER NOT NULL DEFAULT (unixepoch())', expires_at: 'INTEGER', closed_at: 'INTEGER', metadata: 'TEXT',
  },
  case_notes: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT', case_id: 'INTEGER NOT NULL', author_id: 'TEXT NOT NULL',
    author_tag: "TEXT NOT NULL DEFAULT ''", content: 'TEXT NOT NULL', created_at: 'INTEGER NOT NULL DEFAULT (unixepoch())',
  },
  audit_logs: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT', guild_id: 'TEXT NOT NULL', type: 'TEXT NOT NULL', action: 'TEXT NOT NULL',
    actor_id: 'TEXT', actor_tag: 'TEXT', target_id: 'TEXT', target_tag: 'TEXT', case_id: 'INTEGER', channel_id: 'TEXT',
    message_id: 'TEXT', reason: 'TEXT', data: 'TEXT', created_at: 'INTEGER NOT NULL DEFAULT (unixepoch())',
  },
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function columns(db, table) {
  if (!tableExists(db, table)) return new Set();
  return new Set(db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map(c => c.name));
}

function createTable(db, table, schema) {
  const definitions = Object.entries(schema).map(([name, type]) => `${quoteIdentifier(name)} ${type}`);
  db.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table)} (${definitions.join(', ')})`);
}

function addMissingColumns(db, table, schema) {
  if (!tableExists(db, table)) {
    createTable(db, table, schema);
    return { created: true, added: [] };
  }
  const existing = columns(db, table);
  const added = [];
  for (const [name, type] of Object.entries(schema)) {
    if (existing.has(name)) continue;
    // SQLite cannot safely add a new PRIMARY KEY/AUTOINCREMENT column to an existing table.
    if (/PRIMARY KEY|AUTOINCREMENT/i.test(type)) {
      throw new Error(`既存テーブル ${table} に必須キー列 ${name} がありません。自動変換できないため停止しました。`);
    }
    db.exec(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(name)} ${type}`);
    added.push(name);
  }
  return { created: false, added };
}

function ensureIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_game_logs_user_id ON game_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_logs_game ON game_logs(game);
    CREATE INDEX IF NOT EXISTS idx_game_logs_result ON game_logs(result);
    CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at);
  `);
}

function ensureModerationSchema(db) {
  const changes = {};
  for (const [table, schema] of Object.entries(MODERATION_REQUIRED)) {
    changes[table] = addMissingColumns(db, table, schema);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases(guild_id, user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cases_guild_action ON moderation_cases(guild_id, action, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON moderation_cases(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_case_notes_case ON case_notes(case_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_audit_guild_time ON audit_logs(guild_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_guild_type ON audit_logs(guild_id, type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(guild_id, target_id, created_at DESC);
  `);
  return changes;
}

function migrateGames(db) {
  const changes = {};
  for (const [table, schema] of Object.entries(REQUIRED)) {
    changes[table] = addMissingColumns(db, table, schema);
  }
  ensureIndexes(db);
  return changes;
}

function backupDatabase(filePath, timestamp) {
  if (!fs.existsSync(filePath)) return null;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = path.basename(filePath, '.db');
  const dir = path.join(BACKUP_DIR, timestamp);
  fs.mkdirSync(dir, { recursive: true });

  // SQLiteのWALを使っているDBは、.dbだけをコピーすると
  // 最新トランザクションを失う可能性があるため、可能なら先に
  // WALをチェックポイントしてからDB本体をバックアップする。
  let checkpointed = false;
  try {
    const db = new Database(filePath);
    try {
      db.pragma('busy_timeout = 5000');
      db.pragma('wal_checkpoint(TRUNCATE)');
      checkpointed = true;
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn(`⚠️ ${path.basename(filePath)} のWALチェックポイントに失敗。関連ファイルをそのままバックアップします: ${error.message}`);
  }

  const destination = path.join(dir, `${name}.db`);
  fs.copyFileSync(filePath, destination);

  // チェックポイントできなかった場合はWAL/SHMもセットで保存。
  if (!checkpointed) {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${filePath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${destination}${suffix}`);
    }
  }

  return destination;
}

function backupExistingDatabases(timestamp) {
  const result = [];
  for (const file of DB_FILES) {
    const target = path.join(DATA_DIR, file);
    const backup = backupDatabase(target, timestamp);
    if (backup) result.push(backup);
  }
  return result;
}

function pruneBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const dirs = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();
  for (const dir of dirs.slice(RETENTION)) {
    fs.rmSync(path.join(BACKUP_DIR, dir), { recursive: true, force: true });
  }
}

function integrityCheck(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, ok: true, result: 'new database' };
  const db = new Database(filePath, { readonly: true });
  try {
    const result = db.pragma('integrity_check', { simple: true });
    return { exists: true, ok: result === 'ok', result };
  } finally {
    db.close();
  }
}

function getSchemaSummary(db, tables) {
  const summary = {};
  for (const table of tables) summary[table] = [...columns(db, table)];
  return summary;
}

function tableRowCount(db, table) {
  if (!tableExists(db, table)) return null;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count;
}

function snapshotCounts(db, tables) {
  const result = {};
  for (const table of tables) result[table] = tableRowCount(db, table);
  return result;
}

function verifyCountsUnchanged(before, after, file) {
  for (const [table, count] of Object.entries(before)) {
    if (count === null) continue;
    if (after[table] !== count) {
      throw new Error(`互換性チェック失敗: ${file} の ${table} 件数が ${count} → ${after[table]} に変化しました。`);
    }
  }
}

function migrateDatabase() {
  ensureDir();
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const shouldBackup = String(process.env.DB_BACKUP_ON_START ?? 'true').toLowerCase() !== 'false';
  const backups = shouldBackup ? backupExistingDatabases(timestamp) : [];
  const beforeChecks = DB_FILES.map(file => ({ file, ...integrityCheck(path.join(DATA_DIR, file)) }));

  const broken = beforeChecks.filter(x => x.exists && !x.ok);
  if (broken.length) {
    throw new Error(`SQLite整合性チェック失敗: ${broken.map(x => `${x.file}=${x.result}`).join(', ')}。バックアップは保存済みです。`);
  }

  const compatibility = { gamesBefore: {}, gamesAfter: {}, moderationBefore: {}, moderationAfter: {} };
  const migration = { games: {}, moderation: {} };

  const gamesPath = path.join(DATA_DIR, 'games.db');
  const games = new Database(gamesPath);
  try {
    games.pragma('busy_timeout = 5000');
    games.exec('BEGIN');
    compatibility.gamesBefore = snapshotCounts(games, COMPAT_TABLES);
    migration.games = migrateGames(games);
    compatibility.gamesAfter = snapshotCounts(games, COMPAT_TABLES);
    verifyCountsUnchanged(compatibility.gamesBefore, compatibility.gamesAfter, 'games.db');
    games.exec('COMMIT');
    games.pragma('wal_checkpoint(TRUNCATE)');
  } catch (error) {
    try { games.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    games.close();
  }

  const moderationPath = path.join(DATA_DIR, 'moderation.db');
  const moderation = new Database(moderationPath);
  try {
    moderation.pragma('journal_mode = WAL');
    moderation.pragma('foreign_keys = ON');
    moderation.pragma('busy_timeout = 5000');
    moderation.exec('BEGIN');
    compatibility.moderationBefore = snapshotCounts(moderation, Object.keys(MODERATION_REQUIRED));
    migration.moderation = ensureModerationSchema(moderation);
    moderation.exec(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    moderation.prepare(`INSERT INTO schema_meta(key,value) VALUES('schema_version','2') ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run();
    compatibility.moderationAfter = snapshotCounts(moderation, Object.keys(MODERATION_REQUIRED));
    verifyCountsUnchanged(compatibility.moderationBefore, compatibility.moderationAfter, 'moderation.db');
    moderation.prepare(`INSERT INTO schema_meta(key,value) VALUES('last_migrated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(new Date().toISOString());
    moderation.exec('COMMIT');
    moderation.pragma('wal_checkpoint(TRUNCATE)');
  } catch (error) {
    try { moderation.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    moderation.close();
  }

  pruneBackups();

  const afterChecks = DB_FILES.map(file => ({ file, ...integrityCheck(path.join(DATA_DIR, file)) }));
  const failed = afterChecks.filter(x => !x.ok);
  if (failed.length) throw new Error(`移行後のSQLite整合性チェック失敗: ${failed.map(x => `${x.file}=${x.result}`).join(', ')}`);

  return { timestamp, backups, beforeChecks, afterChecks, migration, compatibility, backupDir: BACKUP_DIR };
}

function printReport(report) {
  console.log('🗄️ DB互換性チェック / 自動移行');
  for (const item of report.beforeChecks) console.log(`  ${item.file}: ${item.exists ? (item.ok ? 'OK' : 'NG') : '新規作成'}`);
  if (report.backups.length) console.log(`  💾 バックアップ: ${report.backups.join(', ')}`);
  for (const [group, changes] of Object.entries(report.migration)) {
    const changed = Object.entries(changes).filter(([, v]) => v.created || v.added?.length);
    if (!changed.length) console.log(`  ✅ ${group}: 既存スキーマ互換`);
    else console.log(`  🔧 ${group}: ${JSON.stringify(changes)}`);
  }
  for (const item of report.afterChecks) console.log(`  ${item.file}: ${item.ok ? '整合性OK' : '整合性NG'}`);
}

if (require.main === module) {
  try {
    printReport(migrateDatabase());
  } catch (error) {
    console.error('❌ DB移行失敗:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DATA_DIR,
  BACKUP_DIR,
  migrateDatabase,
  integrityCheck,
};

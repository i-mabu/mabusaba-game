const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.MABUSABA_DATA_DIR || path.join(__dirname, '../data'));
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const GAME_DB_FILE = 'games.db';
const RETENTION = Math.max(1, Number(process.env.DB_BACKUP_RETENTION || 10));

const GAME_REQUIRED = {
  users: {
    user_id: 'TEXT PRIMARY KEY',
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
  return new Set(db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map(column => column.name));
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
    if (/PRIMARY KEY|AUTOINCREMENT/i.test(type)) {
      throw new Error(`既存テーブル ${table} に必須キー列 ${name} がありません。自動変換できないため停止しました。`);
    }
    db.exec(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(name)} ${type}`);
    added.push(name);
  }
  return { created: false, added };
}

function migrateGames(db) {
  const changes = {};
  for (const [table, schema] of Object.entries(GAME_REQUIRED)) {
    changes[table] = addMissingColumns(db, table, schema);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_game_logs_user_id ON game_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_logs_game ON game_logs(game);
    CREATE INDEX IF NOT EXISTS idx_game_logs_result ON game_logs(result);
    CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at);
  `);
  return changes;
}

function backupDatabase(filePath, timestamp) {
  if (!fs.existsSync(filePath)) return null;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const directory = path.join(BACKUP_DIR, timestamp);
  fs.mkdirSync(directory, { recursive: true });

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
    console.warn(`⚠️ games.db のWALチェックポイントに失敗。関連ファイルをそのままバックアップします: ${error.message}`);
  }

  const destination = path.join(directory, GAME_DB_FILE);
  fs.copyFileSync(filePath, destination);
  if (!checkpointed) {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${filePath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${destination}${suffix}`);
    }
  }
  return destination;
}

function pruneBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const dirs = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
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

function tableRowCount(db, table) {
  if (!tableExists(db, table)) return null;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count;
}

function snapshotCounts(db, tables) {
  return Object.fromEntries(tables.map(table => [table, tableRowCount(db, table)]));
}

function verifyCountsUnchanged(before, after) {
  for (const [table, count] of Object.entries(before)) {
    if (count !== null && after[table] !== count) {
      throw new Error(`互換性チェック失敗: games.db の ${table} 件数が ${count} → ${after[table]} に変化しました。`);
    }
  }
}

function migrateDatabase() {
  ensureDir();
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const filePath = path.join(DATA_DIR, GAME_DB_FILE);
  const shouldBackup = String(process.env.DB_BACKUP_ON_START ?? 'true').toLowerCase() !== 'false';
  const backups = shouldBackup ? [backupDatabase(filePath, timestamp)].filter(Boolean) : [];
  const beforeChecks = [{ file: GAME_DB_FILE, ...integrityCheck(filePath) }];
  if (beforeChecks[0].exists && !beforeChecks[0].ok) {
    throw new Error(`SQLite整合性チェック失敗: games.db=${beforeChecks[0].result}。バックアップは保存済みです。`);
  }

  const db = new Database(filePath);
  let migration;
  let compatibility;
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec('BEGIN');
    const tables = Object.keys(GAME_REQUIRED);
    const before = snapshotCounts(db, tables);
    migration = migrateGames(db);
    const after = snapshotCounts(db, tables);
    verifyCountsUnchanged(before, after);
    compatibility = { before, after };
    db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    db.prepare(`INSERT INTO schema_meta(key,value) VALUES('schema_version','3') ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run();
    db.prepare(`INSERT INTO schema_meta(key,value) VALUES('last_migrated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(new Date().toISOString());
    db.exec('COMMIT');
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    db.close();
  }

  pruneBackups();
  const afterChecks = [{ file: GAME_DB_FILE, ...integrityCheck(filePath) }];
  if (!afterChecks[0].ok) throw new Error(`移行後のSQLite整合性チェック失敗: games.db=${afterChecks[0].result}`);
  return { timestamp, backups, beforeChecks, afterChecks, migration, compatibility, backupDir: BACKUP_DIR };
}

function printReport(report) {
  console.log('🗄️ Game Bot DB移行');
  for (const item of report.beforeChecks) console.log(`  ${item.file}: ${item.exists ? (item.ok ? 'OK' : 'NG') : '新規作成'}`);
  if (report.backups.length) console.log(`  💾 バックアップ: ${report.backups.join(', ')}`);
  const changed = Object.entries(report.migration).filter(([, value]) => value.created || value.added?.length);
  console.log(changed.length ? `  🔧 スキーマ更新: ${JSON.stringify(Object.fromEntries(changed))}` : '  ✅ スキーマ互換');
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

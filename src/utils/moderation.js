const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'moderation.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT NOT NULL DEFAULT '',
    moderator_id TEXT NOT NULL,
    moderator_tag TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '理由なし',
    duration INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    channel_id TEXT,
    message_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,
    closed_at INTEGER,
    metadata TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cases_guild_user
    ON moderation_cases(guild_id, user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cases_guild_action
    ON moderation_cases(guild_id, action, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cases_status
    ON moderation_cases(guild_id, status);

  CREATE TABLE IF NOT EXISTS case_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_tag TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(case_id) REFERENCES moderation_cases(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_case_notes_case
    ON case_notes(case_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_tag TEXT,
    target_id TEXT,
    target_tag TEXT,
    case_id INTEGER,
    channel_id TEXT,
    message_id TEXT,
    reason TEXT,
    data TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_audit_guild_time
    ON audit_logs(guild_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_guild_type
    ON audit_logs(guild_id, type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_target
    ON audit_logs(guild_id, target_id, created_at DESC);
`);

function createCase({
  guildId, userId, userTag = '', moderatorId, moderatorTag = '',
  action, reason = '理由なし', duration = null,
  channelId = null, messageId = null, expiresAt = null, metadata = null
}) {
  if (!guildId || !userId || !moderatorId || !action) {
    throw new Error('guildId, userId, moderatorId, action are required');
  }
  const info = db.prepare(`
    INSERT INTO moderation_cases
    (guild_id,user_id,user_tag,moderator_id,moderator_tag,action,reason,duration,status,channel_id,message_id,expires_at,metadata)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    guildId, userId, userTag, moderatorId, moderatorTag,
    action, reason, duration, 'active', channelId, messageId, expiresAt,
    metadata ? JSON.stringify(metadata) : null
  );
  return getCase(info.lastInsertRowid, guildId);
}

function getCase(id, guildId = null) {
  let sql = 'SELECT * FROM moderation_cases WHERE id = ?';
  const params = [id];
  if (guildId) { sql += ' AND guild_id = ?'; params.push(guildId); }
  const row = db.prepare(sql).get(...params);
  if (!row) return null;
  row.metadata = parseJson(row.metadata);
  row.notes = db.prepare(`
    SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC, id ASC
  `).all(row.id);
  return row;
}

function getUserCases({ guildId, userId, action = null, status = null, limit = 50, offset = 0 }) {
  let sql = 'SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ?';
  const params = [guildId, userId];
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100), Math.max(Number(offset) || 0, 0));
  return db.prepare(sql).all(...params);
}

function countUserCases({ guildId, userId, action = null, status = null }) {
  let sql = 'SELECT COUNT(*) AS count FROM moderation_cases WHERE guild_id = ? AND user_id = ?';
  const params = [guildId, userId];
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  return db.prepare(sql).get(...params).count;
}

function searchCases({ guildId, query, action = null, limit = 50 }) {
  const q = `%${String(query || '').trim()}%`;
  let sql = `
    SELECT * FROM moderation_cases
    WHERE guild_id = ?
      AND (CAST(id AS TEXT) LIKE ? OR user_id LIKE ? OR user_tag LIKE ? OR moderator_tag LIKE ? OR reason LIKE ?)
  `;
  const params = [guildId, q, q, q, q, q];
  if (action) { sql += ' AND action = ?'; params.push(action); }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  return db.prepare(sql).all(...params);
}

function getStats(guildId, userId = null) {
  let where = 'guild_id = ?';
  const params = [guildId];
  if (userId) { where += ' AND user_id = ?'; params.push(userId); }
  const rows = db.prepare(`
    SELECT action, COUNT(*) AS count
    FROM moderation_cases
    WHERE ${where}
    GROUP BY action
    ORDER BY count DESC
  `).all(...params);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM moderation_cases WHERE ${where}`).get(...params).count;
  const active = db.prepare(`SELECT COUNT(*) AS count FROM moderation_cases WHERE ${where} AND status = 'active'`).get(...params).count;
  return { total, active, byAction: rows };
}

function closeCase(id, guildId, status = 'closed') {
  return db.prepare(`
    UPDATE moderation_cases
    SET status = ?, closed_at = unixepoch()
    WHERE id = ? AND guild_id = ?
  `).run(status, id, guildId).changes > 0;
}

function closeLatestActiveCase({ guildId, userId, action }) {
  const row = db.prepare(`
    SELECT id FROM moderation_cases
    WHERE guild_id = ? AND user_id = ? AND action = ? AND status = 'active'
    ORDER BY created_at DESC, id DESC LIMIT 1
  `).get(guildId, userId, action);
  if (!row) return null;
  closeCase(row.id, guildId);
  return row.id;
}

function addCaseNote({ caseId, guildId, authorId, authorTag, content }) {
  const target = getCase(caseId, guildId);
  if (!target) throw new Error('Caseが見つかりません');
  const info = db.prepare(`
    INSERT INTO case_notes (case_id, author_id, author_tag, content)
    VALUES (?, ?, ?, ?)
  `).run(caseId, authorId, authorTag || '', String(content).slice(0, 2000));
  return db.prepare('SELECT * FROM case_notes WHERE id = ?').get(info.lastInsertRowid);
}

function createAuditLog({
  guildId, type, action, actorId = null, actorTag = null,
  targetId = null, targetTag = null, caseId = null,
  channelId = null, messageId = null, reason = null, data = null
}) {
  const info = db.prepare(`
    INSERT INTO audit_logs
    (guild_id,type,action,actor_id,actor_tag,target_id,target_tag,case_id,channel_id,message_id,reason,data)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    guildId, type, action, actorId, actorTag, targetId, targetTag,
    caseId, channelId, messageId, reason, data ? JSON.stringify(data) : null
  );
  return info.lastInsertRowid;
}

function searchAuditLogs({ guildId, type = null, action = null, targetId = null, query = null, limit = 50, offset = 0 }) {
  let sql = 'SELECT * FROM audit_logs WHERE guild_id = ?';
  const params = [guildId];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (targetId) { sql += ' AND target_id = ?'; params.push(targetId); }
  if (query) {
    const q = `%${String(query).trim()}%`;
    sql += ' AND (action LIKE ? OR actor_tag LIKE ? OR target_tag LIKE ? OR reason LIKE ? OR data LIKE ?)';
    params.push(q, q, q, q, q);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100), Math.max(Number(offset) || 0, 0));
  return db.prepare(sql).all(...params);
}

function closeDatabase() {
  if (db.open) db.close();
}

function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

module.exports = {
  createCase, getCase, getUserCases, countUserCases, searchCases, getStats,
  closeCase, closeLatestActiveCase, addCaseNote,
  createAuditLog, searchAuditLogs, closeDatabase
};

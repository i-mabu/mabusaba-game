const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/*
 * =========================================================
 * Database
 * =========================================================
 */

const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}

const dbPath = path.join(
  dataDir,
  'games.db'
);

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

/*
 * =========================================================
 * Table
 * =========================================================
 *
 * content は既存DBで NOT NULL の可能性があるため、
 * DEFAULT '' を設定。
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS fixed_messages (
    guild_id TEXT PRIMARY KEY,

    channel_id TEXT NOT NULL,

    message_id TEXT NOT NULL,

    content TEXT NOT NULL DEFAULT '',

    embed_title TEXT,

    embed_description TEXT,

    embed_color TEXT,

    embed_data TEXT,

    created_by TEXT NOT NULL,

    updated_by TEXT NOT NULL,

    created_at INTEGER NOT NULL
      DEFAULT (unixepoch()),

    updated_at INTEGER NOT NULL
      DEFAULT (unixepoch())
  );
`);

/*
 * =========================================================
 * Migration
 * =========================================================
 */

function getColumns(table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all();
}

function ensureColumn(
  table,
  column,
  definition
) {
  const columns = getColumns(table);

  const exists = columns.some(
    item => item.name === column
  );

  if (!exists) {
    db.exec(`
      ALTER TABLE ${table}
      ADD COLUMN ${column} ${definition}
    `);
  }
}

ensureColumn(
  'fixed_messages',
  'embed_title',
  'TEXT'
);

ensureColumn(
  'fixed_messages',
  'embed_description',
  'TEXT'
);

ensureColumn(
  'fixed_messages',
  'embed_color',
  'TEXT'
);

ensureColumn(
  'fixed_messages',
  'embed_data',
  'TEXT'
);

/*
 * =========================================================
 * Statements
 * =========================================================
 */

const getStmt = db.prepare(`
  SELECT *
  FROM fixed_messages
  WHERE guild_id = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO fixed_messages (
    guild_id,
    channel_id,
    message_id,
    content,
    embed_title,
    embed_description,
    embed_color,
    embed_data,
    created_by,
    updated_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
  UPDATE fixed_messages
  SET
    channel_id = ?,
    message_id = ?,
    content = ?,
    embed_title = ?,
    embed_description = ?,
    embed_color = ?,
    embed_data = ?,
    updated_by = ?,
    updated_at = unixepoch()
  WHERE guild_id = ?
`);

const deleteStmt = db.prepare(`
  DELETE FROM fixed_messages
  WHERE guild_id = ?
`);

/*
 * =========================================================
 * Get
 * =========================================================
 */

function getFixedMessage(guildId) {
  return (
    getStmt.get(guildId) ||
    null
  );
}

/*
 * =========================================================
 * Create
 * =========================================================
 */

function createFixedMessage({
  guildId,
  channelId,
  messageId,
  content = '',
  embed = null,
  userId
}) {
  const existing =
    getFixedMessage(guildId);

  if (existing) {
    throw new Error(
      'このサーバーには既に固定メッセージがあります。'
    );
  }

  /*
   * content は絶対に null にしない
   */
  const safeContent =
    content == null
      ? ''
      : String(content);

  const embedTitle =
    embed?.title ?? null;

  const embedDescription =
    embed?.description ?? null;

  const embedColor =
    embed?.color != null
      ? String(embed.color)
      : null;

  const embedData =
    embed != null
      ? JSON.stringify(embed)
      : null;

  insertStmt.run(
    guildId,
    channelId,
    messageId,
    safeContent,
    embedTitle,
    embedDescription,
    embedColor,
    embedData,
    userId,
    userId
  );

  return getFixedMessage(
    guildId
  );
}

/*
 * =========================================================
 * Update
 * =========================================================
 */

function updateFixedMessage({
  guildId,
  channelId,
  messageId,
  content = '',
  embed = null,
  userId
}) {
  const existing =
    getFixedMessage(guildId);

  if (!existing) {
    throw new Error(
      '固定メッセージが登録されていません。'
    );
  }

  /*
   * content は絶対に null にしない
   */
  const safeContent =
    content == null
      ? ''
      : String(content);

  const embedTitle =
    embed?.title ?? null;

  const embedDescription =
    embed?.description ?? null;

  const embedColor =
    embed?.color != null
      ? String(embed.color)
      : null;

  const embedData =
    embed != null
      ? JSON.stringify(embed)
      : null;

  updateStmt.run(
    channelId,
    messageId,
    safeContent,
    embedTitle,
    embedDescription,
    embedColor,
    embedData,
    userId,
    guildId
  );

  return getFixedMessage(
    guildId
  );
}

/*
 * =========================================================
 * Delete
 * =========================================================
 */

function deleteFixedMessage(
  guildId
) {
  deleteStmt.run(
    guildId
  );
}

/*
 * =========================================================
 * Get Embed
 * =========================================================
 */

function getStoredEmbed(
  fixed
) {
  if (
    !fixed ||
    !fixed.embed_data
  ) {
    return null;
  }

  try {
    return JSON.parse(
      fixed.embed_data
    );
  } catch (error) {
    console.error(
      '❌ embed_data parse error:',
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * Export
 * =========================================================
 */

module.exports = {
  getFixedMessage,
  createFixedMessage,
  updateFixedMessage,
  deleteFixedMessage,
  getStoredEmbed
};
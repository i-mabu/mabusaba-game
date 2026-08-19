const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/*
 * =========================================================
 * Database
 * =========================================================
 */

const dataDir = path.join(
  __dirname,
  '../data'
);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  });
}

const db = new Database(
  path.join(
    dataDir,
    'games.db'
  )
);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

/*
 * =========================================================
 * Table
 * =========================================================
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS welcome_messages (
    guild_id TEXT PRIMARY KEY,

    channel_id TEXT NOT NULL,

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
    .prepare(
      `PRAGMA table_info(${table})`
    )
    .all();
}

function ensureColumn(
  table,
  column,
  definition
) {
  const columns =
    getColumns(table);

  const exists =
    columns.some(
      item =>
        item.name === column
    );

  if (!exists) {
    db.exec(`
      ALTER TABLE ${table}
      ADD COLUMN ${column} ${definition}
    `);
  }
}

ensureColumn(
  'welcome_messages',
  'content',
  "TEXT NOT NULL DEFAULT ''"
);

ensureColumn(
  'welcome_messages',
  'embed_title',
  'TEXT'
);

ensureColumn(
  'welcome_messages',
  'embed_description',
  'TEXT'
);

ensureColumn(
  'welcome_messages',
  'embed_color',
  'TEXT'
);

ensureColumn(
  'welcome_messages',
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
  FROM welcome_messages
  WHERE guild_id = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO welcome_messages (
    guild_id,
    channel_id,
    content,
    embed_title,
    embed_description,
    embed_color,
    embed_data,
    created_by,
    updated_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
  UPDATE welcome_messages
  SET
    channel_id = ?,
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
  DELETE FROM welcome_messages
  WHERE guild_id = ?
`);

/*
 * =========================================================
 * Get
 * =========================================================
 */

function getWelcomeMessage(
  guildId
) {
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

function createWelcomeMessage({
  guildId,
  channelId,
  content = '',
  embed = null,
  userId
}) {
  const existing =
    getWelcomeMessage(
      guildId
    );

  if (existing) {
    throw new Error(
      'このサーバーには既にWelcomeメッセージが設定されています。'
    );
  }

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
    safeContent,
    embedTitle,
    embedDescription,
    embedColor,
    embedData,
    userId,
    userId
  );

  return getWelcomeMessage(
    guildId
  );
}

/*
 * =========================================================
 * Update
 * =========================================================
 */

function updateWelcomeMessage({
  guildId,
  channelId,
  content = '',
  embed = null,
  userId
}) {
  const existing =
    getWelcomeMessage(
      guildId
    );

  if (!existing) {
    throw new Error(
      'Welcomeメッセージが設定されていません。'
    );
  }

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
    safeContent,
    embedTitle,
    embedDescription,
    embedColor,
    embedData,
    userId,
    guildId
  );

  return getWelcomeMessage(
    guildId
  );
}

/*
 * =========================================================
 * Delete
 * =========================================================
 */

function deleteWelcomeMessage(
  guildId
) {
  deleteStmt.run(
    guildId
  );
}

/*
 * =========================================================
 * Embed
 * =========================================================
 */

function getStoredEmbed(
  welcome
) {
  if (
    !welcome ||
    !welcome.embed_data
  ) {
    return null;
  }

  try {
    return JSON.parse(
      welcome.embed_data
    );
  } catch (error) {
    console.error(
      '❌ Welcome embed_data parse error:',
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
  getWelcomeMessage,
  createWelcomeMessage,
  updateWelcomeMessage,
  deleteWelcomeMessage,
  getStoredEmbed
};
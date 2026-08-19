const { sendAuditLog: send } = require('./auditLog');

/*
 * 旧コマンド互換ラッパー。
 * sendAuditLog(guild, { ... }) の形式も引き続き利用できます。
 */
async function sendAuditLog(guild, options = {}) {
  return send({
    guild,
    ...options,
    actor: options.actor || null,
    reason: options.reason || null,
  });
}

module.exports = { sendAuditLog };

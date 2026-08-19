const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { createAuditLog } = require('./moderation');

function getAuditLogChannelId() {
  return process.env.AUDIT_LOG_CHANNEL_ID ||
    process.env.MOD_LOG_CHANNEL_ID ||
    process.env.LOG_CHANNEL_ID ||
    null;
}

async function sendAuditLog({
  guild,
  title = '監査ログ',
  description = '',
  color = 0x5865f2,
  fields = [],
  type = 'SYSTEM',
  action = 'UNKNOWN',
  actor = null,
  target = null,
  caseId = null,
  channel = null,
  message = null,
  reason = null,
  data = null,
} = {}) {
  if (!guild) return false;

  let dbId = null;
  try {
    dbId = createAuditLog({
      guildId: guild.id,
      type,
      action,
      actorId: actor?.id || null,
      actorTag: actor?.tag || actor?.username || null,
      targetId: target?.id || null,
      targetTag: target?.tag || target?.username || null,
      caseId,
      channelId: channel?.id || null,
      messageId: message?.id || null,
      reason,
      data,
    });
  } catch (error) {
    console.error('❌ 監査ログDB保存エラー:', error);
  }

  const channelId = getAuditLogChannelId();
  if (!channelId) return Boolean(dbId);

  try {
    const logChannel = await guild.channels.fetch(channelId);
    if (!logChannel?.isTextBased()) return Boolean(dbId);

    const me = guild.members.me;
    if (me) {
      const permissions = logChannel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions?.has(PermissionFlagsBits.SendMessages) ||
          !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
        return Boolean(dbId);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(String(title).slice(0, 256))
      .setColor(color)
      .setTimestamp();

    if (description) embed.setDescription(String(description).slice(0, 4096));

    const safeFields = Array.isArray(fields) ? fields.filter(f => f?.name && f?.value)
      .slice(0, 25).map(f => ({
        name: String(f.name).slice(0, 256),
        value: String(f.value).slice(0, 1024),
        inline: Boolean(f.inline),
      })) : [];
    if (safeFields.length) embed.addFields(safeFields);

    if (caseId) embed.setFooter({ text: `Case #${caseId} / Audit #${dbId || '?'}` });

    await logChannel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    console.error('❌ 監査ログ送信エラー:', error);
    return Boolean(dbId);
  }
}

async function fetchAuditEntry({ guild, type, targetId, maxAge = 10000 }) {
  try {
    if (!guild) return null;
    const logs = await guild.fetchAuditLogs({ type, limit: 10 });
    const now = Date.now();
    return logs.entries.find(log => {
      if (targetId && log.target?.id !== targetId) return false;
      return now - log.createdTimestamp <= maxAge;
    }) || null;
  } catch (error) {
    console.error('❌ Discord監査ログ取得エラー:', error);
    return null;
  }
}

module.exports = { sendAuditLog, fetchAuditEntry, getAuditLogChannelId };

const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

function getAuditLogChannelId() {
  return process.env.AUDIT_LOG_CHANNEL_ID ||
    process.env.MOD_LOG_CHANNEL_ID ||
    process.env.LOG_CHANNEL_ID ||
    null;
}

async function sendAuditLog({
  guild,
  title = 'ゲームログ',
  description = '',
  color = 0x5865f2,
  fields = [],
  action = 'PLAY',
} = {}) {
  if (!guild) return false;

  const channelId = getAuditLogChannelId();
  if (!channelId) return false;

  try {
    const logChannel = await guild.channels.fetch(channelId);
    if (!logChannel?.isTextBased()) return false;

    const me = guild.members.me;
    if (me) {
      const permissions = logChannel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions?.has(PermissionFlagsBits.SendMessages) ||
          !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
        return false;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(String(title).slice(0, 256))
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: `Game: ${String(action).slice(0, 64)}` });

    if (description) embed.setDescription(String(description).slice(0, 4096));

    const safeFields = Array.isArray(fields) ? fields
      .filter(field => field?.name && field?.value)
      .slice(0, 25)
      .map(field => ({
        name: String(field.name).slice(0, 256),
        value: String(field.value).slice(0, 1024),
        inline: Boolean(field.inline),
      })) : [];
    if (safeFields.length) embed.addFields(safeFields);

    await logChannel.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    console.error('❌ ゲームログ送信エラー:', error);
    return false;
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

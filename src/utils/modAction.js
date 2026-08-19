const { createCase, closeCase, closeLatestActiveCase } = require('./moderation');
const { sendAuditLog } = require('./auditLog');

async function recordModeration({
  interaction, user, action, reason = '理由なし',
  duration = null, expiresAt = null, status = 'active',
  title, color, description, data = null
}) {
  const caseRow = createCase({
    guildId: interaction.guild.id,
    userId: user.id,
    userTag: user.tag || user.username,
    moderatorId: interaction.user.id,
    moderatorTag: interaction.user.tag || interaction.user.username,
    action, reason, duration, expiresAt,
    channelId: interaction.channelId,
    messageId: interaction.id,
    metadata: data,
  });
  if (status !== 'active') closeCase(caseRow.id, interaction.guild.id, status);

  await sendAuditLog({
    guild: interaction.guild,
    title,
    description,
    color,
    type: 'MODERATION',
    action,
    actor: interaction.user,
    target: user,
    caseId: caseRow.id,
    channel: interaction.channel,
    reason,
    data: { ...(data || {}), duration, status },
  });
  return caseRow;
}

async function closeLatestTimeout({ interaction, user, reason = 'Timeout解除' }) {
  const caseId = closeLatestActiveCase({
    guildId: interaction.guild.id,
    userId: user.id,
    action: 'TIMEOUT',
  });
  await sendAuditLog({
    guild: interaction.guild,
    title: '🔊 Timeout解除',
    color: 0x57f287,
    type: 'MODERATION',
    action: 'UNTIMEOUT',
    actor: interaction.user,
    target: user,
    caseId,
    channel: interaction.channel,
    reason,
  });
  return caseId;
}

module.exports = { recordModeration, closeLatestTimeout };

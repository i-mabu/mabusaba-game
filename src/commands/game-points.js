const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getUser,
  adjustPoints
} = require('../utils/gameData');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-points')
    .setDescription(
      'ユーザーのゲームポイントを変更します'
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription(
          '対象ユーザー'
        )
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription(
          '変更するポイント（マイナス可）'
        )
        .setRequired(true)
        .setMinValue(-1000000)
        .setMaxValue(1000000)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription(
          '変更理由'
        )
        .setRequired(true)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    if (
      !interaction.memberPermissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {
      return interaction.reply({
        content:
          '❌ このコマンドはサーバー管理権限が必要です。',
        ephemeral: true
      });
    }

    const target =
      interaction.options.getUser(
        'user'
      );

    const amount =
      interaction.options.getInteger(
        'amount'
      );

    const reason =
      interaction.options.getString(
        'reason'
      );

    const before =
      getUser(
        target.id,
        target.username
      );

    const after =
      adjustPoints({
        userId:
          target.id,

        username:
          target.username,

        amount,

        reason,

        executorId:
          interaction.user.id,

        executorName:
          interaction.user.username
      });

    const embed =
      new EmbedBuilder()
        .setTitle(
          '💰 ポイント変更'
        )
        .addFields(
          {
            name:
              '対象ユーザー',
            value:
              `${target}`,
            inline: true
          },
          {
            name:
              '変更前',
            value:
              `${before.points}pt`,
            inline: true
          },
          {
            name:
              '変更量',
            value:
              formatPoints(amount),
            inline: true
          },
          {
            name:
              '変更後',
            value:
              `${after.points}pt`,
            inline: true
          },
          {
            name:
              '理由',
            value:
              reason
          },
          {
            name:
              '実行者',
            value:
              `${interaction.user}`
          }
        )
        .setColor(
          amount >= 0
            ? 0x00ff00
            : 0xff0000
        )
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

function formatPoints(amount) {
  if (amount > 0) {
    return `+${amount}pt`;
  }

  return `${amount}pt`;
}
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGameLogs
} = require('../utils/gameData');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-logs')
    .setDescription(
      'ゲームの監査ログを確認します'
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription(
          '調査対象ユーザー'
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('game')
        .setDescription(
          'ゲームを指定'
        )
        .setRequired(false)
        .addChoices(
          {
            name:
              '🎲 サイコロ',
            value:
              'dice'
          },
          {
            name:
              '🪙 コイントス',
            value:
              'coin'
          },
          {
            name:
              '✊ じゃんけん',
            value:
              'rps'
          },
          {
            name:
              '🎯 HIGH & LOW',
            value:
              'highlow'
          },
          {
            name:
              '🎰 スロット',
            value:
              'slots'
          },
          {
            name:
              '🃏 ブラックジャック',
            value:
              'blackjack'
          },
          {
            name:
              '🎯 ルーレット',
            value:
              'roulette'
          },
          {
            name:
              '❓ クイズ',
            value:
              'quiz'
          },
          {
            name:
              '🔢 数字当て',
            value:
              'numberguess'
          },
          {
            name:
              '⚙️ システム',
            value:
              'system'
          }
        )
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

    const user =
      interaction.options.getUser(
        'user'
      );

    const game =
      interaction.options.getString(
        'game'
      );

    const logs =
      getGameLogs({
        userId:
          user?.id || null,

        game:
          game || null,

        limit: 20
      });

    if (logs.length === 0) {
      return interaction.reply({
        content:
          '🔎 該当するゲーム履歴はありません。',
        ephemeral: true
      });
    }

    const lines =
      logs.map(log => {
        const date =
          new Date(
            log.created_at * 1000
          );

        const sign =
          log.points_change >= 0
            ? '+'
            : '';

        return (
          `**#${log.id}** ${formatDate(date)}\n` +
          `👤 ${log.username} \`${log.user_id}\`\n` +
          `🎮 ${getGameName(log.game)} — ${log.result}\n` +
          `💰 ${log.points_before}pt → **${log.points_after}pt** ` +
          `(${sign}${log.points_change}pt)`
        );
      });

    const embed =
      new EmbedBuilder()
        .setTitle(
          '🔎 ゲーム監査ログ'
        )
        .setDescription(
          lines.join('\n\n')
        )
        .setColor(0xfee75c)
        .setFooter({
          text:
            '最新20件を表示しています'
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

function getGameName(game) {
  const names = {
    dice:
      '🎲 サイコロ',

    coin:
      '🪙 コイントス',

    rps:
      '✊ じゃんけん',

    highlow:
      '🎯 HIGH & LOW',

    slots:
      '🎰 スロット',

    system:
      '⚙️ システム'
  };

  return names[game] || game;
}

function formatDate(date) {
  return date.toLocaleString(
    'ja-JP',
    {
      timeZone:
        'Asia/Tokyo',

      year:
        'numeric',

      month:
        '2-digit',

      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      second:
        '2-digit'
    }
  );
}
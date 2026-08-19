const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  getGameStats,
  getGlobalStats
} = require('../utils/gameData');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-stats')
    .setDescription(
      'ミニゲームの統計情報を表示します'
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
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

    const global =
      getGlobalStats();

    const stats =
      getGameStats();

    const embed =
      new EmbedBuilder()
        .setTitle(
          '📊 まぶ鯖ゲーム統計'
        )
        .addFields({
          name: '🌐 全体',
          value:
            `ゲーム数: **${global.games}**\n` +
            `参加人数: **${global.users}**\n` +
            `総ポイント変動: **${formatPoints(global.points)}**`
        })
        .setColor(0x5865f2)
        .setTimestamp();

    if (stats.length > 0) {
      embed.addFields({
        name:
          '🎮 ゲーム別',
        value:
          stats
            .map(stat =>
              `**${getGameName(stat.game)}**\n` +
              `プレイ: ${stat.games}回 / ` +
              `勝利: ${stat.wins}回 / ` +
              `敗北: ${stat.losses}回 / ` +
              `ポイント: ${formatPoints(stat.points)}`
            )
            .join('\n\n')
      });
    } else {
      embed.addFields({
        name:
          '🎮 ゲーム別',
        value:
          'まだゲーム履歴がありません。'
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

function getGameName(game) {
  const names = {
    blackjack: '🃏 ブラックジャック',
    roulette: '🎯 ルーレット',
    quiz: '❓ クイズ',
    numberguess: '🔢 数字当て',
    dice:
      '🎲 サイコロ',

    coin:
      '🪙 コイントス',

    rps:
      '✊ じゃんけん',

    highlow:
      '🎯 HIGH & LOW',

    slots:
      '🎰 スロット'
  };

  return names[game] || game;
}

function formatPoints(points) {
  if (points > 0) {
    return `+${points}pt`;
  }

  return `${points}pt`;
}
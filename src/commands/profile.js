const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const {
  getUser,
} = require('../utils/gameData');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('ゲームプロフィールを表示します')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('対象ユーザー')
    ),

  async execute(interaction) {
    const user =
      interaction.options.getUser('user') ||
      interaction.user;

    const data =
      getUser(
        user.id,
        user.username
      );

    const winRate =
      data.games > 0
        ? (
            (data.wins / data.games) *
            100
          ).toFixed(1)
        : '0.0';

    const embed =
      new EmbedBuilder()
        .setTitle(
          `👤 ${user.username} のゲームプロフィール`
        )
        .setThumbnail(
          user.displayAvatarURL()
        )
        .addFields(
          {
            name: '💰 ポイント',
            value:
              `${data.points}pt`,
            inline: true,
          },
          {
            name: '🎮 プレイ回数',
            value:
              `${data.games}回`,
            inline: true,
          },
          {
            name: '🏆 勝利',
            value:
              `${data.wins}回`,
            inline: true,
          },
          {
            name: '💀 敗北',
            value:
              `${data.losses}回`,
            inline: true,
          },
          {
            name: '📈 勝率',
            value:
              `${winRate}%`,
            inline: true,
          }
        )
        .setColor(0x5865f2)
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  },
};
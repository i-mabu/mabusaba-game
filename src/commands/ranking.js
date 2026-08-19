const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const {
  getRanking,
} = require('../utils/gameData');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('ゲームポイントランキングを表示します'),

  async execute(interaction) {
    const ranking = getRanking(10);

    if (ranking.length === 0) {
      return interaction.reply({
        content:
          '📊 まだランキングデータがありません。',
      });
    }

    const lines = [];

    for (
      let i = 0;
      i < ranking.length;
      i++
    ) {
      const user = ranking[i];

      let medal;

      if (i === 0) {
        medal = '🥇';
      } else if (i === 1) {
        medal = '🥈';
      } else if (i === 2) {
        medal = '🥉';
      } else {
        medal = `${i + 1}.`;
      }

      lines.push(
        `${medal} **${user.username || user.id}** — ${user.points}pt`
      );
    }

    const embed =
      new EmbedBuilder()
        .setTitle(
          '🏆 まぶ鯖ゲームランキング'
        )
        .setDescription(
          lines.join('\n')
        )
        .setColor(0xffd700)
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  },
};
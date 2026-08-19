const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  getUser,
  recordGame
} = require('../utils/gameData');

const {
  getGamePoints
} = require('../utils/gamePoints');

const {
  playDice
} = require('../games/dice');

const {
  playCoin
} = require('../games/coin');

const {
  playRps
} = require('../games/rps');

const {
  playHighLow
} = require('../games/highlow');

const {
  playSlots
} = require('../games/slots');

const { start: bjStart, hit: bjHit, result: bjResult } = require('../games/blackjack');
const { spin: rouletteSpin } = require('../games/roulette');
const { random: quizRandom } = require('../games/quiz');
const { start: numberGuessStart } = require('../games/numberGuess');
const { finishGame } = require('../utils/gameManager');
const extendedSessions = new Map();


module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('まぶ鯖ミニゲーム（通常＋拡張）')
    .setDMPermission(false),

  async execute(interaction) {
    const user =
      getUser(
        interaction.user.id,
        interaction.user.username
      );

    await interaction.reply({
      embeds: [
        createMenuEmbed(
          user.points
        )
      ],
      components:
        createMenuRows()
    });

    const message =
      await interaction.fetchReply();

    const collector =
      message.createMessageComponentCollector({
        time: 120000,

        filter: button => {
          return (
            button.user.id ===
            interaction.user.id
          );
        }
      });

    collector.on(
      'collect',
      async button => {
        try {
          /*
           * 他人による操作
           */
          if (
            button.user.id !==
            interaction.user.id
          ) {
            await button.reply({
              content:
                '❌ このゲームを開始したユーザー以外は操作できません。',
              ephemeral: true
            });

            return;
          }

          /*
           * ========================
           * 拡張ゲーム
           * ========================
           */
          if (button.customId.startsWith('game_extended_')) {
            const game = button.customId.replace('game_extended_', '');
            if (['blackjack', 'roulette', 'quiz', 'numberguess'].includes(game)) {
              return startExtendedGameFromButton(button, game);
            }
          }

          /*
           * ========================
           * ゲーム選択に戻る
           * ========================
           */
          if (
            button.customId ===
            'game_back'
          ) {
            const current =
              getUser(
                interaction.user.id,
                interaction.user.username
              );

            await button.update({
              embeds: [
                createMenuEmbed(
                  current.points
                )
              ],
              components:
                createMenuRows()
            });

            return;
          }

          /*
           * ========================
           * サイコロ
           * ========================
           */
          if (
            button.customId ===
            'game_dice'
          ) {
            const game =
              playDice();

            const points =
              getGamePoints(
                'dice',
                game.result
              );

            const data =
              recordGame({
                userId:
                  interaction.user.id,

                username:
                  interaction.user.username,

                game:
                  'dice',

                result:
                  game.result,

                points,

                metadata: {
                  player:
                    game.player,

                  bot:
                    game.bot
                }
              });

            let text;

            if (
              game.result ===
              'win'
            ) {
              text =
                '🎉 あなたの勝ち！';
            } else if (
              game.result ===
              'lose'
            ) {
              text =
                '😢 あなたの負け…';
            } else {
              text =
                '🤝 引き分け！';
            }

            const embed =
              new EmbedBuilder()
                .setTitle(
                  '🎲 サイコロ'
                )
                .setDescription(
                  text
                )
                .addFields(
                  {
                    name:
                      'あなた',
                    value:
                      `🎲 ${game.player}`,
                    inline: true
                  },
                  {
                    name:
                      'Bot',
                    value:
                      `🎲 ${game.bot}`,
                    inline: true
                  },
                  {
                    name:
                      'ポイント変動',
                    value:
                      formatPoints(
                        points
                      ),
                    inline: true
                  },
                  {
                    name:
                      '所持ポイント',
                    value:
                      `${data.points}pt`
                  }
                )
                .setColor(
                  getResultColor(
                    game.result
                  )
                );

            await button.update({
              embeds: [embed],
              components: [
                createBackButton()
              ]
            });

            return;
          }

          /*
           * ========================
           * コイントス
           * ========================
           *
           * コイントスは
           * 「結果を出すだけ」のゲームなので
           * 今回は引き分け扱い。
           *
           * 勝敗を選択する方式に変更する場合は
           * ここを変更可能。
           */
          if (
            button.customId ===
            'game_coin'
          ) {
            const result =
              playCoin();

            const points =
              getGamePoints(
                'coin',
                'draw'
              );

            const data =
              recordGame({
                userId:
                  interaction.user.id,

                username:
                  interaction.user.username,

                game:
                  'coin',

                result:
                  'draw',

                points,

                metadata: {
                  result
                }
              });

            const embed =
              new EmbedBuilder()
                .setTitle(
                  '🪙 コイントス'
                )
                .setDescription(
                  `コインの結果は……\n\n# ${result}！`
                )
                .addFields({
                  name:
                    'ポイント変動',
                  value:
                    formatPoints(
                      points
                    ),
                  inline: true
                }, {
                  name:
                    '所持ポイント',
                  value:
                    `${data.points}pt`,
                  inline: true
                })
                .setColor(
                  0xf1c40f
                );

            await button.update({
              embeds: [embed],
              components: [
                createBackButton()
              ]
            });

            return;
          }

          /*
           * ========================
           * じゃんけん
           * ========================
           */
          if (
            button.customId ===
            'game_rps'
          ) {
            const row =
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      'rps_rock'
                    )
                    .setLabel(
                      'グー'
                    )
                    .setEmoji(
                      '✊'
                    )
                    .setStyle(
                      ButtonStyle.Primary
                    ),

                  new ButtonBuilder()
                    .setCustomId(
                      'rps_paper'
                    )
                    .setLabel(
                      'パー'
                    )
                    .setEmoji(
                      '✋'
                    )
                    .setStyle(
                      ButtonStyle.Primary
                    ),

                  new ButtonBuilder()
                    .setCustomId(
                      'rps_scissors'
                    )
                    .setLabel(
                      'チョキ'
                    )
                    .setEmoji(
                      '✌️'
                    )
                    .setStyle(
                      ButtonStyle.Primary
                    )
                );

            await button.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle(
                    '✊ じゃんけん'
                  )
                  .setDescription(
                    '手を選んでください！'
                  )
                  .setColor(
                    0x5865f2
                  )
              ],
              components: [row]
            });

            return;
          }

          /*
           * ========================
           * じゃんけん結果
           * ========================
           */
          if (
            button.customId.startsWith(
              'rps_'
            )
          ) {
            const choice =
              button.customId.replace(
                'rps_',
                ''
              );

            const game =
              playRps(
                choice
              );

            const points =
              getGamePoints(
                'rps',
                game.result
              );

            const data =
              recordGame({
                userId:
                  interaction.user.id,

                username:
                  interaction.user.username,

                game:
                  'rps',

                result:
                  game.result,

                points,

                metadata: {
                  player:
                    game.player,

                  bot:
                    game.bot,

                  playerName:
                    game.playerName,

                  botName:
                    game.botName
                }
              });

            let text;

            if (
              game.result ===
              'win'
            ) {
              text =
                '🎉 勝ち！';
            } else if (
              game.result ===
              'lose'
            ) {
              text =
                '😢 負け…';
            } else {
              text =
                '🤝 引き分け！';
            }

            const embed =
              new EmbedBuilder()
                .setTitle(
                  '✊ じゃんけん結果'
                )
                .setDescription(
                  text
                )
                .addFields(
                  {
                    name:
                      'あなた',
                    value:
                      game.playerName,
                    inline: true
                  },
                  {
                    name:
                      'Bot',
                    value:
                      game.botName,
                    inline: true
                  },
                  {
                    name:
                      'ポイント変動',
                    value:
                      formatPoints(
                        points
                      ),
                    inline: true
                  },
                  {
                    name:
                      '所持ポイント',
                    value:
                      `${data.points}pt`
                  }
                )
                .setColor(
                  getResultColor(
                    game.result
                  )
                );

            await button.update({
              embeds: [embed],
              components: [
                createBackButton()
              ]
            });

            return;
          }

          /*
           * ========================
           * HIGH
           * ========================
           */
          if (
            button.customId ===
            'game_high'
          ) {
            await playHighLowGame(
              button,
              'high',
              interaction
            );

            return;
          }

          /*
           * ========================
           * LOW
           * ========================
           */
          if (
            button.customId ===
            'game_low'
          ) {
            await playHighLowGame(
              button,
              'low',
              interaction
            );

            return;
          }

          /*
           * ========================
           * スロット
           * ========================
           */
          if (
            button.customId ===
            'game_slots'
          ) {
            const game =
              playSlots();

            let result;
            let text;

            if (
              game.outcome ===
              'jackpot'
            ) {
              result =
                'jackpot';

              text =
                '🎉🎉 JACKPOT!! 🎉🎉';
            } else if (
              game.outcome ===
              'win'
            ) {
              result =
                'win';

              text =
                '🎉 当たり！';
            } else {
              result =
                'lose';

              text =
                '😢 ハズレ…';
            }

            const points =
              getGamePoints(
                'slots',
                result
              );

            const data =
              recordGame({
                userId:
                  interaction.user.id,

                username:
                  interaction.user.username,

                game:
                  'slots',

                result,

                points,

                metadata: {
                  slots:
                    game.result,

                  outcome:
                    game.outcome
                }
              });

            const embed =
              new EmbedBuilder()
                .setTitle(
                  '🎰 スロット'
                )
                .setDescription(
                  `# ${game.result.join(' | ')}\n\n${text}`
                )
                .addFields(
                  {
                    name:
                      'ポイント変動',
                    value:
                      formatPoints(
                        points
                      ),
                    inline: true
                  },
                  {
                    name:
                      '所持ポイント',
                    value:
                      `${data.points}pt`,
                    inline: true
                  }
                )
                .setColor(
                  result ===
                    'jackpot'
                    ? 0xffd700
                    : result ===
                        'win'
                      ? 0x00ff00
                      : 0xff0000
                );

            await button.update({
              embeds: [embed],
              components: [
                createBackButton()
              ]
            });

            return;
          }
        } catch (error) {
          console.error(
            '❌ Game Button Error:',
            error
          );

          if (
            !button.replied &&
            !button.deferred
          ) {
            await button.reply({
              content:
                '❌ ゲーム処理中にエラーが発生しました。',
              ephemeral: true
            }).catch(
              () => {}
            );
          }
        }
      }
    );

    /*
     * Collector終了時には
     * メッセージを変更しない。
     */
    collector.on(
      'end',
      () => {
        console.log(
          `🎮 Game collector終了: ${interaction.user.tag}`
        );
      }
    );
  },

  

async handleButton(interaction) {
    const state = extendedSessions.get(interaction.message.id);
    if (!state || !interaction.customId.startsWith('gameplus:')) return false;
    if (interaction.user.id !== state.userId) {
      await interaction.reply({ content: '❌ このゲームを開始したユーザー以外は操作できません。', ephemeral: true });
      return true;
    }
    const action = interaction.customId.split(':')[1];
    try {
      if (state.game === 'blackjack') {
        if (action === 'hit') {
          bjHit(state.data);
          if (state.data.total > 21) {
            const r = await finishGame({ interaction, game: 'blackjack', result: 'lose', metadata: { player: state.data.player, dealer: state.data.dealer } });
            return finishExtendedGame(interaction, state, `💥 バースト！合計 **${state.data.total}**`, 'lose', r);
          }
          return renderExtendedGame(interaction, state);
        }
        if (action === 'stand') {
          const result = bjResult(state.data);
          const r = await finishGame({ interaction, game: 'blackjack', result, metadata: { player: state.data.player, dealer: state.data.dealer } });
          return finishExtendedGame(interaction, state, `結果：あなた **${state.data.total}** / Dealer **${state.data.dealerTotal}**`, result, r);
        }
      }
      if (state.game === 'roulette' && ['red','black','green'].includes(action)) {
        const spin = rouletteSpin(); const result = spin.color === action ? 'win' : 'lose';
        const r = await finishGame({ interaction, game: 'roulette', result, metadata: { choice: action, number: spin.number, color: spin.color } });
        return finishExtendedGame(interaction, state, `出目：**${spin.number} ${spin.color}**\nあなたの選択：**${action}**`, result, r);
      }
      if (state.game === 'quiz') {
        const index = Number(action); const correct = index === state.data.correct; const result = correct ? 'win' : 'lose';
        const r = await finishGame({ interaction, game: 'quiz', result, metadata: { question: state.data.q, choice: index, correct: state.data.correct } });
        return finishExtendedGame(interaction, state, `${correct ? '🎉 正解！' : '❌ 不正解…'}\n正解：**${state.data.a[state.data.correct]}**`, result, r);
      }
      if (state.game === 'numberguess') {
        const number = Number(action); if (![1,2,3,4,5,6].includes(number)) return true;
        state.data.tries++;
        if (number === state.data.answer) {
          const r = await finishGame({ interaction, game: 'numberguess', result: 'win', metadata: { answer: state.data.answer, tries: state.data.tries } });
          return finishExtendedGame(interaction, state, `🎯 正解！答えは **${state.data.answer}** でした。`, 'win', r);
        }
        if (state.data.tries >= 3) {
          const r = await finishGame({ interaction, game: 'numberguess', result: 'lose', metadata: { answer: state.data.answer, tries: state.data.tries } });
          return finishExtendedGame(interaction, state, `💥 3回使い切りました。答えは **${state.data.answer}** でした。`, 'lose', r);
        }
        const hint = number < state.data.answer ? '⬆️ もっと大きい' : '⬇️ もっと小さい';
        await interaction.update({ embeds: [createExtendedEmbed(state).setDescription(`${hint}\n残り **${3-state.data.tries}回**`)], components: [createNumberGuessRow()] });
        return true;
      }
    } catch (error) {
      console.error('❌ /game 拡張ゲーム処理:', error);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ ゲーム処理中にエラーが発生しました。', ephemeral: true });
    }
    return true;
  }

};


function extendedGameName(game) {
  return { blackjack: 'ブラックジャック', roulette: 'ルーレット', quiz: 'クイズ', numberguess: '数字当て' }[game] || game;
}

async function startExtendedGameFromButton(button, game) {
  const state = { game, userId: button.user.id };
  if (game === 'blackjack') state.data = bjStart();
  if (game === 'quiz') state.data = quizRandom();
  if (game === 'numberguess') state.data = numberGuessStart();
  extendedSessions.set(button.message.id, state);
  const payload = createExtendedPayload(state);
  await button.update(payload);
  setTimeout(() => { if (extendedSessions.get(button.message.id) === state) extendedSessions.delete(button.message.id); }, 120000);
  return true;
}

function createExtendedPayload(state) {
  const embed = createExtendedEmbed(state);
  let row;
  if (state.game === 'blackjack') {
    embed.setDescription(`あなた：**${state.data.player.join(' / ')}** = **${state.data.total}**\nDealer：**${state.data.dealer[0]} / ?**\n\nヒットするかスタンドしてください。`);
    row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gameplus:hit').setLabel('Hit').setEmoji('🃏').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('gameplus:stand').setLabel('Stand').setEmoji('✋').setStyle(ButtonStyle.Success));
  } else if (state.game === 'roulette') {
    embed.setDescription('色を選んでルーレットを回します。');
    row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gameplus:red').setLabel('赤').setEmoji('🔴').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('gameplus:black').setLabel('黒').setEmoji('⚫').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('gameplus:green').setLabel('緑').setEmoji('🟢').setStyle(ButtonStyle.Success));
  } else if (state.game === 'quiz') {
    embed.setDescription(`❓ ${state.data.q}`);
    row = new ActionRowBuilder().addComponents(state.data.a.map((a,i) => new ButtonBuilder().setCustomId(`gameplus:${i}`).setLabel(a.slice(0,80)).setStyle(ButtonStyle.Primary)));
  } else {
    embed.setDescription('1〜6から数字を選んでください。残り3回。');
    row = createNumberGuessRow();
  }
  return { embeds: [embed], components: [row] };
}

async function startExtendedGame(interaction, game) {
  const state = { game, userId: interaction.user.id };
  if (game === 'blackjack') state.data = bjStart();
  if (game === 'quiz') state.data = quizRandom();
  if (game === 'numberguess') state.data = numberGuessStart();
  await interaction.reply({ embeds: [createExtendedEmbed(state).setDescription('ゲームを開始します。')], components: [] });
  const message = await interaction.fetchReply();
  extendedSessions.set(message.id, state);
  await renderExtendedGame(interaction, state);
  setTimeout(() => { if (extendedSessions.get(message.id) === state) extendedSessions.delete(message.id); }, 120000);
}

function createExtendedEmbed(state) { return new EmbedBuilder().setTitle(`🎮 ${extendedGameName(state.game)}`).setColor(0x5865f2); }

async function renderExtendedGame(interaction, state) {
  await interaction.update(createExtendedPayload(state));
}

function createNumberGuessRow() { return new ActionRowBuilder().addComponents([1,2,3,4,5,6].map(n => new ButtonBuilder().setCustomId(`gameplus:${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary))); }

async function finishExtendedGame(interaction, state, text, result, record) {
  extendedSessions.delete(interaction.message.id);
  const icon = result === 'win' ? '🎉' : result === 'lose' ? '😢' : '🤝';
  const points = record.points >= 0 ? `+${record.points}pt` : `${record.points}pt`;
  const embed = createExtendedEmbed(state).setDescription(`${text}\n\n${icon} **${result.toUpperCase()}**`).addFields({ name: 'ポイント変動', value: points, inline: true }, { name: '所持ポイント', value: `${record.data.points}pt`, inline: true }).setTimestamp();
  await interaction.update({ embeds: [embed], components: [] });
  return true;
}
/*
 * ==========================
 * HIGH / LOW
 * ==========================
 */
async function playHighLowGame(
  button,
  choice,
  interaction
) {
  const game =
    playHighLow(
      choice
    );

  const points =
    getGamePoints(
      'highlow',
      game.result
    );

  const data =
    recordGame({
      userId:
        interaction.user.id,

      username:
        interaction.user.username,

      game:
        'highlow',

      result:
        game.result,

      points,

      metadata: {
        choice,

        first:
          game.first,

        second:
          game.second
      }
    });

  let text;

  if (
    game.result ===
    'win'
  ) {
    text =
      '🎉 予想的中！';
  } else if (
    game.result ===
    'lose'
  ) {
    text =
      '😢 予想失敗…';
  } else {
    text =
      '🤝 同じ数字でした！';
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        '🎯 HIGH & LOW'
      )
      .setDescription(
        text
      )
      .addFields(
        {
          name:
            '最初のカード',
          value:
            `🃏 ${game.first}`,
          inline: true
        },
        {
          name:
            'あなたの予想',
          value:
            choice === 'high'
              ? '⬆️ HIGH'
              : '⬇️ LOW',
          inline: true
        },
        {
          name:
            '次のカード',
          value:
            `🃏 ${game.second}`,
          inline: true
        },
        {
          name:
            'ポイント変動',
          value:
            formatPoints(
              points
            ),
          inline: true
        },
        {
          name:
            '所持ポイント',
          value:
            `${data.points}pt`,
          inline: true
        }
      )
      .setColor(
        getResultColor(
          game.result
        )
      );

  await button.update({
    embeds: [embed],
    components: [
      createBackButton()
    ]
  });
}

/*
 * ==========================
 * メニューEmbed
 * ==========================
 */
function createMenuEmbed(
  points
) {
  return new EmbedBuilder()
    .setTitle(
      '🎮 まぶ鯖ミニゲーム'
    )
    .setDescription(
      '遊びたいゲームを選択してください！\n\n' +
      `💰 所持ポイント: **${points}pt**`
    )
    .addFields({
      name:
        '🎲 ゲーム一覧',
      value:
        '🎲 サイコロ　+10 / -5\n' +
        '🪙 コイントス　0pt\n' +
        '✊ じゃんけん　+15 / -5\n' +
        '🎯 HIGH & LOW　+20 / -5\n' +
        '🎰 スロット　+15 / -5\n' +
        '🎰 JACKPOT　+50\n\n' +
        '✨ 拡張ゲーム: Blackjack / Roulette / Quiz / 数字当て'
    })
    .setColor(
      0x5865f2
    );
}

/*
 * ==========================
 * メニューボタン
 * ==========================
 */
function createMenuRows() {
  const row1 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'game_dice'
          )
          .setLabel(
            'サイコロ'
          )
          .setEmoji(
            '🎲'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'game_coin'
          )
          .setLabel(
            'コイン'
          )
          .setEmoji(
            '🪙'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'game_rps'
          )
          .setLabel(
            'じゃんけん'
          )
          .setEmoji(
            '✊'
          )
          .setStyle(
            ButtonStyle.Success
          )
      );

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'game_high'
          )
          .setLabel(
            'HIGH'
          )
          .setEmoji(
            '⬆️'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'game_low'
          )
          .setLabel(
            'LOW'
          )
          .setEmoji(
            '⬇️'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'game_slots'
          )
          .setLabel(
            'スロット'
          )
          .setEmoji(
            '🎰'
          )
          .setStyle(
            ButtonStyle.Danger
          )
      );

  const row3 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('game_extended_blackjack').setLabel('Blackjack').setEmoji('🃏').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('game_extended_roulette').setLabel('Roulette').setEmoji('🎯').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('game_extended_quiz').setLabel('Quiz').setEmoji('❓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('game_extended_numberguess').setLabel('数字当て').setEmoji('🔢').setStyle(ButtonStyle.Secondary)
      );

  return [
    row1,
    row2,
    row3
  ];
}

/*
 * ==========================
 * 戻るボタン
 * ==========================
 */
function createBackButton() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'game_back'
        )
        .setLabel(
          'ゲーム選択に戻る'
        )
        .setEmoji(
          '🎮'
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

/*
 * ==========================
 * ポイント表示
 * ==========================
 */
function formatPoints(
  points
) {
  if (points > 0) {
    return `📈 +${points}pt`;
  }

  if (points < 0) {
    return `📉 ${points}pt`;
  }

  return '➖ 0pt';
}

/*
 * ==========================
 * 結果色
 * ==========================
 */
function getResultColor(
  result
) {
  if (
    result === 'win' ||
    result === 'jackpot'
  ) {
    return 0x00ff00;
  }

  if (
    result === 'lose'
  ) {
    return 0xff0000;
  }

  return 0xffff00;
}
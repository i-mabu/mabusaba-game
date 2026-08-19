const choices = [
  'rock',
  'paper',
  'scissors',
];

function getName(choice) {
  const names = {
    rock: '✊ グー',
    paper: '✋ パー',
    scissors: '✌️ チョキ',
  };

  return names[choice];
}

function playRps(player) {
  const bot =
    choices[
      Math.floor(
        Math.random() * choices.length
      )
    ];

  let result;

  if (player === bot) {
    result = 'draw';
  } else if (
    (player === 'rock' && bot === 'scissors') ||
    (player === 'paper' && bot === 'rock') ||
    (player === 'scissors' && bot === 'paper')
  ) {
    result = 'win';
  } else {
    result = 'lose';
  }

  return {
    player,
    bot,
    result,
    playerName: getName(player),
    botName: getName(bot),
  };
}

module.exports = {
  playRps,
};
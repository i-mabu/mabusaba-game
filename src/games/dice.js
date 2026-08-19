function playDice() {
  const player =
    Math.floor(Math.random() * 6) + 1;

  const bot =
    Math.floor(Math.random() * 6) + 1;

  let result;

  if (player > bot) {
    result = 'win';
  } else if (player < bot) {
    result = 'lose';
  } else {
    result = 'draw';
  }

  return {
    player,
    bot,
    result,
  };
}

module.exports = {
  playDice,
};
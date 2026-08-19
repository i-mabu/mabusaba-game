const symbols = [
  '🍒',
  '🍋',
  '🍊',
  '🍇',
  '🔔',
  '⭐',
  '7️⃣',
];

function spin() {
  return [
    symbols[
      Math.floor(
        Math.random() * symbols.length
      )
    ],
    symbols[
      Math.floor(
        Math.random() * symbols.length
      )
    ],
    symbols[
      Math.floor(
        Math.random() * symbols.length
      )
    ],
  ];
}

function playSlots() {
  const result = spin();

  let points = 0;
  let outcome = 'lose';

  if (
    result[0] === result[1] &&
    result[1] === result[2]
  ) {
    points = 50;
    outcome = 'jackpot';
  } else if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    points = 15;
    outcome = 'win';
  }

  return {
    result,
    points,
    outcome,
  };
}

module.exports = {
  playSlots,
};
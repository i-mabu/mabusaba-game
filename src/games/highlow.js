function drawCard() {
  return Math.floor(
    Math.random() * 13
  ) + 1;
}

function playHighLow(choice) {
  const first = drawCard();
  const second = drawCard();

  let result;

  if (first === second) {
    result = 'draw';
  } else if (
    choice === 'high' &&
    second > first
  ) {
    result = 'win';
  } else if (
    choice === 'low' &&
    second < first
  ) {
    result = 'win';
  } else {
    result = 'lose';
  }

  return {
    first,
    second,
    result,
  };
}

module.exports = {
  playHighLow,
};
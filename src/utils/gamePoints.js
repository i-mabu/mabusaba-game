const POINT_RULES = {
  blackjack: { win: 25, lose: -10, draw: 5 },
  roulette: { win: 20, lose: -10 },
  quiz: { win: 15, lose: -5 },
  numberguess: { win: 20, lose: -5 },
  dice: {
    win: 10,
    lose: -5,
    draw: 0
  },

  coin: {
    win: 10,
    lose: -5,
    draw: 0
  },

  rps: {
    win: 15,
    lose: -5,
    draw: 0
  },

  highlow: {
    win: 20,
    lose: -5,
    draw: 0
  },

  slots: {
    win: 15,
    lose: -5,
    draw: 0,
    jackpot: 50
  }
};

/**
 * ゲームのポイントを取得
 *
 * @param {string} game
 * @param {string} result
 * @returns {number}
 */
function getGamePoints(game, result) {
  const rules = POINT_RULES[game];

  if (!rules) {
    throw new Error(
      `Unknown game: ${game}`
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      rules,
      result
    )
  ) {
    throw new Error(
      `Unknown result "${result}" for game "${game}"`
    );
  }

  return rules[result];
}

/**
 * ゲームのルールを取得
 */
function getGameRules(game) {
  return POINT_RULES[game] || null;
}

/**
 * 全ゲームのルールを取得
 */
function getAllGameRules() {
  return {
    ...POINT_RULES
  };
}

/**
 * ゲームが存在するか
 */
function isValidGame(game) {
  return Object.prototype.hasOwnProperty.call(
    POINT_RULES,
    game
  );
}

/**
 * 結果が存在するか
 */
function isValidResult(game, result) {
  const rules = POINT_RULES[game];

  if (!rules) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    rules,
    result
  );
}

module.exports = {
  POINT_RULES,
  getGamePoints,
  getGameRules,
  getAllGameRules,
  isValidGame,
  isValidResult
};
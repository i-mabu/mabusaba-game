function playCoin() {
  return Math.random() < 0.5
    ? '表'
    : '裏';
}

module.exports = {
  playCoin,
};
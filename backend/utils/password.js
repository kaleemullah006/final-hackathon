const crypto = require("node:crypto");

// No look-alike characters (0/O, 1/l/I) so a password read out loud or typed from a screen is easy
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

const pick = (chars) => chars[crypto.randomInt(chars.length)];

// Temporary password: 12 characters, at least one upper, one lower and one digit
function generateTempPassword(length = 12) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) {
    chars.push(pick(ALL));
  }

  // Fisher-Yates shuffle so the guaranteed characters are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

module.exports = { generateTempPassword };

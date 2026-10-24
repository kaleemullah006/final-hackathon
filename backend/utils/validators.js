const AppError = require("./appError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value, field, { max = 200 } = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(422, `${field} is required`);
  }
  if (value.trim().length > max) {
    throw new AppError(422, `${field} is too long`);
  }
  return value.trim();
}

function requireEmail(value) {
  const email = requireString(value, "Email", { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError(422, "Email is not valid");
  }
  return email;
}

function requirePassword(value, field = "Password") {
  if (typeof value !== "string" || value.length < 8) {
    throw new AppError(422, `${field} must be at least 8 characters`);
  }
  if (Buffer.byteLength(value) > 72) {
    throw new AppError(422, `${field} must be at most 72 bytes`);
  }
  return value;
}

module.exports = { requireString, requireEmail, requirePassword };

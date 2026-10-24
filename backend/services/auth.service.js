const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const AppError = require("../utils/appError");
const { requirePassword } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

const hashPassword = (password) => bcrypt.hash(password, 10);

async function loginService({ email, password }) {
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    throw new AppError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");

  const passwordOk = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordOk || !user.isActive) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!process.env.SECRET) {
    throw new Error("SECRET is not configured");
  }

  const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.SECRET, {
    expiresIn: "1d",
  });

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

async function changePasswordService(userId, { currentPassword, newPassword }) {
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new AppError(400, "Current password is required");
  }
  requirePassword(newPassword, "New password");

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const currentOk = await bcrypt.compare(currentPassword, user.password);
  if (!currentOk) {
    throw new AppError(401, "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw new AppError(422, "New password must be different from the current one");
  }

  user.password = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  await logAudit({
    actor: { id: user._id, email: user.email },
    action: "user.change_password",
    entity: "user",
    entityId: user._id,
    before: { mustChangePassword: true },
    after: { mustChangePassword: false },
  });
}

module.exports = { loginService, changePasswordService, hashPassword };

const { loginService, changePasswordService } = require("../services/auth.service");

// Express 5 forwards errors from async handlers to the central error handler
const login = async (req, res) => {
  const { email, password } = req.body || {};
  const result = await loginService({ email, password });

  res.status(200).json({
    success: true,
    message: "user login successfully",
    token: result.token,
    user: result.user,
  });
};

const me = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  await changePasswordService(req.user.id, { currentPassword, newPassword });

  res.status(200).json({ success: true, message: "Password changed successfully" });
};

module.exports = { login, me, changePassword };

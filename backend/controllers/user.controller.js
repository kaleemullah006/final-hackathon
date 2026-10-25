const service = require("../services/user.service");

const list = async (req, res) => {
  const users = await service.listUsers({ role: req.query.role });
  res.status(200).json({ success: true, users });
};

const createHr = async (req, res) => {
  const result = await service.createHrUser(req.user, req.body);

  res.set("Cache-Control", "no-store");
  res.status(201).json({
    success: true,
    message: "HR login created. Share the temporary password now: it is shown only once.",
    user: result.user,
    login: result.login,
  });
};

const setActive = async (req, res) => {
  const user = await service.setUserActive(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", user });
};

const resetPassword = async (req, res) => {
  const result = await service.resetUserPassword(req.user, req.params.id);

  res.set("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    message: "Password reset. Share the temporary password now: it is shown only once.",
    user: result.user,
    login: result.login,
  });
};

module.exports = { list, createHr, setActive, resetPassword };

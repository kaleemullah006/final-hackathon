const service = require("../services/employee.service");

const create = async (req, res) => {
  const result = await service.registerEmployee(req.user, req.body);

  // The temporary password is shown once, so it must never be cached
  res.set("Cache-Control", "no-store");
  res.status(201).json({
    success: true,
    message: "Employee registered. Share the temporary password now: it is shown only once.",
    employee: result.employee,
    login: result.login,
  });
};

const list = async (req, res) => {
  const result = await service.listEmployees(req.query);
  res.status(200).json({ success: true, ...result });
};

const getOne = async (req, res) => {
  const employee = await service.getEmployee(req.params.id);
  res.status(200).json({ success: true, employee });
};

const getMe = async (req, res) => {
  const employee = await service.getMyEmployee(req.user);
  res.status(200).json({ success: true, employee });
};

const updateMe = async (req, res) => {
  const employee = await service.updateMyEmployee(req.user, req.body);
  res.status(200).json({ success: true, message: "Saved", employee });
};

const update = async (req, res) => {
  const employee = await service.updateEmployee(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", employee });
};

module.exports = { create, list, getOne, getMe, updateMe, update };

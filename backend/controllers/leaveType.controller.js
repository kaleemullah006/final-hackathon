const {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  addStandardLeaveTypes,
} = require("../services/leaveType.service");

const list = async (req, res) => {
  const leaveTypes = await listLeaveTypes({ activeOnly: req.query.active === "true" });
  res.status(200).json({ success: true, leaveTypes });
};

const create = async (req, res) => {
  const leaveType = await createLeaveType(req.user, req.body);
  res.status(201).json({ success: true, message: "Created", leaveType });
};

const update = async (req, res) => {
  const leaveType = await updateLeaveType(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", leaveType });
};

const addStandard = async (req, res) => {
  const result = await addStandardLeaveTypes(req.user);
  res.status(200).json({ success: true, ...result });
};

module.exports = { list, create, update, addStandard };

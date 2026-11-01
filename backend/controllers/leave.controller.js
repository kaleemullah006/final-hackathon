const service = require("../services/leave.service");

const myBalance = async (req, res) => {
  res.status(200).json({ success: true, ...(await service.getMyBalance(req.user, req.query.year)) });
};

const employeeBalance = async (req, res) => {
  res
    .status(200)
    .json({ success: true, ...(await service.getEmployeeBalance(req.params.employeeId, req.query.year)) });
};

const preview = async (req, res) => {
  res.status(200).json({ success: true, ...(await service.previewLeave(req.user, req.query)) });
};

const apply = async (req, res) => {
  const request = await service.applyLeave(req.user, req.body);
  res.status(201).json({ success: true, message: "Leave request sent to HR", request });
};

const myLeaves = async (req, res) => {
  res.status(200).json({ success: true, requests: await service.listMyLeaves(req.user, req.query) });
};

const cancel = async (req, res) => {
  const request = await service.cancelLeave(req.user, req.params.id);
  res.status(200).json({ success: true, message: "Cancelled", request });
};

const list = async (req, res) => {
  res.status(200).json({ success: true, ...(await service.listLeaves(req.query)) });
};

const decide = async (req, res) => {
  const request = await service.decideLeave(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", request });
};

module.exports = { myBalance, employeeBalance, preview, apply, myLeaves, cancel, list, decide };

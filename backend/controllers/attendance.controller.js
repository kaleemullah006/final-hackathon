const attendance = require("../services/attendance.service");
const corrections = require("../services/correction.service");

const today = async (req, res) => {
  res.status(200).json({ success: true, ...(await attendance.getToday(req.user)) });
};

const checkIn = async (req, res) => {
  const record = await attendance.checkIn(req.user);
  res.status(201).json({ success: true, message: "Checked in", record });
};

const checkOut = async (req, res) => {
  const record = await attendance.checkOut(req.user);
  res.status(200).json({ success: true, message: "Checked out", record });
};

const myMonth = async (req, res) => {
  res.status(200).json({ success: true, ...(await attendance.getMyMonth(req.user, req.query.month)) });
};

const employeeMonth = async (req, res) => {
  res
    .status(200)
    .json({ success: true, ...(await attendance.getEmployeeMonth(req.params.id, req.query.month)) });
};

const board = async (req, res) => {
  res.status(200).json({ success: true, ...(await attendance.getBoard(req.query)) });
};

const createCorrection = async (req, res) => {
  const correction = await corrections.createCorrection(req.user, req.body);
  res.status(201).json({ success: true, message: "Request sent to HR", correction });
};

const myCorrections = async (req, res) => {
  res.status(200).json({ success: true, corrections: await corrections.listMyCorrections(req.user) });
};

const listCorrections = async (req, res) => {
  res.status(200).json({ success: true, ...(await corrections.listCorrections(req.query)) });
};

const decideCorrection = async (req, res) => {
  const correction = await corrections.decideCorrection(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", correction });
};

module.exports = {
  today,
  checkIn,
  checkOut,
  myMonth,
  employeeMonth,
  board,
  createCorrection,
  myCorrections,
  listCorrections,
  decideCorrection,
};

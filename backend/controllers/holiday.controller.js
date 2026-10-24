const {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../services/holiday.service");

const list = async (req, res) => {
  const holidays = await listHolidays({ year: req.query.year });
  res.status(200).json({ success: true, holidays });
};

const create = async (req, res) => {
  const holiday = await createHoliday(req.user, req.body);
  res.status(201).json({ success: true, message: "Created", holiday });
};

const update = async (req, res) => {
  const holiday = await updateHoliday(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, message: "Saved", holiday });
};

const remove = async (req, res) => {
  await deleteHoliday(req.user, req.params.id);
  res.status(200).json({ success: true, message: "Deleted" });
};

module.exports = { list, create, update, remove };

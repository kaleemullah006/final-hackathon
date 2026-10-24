const mongoose = require("mongoose");
const Holiday = require("../models/holiday");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Accepts only a real calendar date written as YYYY-MM-DD (so 2026-02-30 is rejected)
function requireIsoDate(value) {
  const match = typeof value === "string" ? DATE_RE.exec(value) : null;
  if (!match) {
    throw new AppError(422, "Date must be in YYYY-MM-DD format");
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;

  if (!real || year < 2000 || year > 2100) {
    throw new AppError(422, "Date is not a valid date between 2000 and 2100");
  }
  return value;
}

// Pure function (no database)
function validateHolidayInput(body, { partial }) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const data = {};

  if (!partial || body.date !== undefined) {
    data.date = requireIsoDate(body.date);
  }
  if (!partial || body.name !== undefined) {
    data.name = requireString(body.name, "Name", { max: 100 });
  }

  if (partial && Object.keys(data).length === 0) {
    throw new AppError(422, "Nothing to update");
  }

  return data;
}

// Pure function: ?year=2026 -> 2026, nothing -> null
function parseYear(value) {
  if (value === undefined || value === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(422, "Year must be a number between 2000 and 2100");
  }
  return year;
}

const toPublic = (doc) => ({ id: doc._id.toString(), date: doc.date, name: doc.name });

const duplicate = () => new AppError(409, "A holiday already exists on this date");

async function listHolidays({ year } = {}) {
  const selectedYear = parseYear(year);
  const filter = selectedYear
    ? { date: { $gte: `${selectedYear}-01-01`, $lte: `${selectedYear}-12-31` } }
    : {};
  const docs = await Holiday.find(filter).sort({ date: 1 });
  return docs.map(toPublic);
}

async function createHoliday(actor, body) {
  const data = validateHolidayInput(body, { partial: false });

  let doc;
  try {
    doc = await Holiday.create(data);
  } catch (error) {
    if (error.code === 11000) throw duplicate();
    throw error;
  }

  const after = toPublic(doc);
  await logAudit({ actor, action: "holiday.create", entity: "holiday", entityId: doc._id, before: null, after });
  return after;
}

async function updateHoliday(actor, id, body) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, "Holiday not found");
  }

  const data = validateHolidayInput(body, { partial: true });

  const doc = await Holiday.findById(id);
  if (!doc) {
    throw new AppError(404, "Holiday not found");
  }

  const before = toPublic(doc);
  const changed = Object.keys(data).some((key) => before[key] !== data[key]);
  if (!changed) {
    return before;
  }

  doc.set(data);
  try {
    await doc.save();
  } catch (error) {
    if (error.code === 11000) throw duplicate();
    throw error;
  }

  const after = toPublic(doc);
  await logAudit({ actor, action: "holiday.update", entity: "holiday", entityId: doc._id, before, after });
  return after;
}

async function deleteHoliday(actor, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, "Holiday not found");
  }

  const doc = await Holiday.findById(id);
  if (!doc) {
    throw new AppError(404, "Holiday not found");
  }

  const before = toPublic(doc);
  await doc.deleteOne();

  await logAudit({ actor, action: "holiday.delete", entity: "holiday", entityId: doc._id, before, after: null });
}

module.exports = {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  validateHolidayInput,
  parseYear,
};

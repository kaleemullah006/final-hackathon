const mongoose = require("mongoose");
const LeaveType = require("../models/leaveType");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

// Quotas from the business rules. Admin adds them with one click, nothing is pre-loaded.
const STANDARD_LEAVE_TYPES = [
  { name: "Annual", yearlyQuota: 14, isPaid: true },
  { name: "Sick", yearlyQuota: 8, isPaid: true },
  { name: "Casual", yearlyQuota: 10, isPaid: true },
  { name: "Unpaid", yearlyQuota: null, isPaid: false },
];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateQuota(value) {
  if (value === null) return null; // unlimited
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 365) {
    throw new AppError(422, "Yearly quota must be a whole number from 0 to 365, or null for unlimited");
  }
  return value;
}

function validateBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new AppError(422, `${field} must be true or false`);
  }
  return value;
}

// Pure function (no database)
function validateLeaveTypeInput(body, { partial }) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const data = {};

  if (!partial || body.name !== undefined) {
    data.name = requireString(body.name, "Name", { max: 100 });
  }

  if (!partial && body.yearlyQuota === undefined) {
    throw new AppError(422, "Yearly quota is required (use null for unlimited)");
  }
  if (body.yearlyQuota !== undefined) {
    data.yearlyQuota = validateQuota(body.yearlyQuota);
  }

  if (body.isPaid !== undefined) {
    data.isPaid = validateBoolean(body.isPaid, "isPaid");
  }

  if (partial && body.isActive !== undefined) {
    data.isActive = validateBoolean(body.isActive, "isActive");
  }

  if (partial && Object.keys(data).length === 0) {
    throw new AppError(422, "Nothing to update");
  }

  return data;
}

const toPublic = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  yearlyQuota: doc.yearlyQuota ?? null,
  isPaid: doc.isPaid,
  isActive: doc.isActive,
});

const duplicate = () => new AppError(409, "Leave type with this name already exists");

async function listLeaveTypes({ activeOnly = false } = {}) {
  const filter = activeOnly ? { isActive: true } : {};
  const docs = await LeaveType.find(filter).sort({ name: 1 }).collation({ locale: "en" });
  return docs.map(toPublic);
}

async function createLeaveType(actor, body) {
  const data = validateLeaveTypeInput(body, { partial: false });

  let doc;
  try {
    doc = await LeaveType.create(data);
  } catch (error) {
    if (error.code === 11000) throw duplicate();
    throw error;
  }

  const after = toPublic(doc);
  await logAudit({ actor, action: "leave_type.create", entity: "leave_type", entityId: doc._id, before: null, after });
  return after;
}

async function updateLeaveType(actor, id, body) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, "Leave type not found");
  }

  const data = validateLeaveTypeInput(body, { partial: true });

  const doc = await LeaveType.findById(id);
  if (!doc) {
    throw new AppError(404, "Leave type not found");
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
  await logAudit({ actor, action: "leave_type.update", entity: "leave_type", entityId: doc._id, before, after });
  return after;
}

// Adds only the standard types that do not exist yet, so it is safe to click twice
async function addStandardLeaveTypes(actor) {
  const created = [];
  const skipped = [];

  for (const standard of STANDARD_LEAVE_TYPES) {
    const existing = await LeaveType.findOne({ name: standard.name }).collation({
      locale: "en",
      strength: 2,
    });

    if (existing) {
      skipped.push(standard.name);
      continue;
    }

    try {
      const doc = await LeaveType.create(standard);
      created.push(toPublic(doc));
    } catch (error) {
      if (error.code === 11000) {
        skipped.push(standard.name);
      } else {
        throw error;
      }
    }
  }

  if (created.length > 0) {
    await logAudit({
      actor,
      action: "leave_type.add_standard",
      entity: "leave_type",
      entityId: null,
      before: null,
      after: { created: created.map((item) => item.name) },
    });
  }

  return { created, skipped };
}

module.exports = {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  addStandardLeaveTypes,
  validateLeaveTypeInput,
  STANDARD_LEAVE_TYPES,
};

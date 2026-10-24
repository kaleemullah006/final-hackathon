const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Pure function (no database). create: only "name" is used. update: "name" and/or "isActive".
function validateLookupInput(body, { partial }) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const data = {};

  if (body.name !== undefined || !partial) {
    data.name = requireString(body.name, "Name", { max: 100 });
  }

  if (partial && body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw new AppError(422, "isActive must be true or false");
    }
    data.isActive = body.isActive;
  }

  if (partial && Object.keys(data).length === 0) {
    throw new AppError(422, "Nothing to update");
  }

  return data;
}

const toPublic = (doc) => ({ id: doc._id.toString(), name: doc.name, isActive: doc.isActive });

// One shared service for simple "name + active" lists (departments, designations)
function createLookupService({ Model, label, entity }) {
  const duplicate = () => new AppError(409, `${label} with this name already exists`);

  async function list({ activeOnly = false } = {}) {
    const filter = activeOnly ? { isActive: true } : {};
    const docs = await Model.find(filter).sort({ name: 1 }).collation({ locale: "en" });
    return docs.map(toPublic);
  }

  async function create(actor, body) {
    const data = validateLookupInput(body, { partial: false });

    let doc;
    try {
      doc = await Model.create(data);
    } catch (error) {
      if (error.code === 11000) throw duplicate();
      throw error;
    }

    const after = toPublic(doc);
    await logAudit({ actor, action: `${entity}.create`, entity, entityId: doc._id, before: null, after });
    return after;
  }

  async function update(actor, id, body) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(404, `${label} not found`);
    }

    const data = validateLookupInput(body, { partial: true });

    const doc = await Model.findById(id);
    if (!doc) {
      throw new AppError(404, `${label} not found`);
    }

    const before = toPublic(doc);
    const changed = Object.keys(data).some((key) => doc[key] !== data[key]);
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
    await logAudit({ actor, action: `${entity}.update`, entity, entityId: doc._id, before, after });
    return after;
  }

  return { list, create, update };
}

module.exports = { createLookupService, validateLookupInput };
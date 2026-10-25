const mongoose = require("mongoose");
const User = require("../models/user");
const AppError = require("../utils/appError");
const { requireString, requireEmail } = require("../utils/validators");
const { generateTempPassword } = require("../utils/password");
const { logAudit } = require("../utils/audit");
const { hashPassword } = require("./auth.service");

const ROLES = ["admin", "hr", "employee"];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Pure function (no database): body for POST /users/hr
function validateHrInput(body) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }
  return {
    name: requireString(body.name, "Name", { max: 100 }),
    email: requireEmail(body.email),
  };
}

// Pure function (no database): body for PATCH /users/:id/active
function validateActiveInput(body) {
  if (!isPlainObject(body) || typeof body.isActive !== "boolean") {
    throw new AppError(422, "isActive must be true or false");
  }
  return { isActive: body.isActive };
}

const toPublic = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  role: doc.role,
  isActive: doc.isActive,
  mustChangePassword: doc.mustChangePassword,
});

async function findUser(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "User not found");
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");
  return user;
}

async function listUsers({ role } = {}) {
  const filter = {};
  if (role !== undefined && role !== "") {
    if (typeof role !== "string" || !ROLES.includes(role)) {
      throw new AppError(422, `Role must be one of: ${ROLES.join(", ")}`);
    }
    filter.role = role;
  }

  const docs = await User.find(filter).sort({ name: 1 }).collation({ locale: "en" });
  return docs.map(toPublic);
}

async function createHrUser(actor, body) {
  const data = validateHrInput(body);
  const tempPassword = generateTempPassword();

  let user;
  try {
    user = await User.create({
      ...data,
      password: await hashPassword(tempPassword),
      role: "hr",
      mustChangePassword: true,
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, "An account with this email already exists");
    throw error;
  }

  const after = toPublic(user);
  await logAudit({ actor, action: "user.create_hr", entity: "user", entityId: user._id, before: null, after });

  return { user: after, login: { email: user.email, tempPassword } };
}

async function setUserActive(actor, id, body) {
  const { isActive } = validateActiveInput(body);
  const user = await findUser(id);

  if (!isActive) {
    if (user._id.toString() === actor.id) {
      throw new AppError(409, "You cannot deactivate your own login");
    }

    if (user.role === "admin") {
      const otherAdmins = await User.countDocuments({
        role: "admin",
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherAdmins === 0) {
        throw new AppError(409, "The last active Admin cannot be deactivated");
      }
    }
  }

  if (user.isActive === isActive) {
    return toPublic(user);
  }

  const before = toPublic(user);
  user.isActive = isActive;
  await user.save();

  const after = toPublic(user);
  await logAudit({
    actor,
    action: isActive ? "user.activate" : "user.deactivate",
    entity: "user",
    entityId: user._id,
    before,
    after,
  });

  return after;
}

async function resetUserPassword(actor, id) {
  const user = await findUser(id);

  if (user._id.toString() === actor.id) {
    throw new AppError(409, "Use Change password to change your own password");
  }

  const tempPassword = generateTempPassword();
  const before = toPublic(user);

  user.password = await hashPassword(tempPassword);
  user.mustChangePassword = true;
  await user.save();

  // The password itself is never written to the audit log
  await logAudit({
    actor,
    action: "user.reset_password",
    entity: "user",
    entityId: user._id,
    before,
    after: toPublic(user),
  });

  return { user: toPublic(user), login: { email: user.email, tempPassword } };
}

module.exports = {
  listUsers,
  createHrUser,
  setUserActive,
  resetUserPassword,
  validateHrInput,
  validateActiveInput,
};

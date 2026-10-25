const mongoose = require("mongoose");
const Employee = require("../models/employee");
const User = require("../models/user");
const Department = require("../models/department");
const Designation = require("../models/designation");
const Counter = require("../models/counter");
const AppError = require("../utils/appError");
const { requireString, requireEmail } = require("../utils/validators");
const { generateTempPassword } = require("../utils/password");
const { logAudit } = require("../utils/audit");
const { hashPassword } = require("./auth.service");
const { requireIsoDate } = require("./holiday.service");

const GENDERS = ["male", "female", "other"];
const STATUSES = ["probation", "active", "exited"];
const CODE_RE = /^[A-Za-z0-9-]{2,20}$/;
const PHONE_RE = /^[0-9+\-()\s]{7,20}$/;
const MAX_SALARY = 1_000_000_000;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObjectId(value, field) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(422, `${field} is required`);
  }
  return value;
}

function requirePhone(value) {
  const phone = requireString(value, "Phone", { max: 20 });
  if (!PHONE_RE.test(phone)) {
    throw new AppError(422, "Phone must be 7 to 20 digits (you can use + - ( ) and spaces)");
  }
  return phone;
}

function requireSalary(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_SALARY) {
    throw new AppError(422, "Basic salary must be a number greater than 0");
  }
  return value;
}

function requireEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new AppError(422, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function requireCode(value) {
  const code = requireString(value, "Employee code", { max: 20 });
  if (!CODE_RE.test(code)) {
    throw new AppError(422, "Employee code can use letters, numbers and - (2 to 20 characters)");
  }
  return code.toUpperCase();
}

// Pure function (no database).
//  mode "create": HR registers an employee (all job fields required, code is optional)
//  mode "update": HR edits any field (only the fields sent are checked)
//  mode "self":   employee edits own record: only phone and address are allowed
function validateEmployeeInput(body, { mode }) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const data = {};

  if (mode === "self") {
    const extra = Object.keys(body).filter((key) => key !== "phone" && key !== "address");
    if (extra.length > 0) {
      throw new AppError(403, "You can only change your phone and address");
    }
    if (body.phone !== undefined) data.phone = requirePhone(body.phone);
    if (body.address !== undefined) {
      data.address = requireString(body.address, "Address", { max: 300 });
    }
    if (Object.keys(data).length === 0) {
      throw new AppError(422, "Nothing to update");
    }
    return data;
  }

  const create = mode === "create";
  const has = (key) => body[key] !== undefined;

  if (create || has("name")) data.name = requireString(body.name, "Name", { max: 100 });
  if (create || has("email")) data.email = requireEmail(body.email);
  if (create || has("gender")) data.gender = requireEnum(body.gender, GENDERS, "Gender");
  if (create || has("department")) data.department = requireObjectId(body.department, "Department");
  if (create || has("designation")) {
    data.designation = requireObjectId(body.designation, "Designation");
  }
  if (create || has("joiningDate")) data.joiningDate = requireIsoDate(body.joiningDate);
  if (create || has("basicSalary")) data.basicSalary = requireSalary(body.basicSalary);

  if (has("phone")) data.phone = requirePhone(body.phone);
  if (has("address")) data.address = requireString(body.address, "Address", { max: 300 });
  if (has("code")) data.code = requireCode(body.code);

  if (create) {
    // New employees start on probation (or active); they cannot be registered as already exited
    if (has("status")) {
      data.status = requireEnum(body.status, ["probation", "active"], "Status");
    }
    if (has("exitDate")) {
      throw new AppError(422, "A new employee cannot have an exit date");
    }
  } else {
    if (has("status")) data.status = requireEnum(body.status, STATUSES, "Status");
    if (has("exitDate")) {
      data.exitDate = body.exitDate === null ? null : requireIsoDate(body.exitDate);
    }
    if (Object.keys(data).length === 0) {
      throw new AppError(422, "Nothing to update");
    }
  }

  return data;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pure function: turns ?search=&department=&designation=&status=&page=&limit= into a filter.
function buildListQuery(query = {}) {
  const filter = {};

  if (query.search !== undefined && query.search !== "") {
    if (typeof query.search !== "string" || query.search.length > 100) {
      throw new AppError(422, "Search text is not valid");
    }
    const pattern = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { code: pattern }];
  }

  if (query.department !== undefined && query.department !== "") {
    filter.department = requireObjectId(query.department, "Department");
  }
  if (query.designation !== undefined && query.designation !== "") {
    filter.designation = requireObjectId(query.designation, "Designation");
  }
  if (query.status !== undefined && query.status !== "") {
    filter.status = requireEnum(query.status, STATUSES, "Status");
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(422, "Page must be a whole number, 1 or more");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(422, "Limit must be a whole number between 1 and 100");
  }

  return { filter, page, limit };
}

// Salary is only shown to Admin and HR. An employee never sees it here.
function toPublic(doc, { includeSalary }) {
  const ref = (value) =>
    value && value._id ? { id: value._id.toString(), name: value.name } : { id: String(value), name: null };

  const out = {
    id: doc._id.toString(),
    code: doc.code,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    address: doc.address,
    gender: doc.gender,
    department: ref(doc.department),
    designation: ref(doc.designation),
    joiningDate: doc.joiningDate,
    status: doc.status,
    exitDate: doc.exitDate,
  };

  if (includeSalary) out.basicSalary = doc.basicSalary;
  return out;
}

const POPULATE = [
  { path: "department", select: "name" },
  { path: "designation", select: "name" },
];

// Department and designation must exist and be active
async function assertActiveLookups({ department, designation }) {
  if (department) {
    const found = await Department.findOne({ _id: department, isActive: true });
    if (!found) throw new AppError(422, "Department not found or not active");
  }
  if (designation) {
    const found = await Designation.findOne({ _id: designation, isActive: true });
    if (!found) throw new AppError(422, "Designation not found or not active");
  }
}

async function nextEmployeeCode() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "employee" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return `EMP-${String(counter.seq).padStart(4, "0")}`;
}

const duplicateEmail = () => new AppError(409, "An account with this email already exists");
const duplicateCode = () => new AppError(409, "This employee code is already used");

// Duplicate-key errors from MongoDB say which field clashed
function duplicateError(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  return field === "code" ? duplicateCode() : duplicateEmail();
}

async function registerEmployee(actor, body) {
  const data = validateEmployeeInput(body, { mode: "create" });
  await assertActiveLookups(data);

  const tempPassword = generateTempPassword();

  let user;
  try {
    user = await User.create({
      name: data.name,
      email: data.email,
      password: await hashPassword(tempPassword),
      role: "employee",
      mustChangePassword: true,
    });
  } catch (error) {
    if (error.code === 11000) throw duplicateEmail();
    throw error;
  }

  // If the employee record cannot be saved, remove the login again so nothing is left half-made
  let employee;
  try {
    let code = data.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const useCode = code || (await nextEmployeeCode());
      try {
        employee = await Employee.create({ ...data, code: useCode, user: user._id });
        break;
      } catch (error) {
        const clash = error.code === 11000 && Object.keys(error.keyPattern || {})[0] === "code";
        // An auto code can clash with a code HR typed by hand: try the next number
        if (clash && !code) continue;
        throw error;
      }
    }
    if (!employee) throw new Error("Could not generate an employee code");
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    if (error.code === 11000) throw duplicateError(error);
    throw error;
  }

  await employee.populate(POPULATE);
  const after = toPublic(employee, { includeSalary: true });

  await logAudit({
    actor,
    action: "employee.create",
    entity: "employee",
    entityId: employee._id,
    before: null,
    after,
  });

  return { employee: after, login: { email: user.email, tempPassword } };
}

async function listEmployees(query) {
  const { filter, page, limit } = buildListQuery(query);

  const [docs, total] = await Promise.all([
    Employee.find(filter)
      .populate(POPULATE)
      .sort({ code: 1 })
      .collation({ locale: "en", numericOrdering: true })
      .skip((page - 1) * limit)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);

  return {
    employees: docs.map((doc) => toPublic(doc, { includeSalary: true })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Employee 360: the full record plus the state of the login
async function getEmployee(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Employee not found");

  const doc = await Employee.findById(id).populate(POPULATE);
  if (!doc) throw new AppError(404, "Employee not found");

  const user = await User.findById(doc.user);

  return {
    ...toPublic(doc, { includeSalary: true }),
    userId: doc.user.toString(),
    login: user
      ? { isActive: user.isActive, mustChangePassword: user.mustChangePassword }
      : null,
  };
}

// The employee is found from the logged-in user, never from an id sent by the client
async function findOwnEmployee(actor) {
  const doc = await Employee.findOne({ user: actor.id }).populate(POPULATE);
  if (!doc) throw new AppError(404, "No employee record is linked to this login");
  return doc;
}

async function getMyEmployee(actor) {
  const doc = await findOwnEmployee(actor);
  return toPublic(doc, { includeSalary: false });
}

async function updateMyEmployee(actor, body) {
  const data = validateEmployeeInput(body, { mode: "self" });
  const doc = await findOwnEmployee(actor);

  const before = { phone: doc.phone, address: doc.address };
  doc.set(data);
  await doc.save();

  await logAudit({
    actor,
    action: "employee.update_self",
    entity: "employee",
    entityId: doc._id,
    before,
    after: { phone: doc.phone, address: doc.address },
  });

  return toPublic(doc, { includeSalary: false });
}

async function updateEmployee(actor, id, body) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Employee not found");

  const data = validateEmployeeInput(body, { mode: "update" });
  const doc = await Employee.findById(id);
  if (!doc) throw new AppError(404, "Employee not found");

  // Only check lookups that are actually being changed (an old inactive one may stay)
  await assertActiveLookups({
    department: data.department && data.department !== doc.department.toString() ? data.department : null,
    designation:
      data.designation && data.designation !== doc.designation.toString() ? data.designation : null,
  });

  // Exit rules
  const newStatus = data.status || doc.status;
  if (newStatus === "exited") {
    const exitDate = data.exitDate !== undefined ? data.exitDate : doc.exitDate;
    if (!exitDate) throw new AppError(422, "Exit date is required when status is exited");
    const joining = data.joiningDate || doc.joiningDate;
    if (exitDate < joining) throw new AppError(422, "Exit date cannot be before the joining date");
    data.exitDate = exitDate;
  } else {
    // Not exited: there can be no exit date
    if (data.exitDate) throw new AppError(422, "Exit date is only allowed when status is exited");
    data.exitDate = null;
  }

  const populatedBefore = await Employee.findById(id).populate(POPULATE);
  const before = toPublic(populatedBefore, { includeSalary: true });
  const wasExited = doc.status === "exited";

  const user = await User.findById(doc.user);

  // Check the new email against every login first, so nothing is half-saved
  if (data.email !== undefined && user) {
    const clash = await User.findOne({ email: data.email, _id: { $ne: user._id } });
    if (clash) throw duplicateEmail();
  }

  doc.set(data);
  try {
    await doc.save();
  } catch (error) {
    if (error.code === 11000) throw duplicateError(error);
    throw error;
  }

  // Keep the login's name and email the same as the employee record
  if (user && (data.name !== undefined || data.email !== undefined)) {
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    await user.save();
  }

  // Exiting an employee switches the login off (it can be switched on again by Admin)
  let loginDeactivated = false;
  if (doc.status === "exited" && !wasExited && user && user.isActive) {
    user.isActive = false;
    await user.save();
    loginDeactivated = true;
  }

  await doc.populate(POPULATE);
  const after = toPublic(doc, { includeSalary: true });

  await logAudit({
    actor,
    action: "employee.update",
    entity: "employee",
    entityId: doc._id,
    before,
    after: loginDeactivated ? { ...after, loginDeactivated: true } : after,
  });

  return after;
}

module.exports = {
  registerEmployee,
  listEmployees,
  getEmployee,
  getMyEmployee,
  updateMyEmployee,
  updateEmployee,
  validateEmployeeInput,
  buildListQuery,
};

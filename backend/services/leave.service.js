const mongoose = require("mongoose");
const Attendance = require("../models/attendance");
const Employee = require("../models/employee");
const LeaveRequest = require("../models/leaveRequest");
const LeaveType = require("../models/leaveType");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { validateDecision } = require("../utils/decision");
const { dateStringPk, addDays } = require("../utils/time");
const { loadCalendar, countWorkingDays } = require("./calendar.service");
const { requireOwnEmployee, requireId, activeHrUserIds } = require("./employeeScope");
const { requireIsoDate } = require("./holiday.service");

const STATUSES = ["pending", "approved", "rejected", "cancelled"];
const MAX_DAYS_BACK = 30;

const yearRange = (year) => ({ from: `${year}-01-01`, to: `${year}-12-31` });

function parseYear(value, today) {
  if (value === undefined || value === "") return Number(today.slice(0, 4));
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(422, "Year is not valid");
  }
  return year;
}

function requireTypeId(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(422, "Leave type is required");
  }
  return value;
}

// Pure function (no database): body for applying for leave
function validateLeaveInput(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const leaveType = requireTypeId(body.leaveType);
  const startDate = requireIsoDate(body.startDate);
  const endDate = requireIsoDate(body.endDate);

  if (endDate < startDate) throw new AppError(422, "End date cannot be before the start date");
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    throw new AppError(422, "A leave request must stay inside one calendar year. Split it into two requests.");
  }

  return { leaveType, startDate, endDate, reason: requireString(body.reason, "Reason", { max: 500 }) };
}

// Pure function: quota, used and left for every leave type.
//  remaining = after approved leave only, available = after pending leave too (used for the limit check)
function computeBalanceRows(types, requests) {
  return types.map((type) => {
    const mine = requests.filter((r) => r.leaveType.toString() === type._id.toString());
    const sum = (status) => mine.filter((r) => r.status === status).reduce((total, r) => total + r.days, 0);
    const approved = sum("approved");
    const pending = sum("pending");
    const quota = type.yearlyQuota;

    return {
      leaveType: { id: type._id.toString(), name: type.name, isPaid: type.isPaid },
      quota,
      approved,
      pending,
      remaining: quota === null ? null : quota - approved,
      available: quota === null ? null : quota - approved - pending,
    };
  });
}

async function leaveBalance(employeeId, year) {
  const { from, to } = yearRange(year);
  const [types, requests] = await Promise.all([
    LeaveType.find({ isActive: true }).sort({ name: 1 }),
    LeaveRequest.find({
      employee: employeeId,
      status: { $in: ["pending", "approved"] },
      startDate: { $gte: from, $lte: to },
    }),
  ]);
  return computeBalanceRows(types, requests);
}

// All the rules for a new request. Throws a 422 with a clear reason when something is wrong.
async function checkLeaveRequest(employee, input, today) {
  const type = await LeaveType.findOne({ _id: input.leaveType, isActive: true });
  if (!type) throw new AppError(422, "Leave type not found or not active");

  if (input.startDate < addDays(today, -MAX_DAYS_BACK)) {
    throw new AppError(422, `Leave can only start up to ${MAX_DAYS_BACK} days in the past`);
  }
  if (input.startDate < employee.joiningDate) {
    throw new AppError(422, "Leave cannot start before your joining date");
  }

  const calendar = await loadCalendar(input.startDate, input.endDate);
  const days = countWorkingDays(input.startDate, input.endDate, calendar);
  if (days === 0) {
    throw new AppError(422, "These dates have no working days (weekends and public holidays are not counted)");
  }

  const overlap = await LeaveRequest.exists({
    employee: employee._id,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: input.endDate },
    endDate: { $gte: input.startDate },
  });
  if (overlap) throw new AppError(422, "You already have a leave request that overlaps these dates");

  const attended = await Attendance.exists({
    employee: employee._id,
    date: { $gte: input.startDate, $lte: input.endDate },
  });
  if (attended) throw new AppError(422, "You already have attendance on one of these days");

  const rows = await leaveBalance(employee._id, Number(input.startDate.slice(0, 4)));
  const row = rows.find((r) => r.leaveType.id === type._id.toString());
  if (row && row.available !== null && days > row.available) {
    throw new AppError(422, `Not enough ${type.name} balance: ${row.available} day(s) left, ${days} needed`);
  }

  return { type, days, available: row ? row.available : null };
}

const view = (doc) => {
  const employee = doc.employee && doc.employee._id ? doc.employee : null;
  const type = doc.leaveType && doc.leaveType._id ? doc.leaveType : null;
  return {
    id: doc._id.toString(),
    leaveType: type ? { id: type._id.toString(), name: type.name, isPaid: type.isPaid } : { id: String(doc.leaveType), name: null },
    startDate: doc.startDate,
    endDate: doc.endDate,
    days: doc.days,
    reason: doc.reason,
    status: doc.status,
    decisionComment: doc.decisionComment,
    decidedAt: doc.decidedAt,
    createdAt: doc.createdAt,
    employee: employee
      ? {
          id: employee._id.toString(),
          code: employee.code,
          name: employee.name,
          department: employee.department && employee.department.name ? employee.department.name : null,
        }
      : undefined,
  };
};

const POPULATE_TYPE = { path: "leaveType", select: "name isPaid" };

// ---------- employee actions ----------

async function getMyBalance(actor, yearValue, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const year = parseYear(yearValue, dateStringPk(now));
  return { year, balances: await leaveBalance(employee._id, year) };
}

async function getEmployeeBalance(employeeId, yearValue, now = new Date()) {
  requireId(employeeId, "Employee");
  if (!(await Employee.exists({ _id: employeeId }))) throw new AppError(404, "Employee not found");
  const year = parseYear(yearValue, dateStringPk(now));
  return { year, balances: await leaveBalance(employeeId, year) };
}

// Shows what a request would cost before it is sent (nothing is saved)
async function previewLeave(actor, query, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const today = dateStringPk(now);

  let input;
  try {
    input = validateLeaveInput({ ...query, reason: "preview" });
    const { days, available } = await checkLeaveRequest(employee, input, today);
    return { valid: true, days, available, problem: null };
  } catch (error) {
    if (error instanceof AppError && error.status === 422) {
      return { valid: false, days: null, available: null, problem: error.message };
    }
    throw error;
  }
}

async function applyLeave(actor, body, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const input = validateLeaveInput(body);
  const { type, days } = await checkLeaveRequest(employee, input, dateStringPk(now));

  const doc = await LeaveRequest.create({
    employee: employee._id,
    leaveType: type._id,
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    reason: input.reason,
  });

  await logAudit({
    actor,
    action: "leave.apply",
    entity: "leave_request",
    entityId: doc._id,
    before: null,
    after: { type: type.name, startDate: doc.startDate, endDate: doc.endDate, days, status: "pending" },
  });

  for (const userId of await activeHrUserIds()) {
    await notify({
      user: userId,
      type: "leave_request",
      title: "New leave request",
      message: `${employee.name} applied for ${days} day(s) of ${type.name} leave (${doc.startDate} to ${doc.endDate}).`,
      link: "/leave-requests",
    });
  }

  await doc.populate(POPULATE_TYPE);
  return view(doc);
}

async function listMyLeaves(actor, query = {}, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const filter = { employee: employee._id };

  if (query.status !== undefined && query.status !== "" && query.status !== "all") {
    if (!STATUSES.includes(query.status)) throw new AppError(422, `Status must be one of: ${STATUSES.join(", ")}, all`);
    filter.status = query.status;
  }
  if (query.year !== undefined && query.year !== "") {
    const { from, to } = yearRange(parseYear(query.year, dateStringPk(now)));
    filter.startDate = { $gte: from, $lte: to };
  }

  const docs = await LeaveRequest.find(filter).populate(POPULATE_TYPE).sort({ startDate: -1 }).limit(100);
  return docs.map(view);
}

async function cancelLeave(actor, id, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  requireId(id, "Leave request");

  // Looked up by owner too, so nobody can cancel someone else's leave
  const doc = await LeaveRequest.findOne({ _id: id, employee: employee._id });
  if (!doc) throw new AppError(404, "Leave request not found");

  const today = dateStringPk(now);
  const canCancel = doc.status === "pending" || (doc.status === "approved" && doc.startDate > today);
  if (!canCancel) {
    throw new AppError(409, "Only a pending request, or an approved leave that has not started, can be cancelled");
  }

  const before = { status: doc.status };
  doc.status = "cancelled";
  await doc.save();

  await logAudit({
    actor,
    action: "leave.cancel",
    entity: "leave_request",
    entityId: doc._id,
    before,
    after: { status: "cancelled" },
  });

  await doc.populate(POPULATE_TYPE);
  return view(doc);
}

// ---------- HR and Admin ----------

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseListQuery(query = {}) {
  let status = null;
  if (query.status !== undefined && query.status !== "" && query.status !== "all") {
    if (!STATUSES.includes(query.status)) throw new AppError(422, `Status must be one of: ${STATUSES.join(", ")}, all`);
    status = query.status;
  }

  let department = null;
  if (query.department !== undefined && query.department !== "") {
    if (typeof query.department !== "string" || !mongoose.isValidObjectId(query.department)) {
      throw new AppError(422, "Department is not valid");
    }
    department = query.department;
  }

  let search = "";
  if (query.search !== undefined && query.search !== "") {
    if (typeof query.search !== "string" || query.search.length > 100) throw new AppError(422, "Search text is not valid");
    search = query.search.trim();
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new AppError(422, "Page must be 1 or more");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(422, "Limit must be between 1 and 100");

  return { status, department, search, page, limit };
}

async function listLeaves(query) {
  const { status, department, search, page, limit } = parseListQuery(query);
  const filter = status ? { status } : {};

  if (department || search) {
    const employeeFilter = {};
    if (department) employeeFilter.department = department;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      employeeFilter.$or = [{ name: pattern }, { code: pattern }];
    }
    filter.employee = { $in: await Employee.find(employeeFilter).distinct("_id") };
  }

  const [docs, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: "employee", select: "code name department", populate: { path: "department", select: "name" } })
      .populate(POPULATE_TYPE)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);

  return { requests: docs.map(view), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function decideLeave(actor, id, body, now = new Date()) {
  requireId(id, "Leave request");
  const { decision, comment } = validateDecision(body);

  const doc = await LeaveRequest.findById(id);
  if (!doc) throw new AppError(404, "Leave request not found");
  if (doc.status !== "pending") throw new AppError(409, "This request has already been decided");

  doc.status = decision;
  doc.decidedBy = actor.id;
  doc.decidedAt = now;
  doc.decisionComment = comment;
  await doc.save();

  await logAudit({
    actor,
    action: decision === "approved" ? "leave.approve" : "leave.reject",
    entity: "leave_request",
    entityId: doc._id,
    before: { status: "pending" },
    after: { status: decision, comment, startDate: doc.startDate, endDate: doc.endDate, days: doc.days },
  });

  const employee = await Employee.findById(doc.employee).select("user");
  if (employee) {
    await notify({
      user: employee.user,
      type: "leave_decision",
      title: `Leave request ${decision}`,
      message: `Your leave (${doc.startDate} to ${doc.endDate}) was ${decision}.${comment ? ` Comment: ${comment}` : ""}`,
      link: "/my-leave",
    });
  }

  await doc.populate(POPULATE_TYPE);
  return view(doc);
}

module.exports = {
  getMyBalance,
  getEmployeeBalance,
  previewLeave,
  applyLeave,
  listMyLeaves,
  cancelLeave,
  listLeaves,
  decideLeave,
  validateLeaveInput,
  computeBalanceRows,
  parseListQuery,
  parseYear,
};

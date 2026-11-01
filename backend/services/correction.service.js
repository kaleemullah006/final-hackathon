const Attendance = require("../models/attendance");
const AttendanceCorrection = require("../models/attendanceCorrection");
const Employee = require("../models/employee");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { validateDecision } = require("../utils/decision");
const { dateStringPk, addDays, timeOnDatePk, timeStringPk, TIME_RE } = require("../utils/time");
const { loadCalendar, isWorkingDay } = require("./calendar.service");
const { computeStatusFromTimes } = require("./attendance.service");
const { requireOwnEmployee, requireId, activeHrUserIds } = require("./employeeScope");
const { requireIsoDate } = require("./holiday.service");

const STATUSES = ["pending", "approved", "rejected"];
const MAX_DAYS_BACK = 60;

function optionalTime(value, label) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !TIME_RE.test(value)) {
    throw new AppError(422, `${label} must look like 09:30 (24-hour time)`);
  }
  return value;
}

// Pure function (no database): body for a correction request
function validateCorrectionInput(body, today) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const date = requireIsoDate(body.date);
  if (date > today) throw new AppError(422, "The date cannot be in the future");
  if (date < addDays(today, -MAX_DAYS_BACK)) {
    throw new AppError(422, `Corrections can only be requested for the last ${MAX_DAYS_BACK} days`);
  }

  const checkIn = optionalTime(body.checkIn, "Check-in time");
  const checkOut = optionalTime(body.checkOut, "Check-out time");
  if (!checkIn && !checkOut) {
    throw new AppError(422, "Enter a check-in time, a check-out time, or both");
  }

  return { date, checkIn, checkOut, reason: requireString(body.reason, "Reason", { max: 500 }) };
}

// Combines the requested times with what is already saved and checks they make sense
function mergeTimes({ date, requestedIn, requestedOut, existing, now, today }) {
  const checkIn = requestedIn || (existing ? existing.checkIn : null);
  const checkOut = requestedOut || (existing ? existing.checkOut : null);

  if (!checkIn) {
    throw new AppError(422, "A check-in time is required because there is no attendance for this day");
  }
  if (!checkOut && date !== today) {
    throw new AppError(422, "A check-out time is required");
  }
  if (checkOut && checkOut <= checkIn) {
    throw new AppError(422, "Check-out must be after check-in");
  }
  if (checkIn > now || (checkOut && checkOut > now)) {
    throw new AppError(422, "Times cannot be in the future");
  }

  return { checkIn, checkOut };
}

const view = (doc) => {
  const employee = doc.employee && doc.employee._id ? doc.employee : null;
  return {
    id: doc._id.toString(),
    date: doc.date,
    checkInTime: doc.checkIn ? timeStringPk(doc.checkIn) : null,
    checkOutTime: doc.checkOut ? timeStringPk(doc.checkOut) : null,
    reason: doc.reason,
    status: doc.status,
    decisionComment: doc.decisionComment,
    decidedAt: doc.decidedAt,
    createdAt: doc.createdAt,
    employee: employee ? { id: employee._id.toString(), code: employee.code, name: employee.name } : undefined,
  };
};

const attendanceSummary = (record) =>
  record
    ? {
        checkInTime: timeStringPk(record.checkIn),
        checkOutTime: record.checkOut ? timeStringPk(record.checkOut) : null,
        status: record.status,
      }
    : null;

async function createCorrection(actor, body, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const today = dateStringPk(now);
  const input = validateCorrectionInput(body, today);

  if (input.date < employee.joiningDate || (employee.exitDate && input.date > employee.exitDate)) {
    throw new AppError(422, "You were not employed on this date");
  }

  const existing = await Attendance.findOne({ employee: employee._id, date: input.date });
  const requestedIn = input.checkIn ? timeOnDatePk(input.date, input.checkIn) : null;
  const requestedOut = input.checkOut ? timeOnDatePk(input.date, input.checkOut) : null;

  mergeTimes({ date: input.date, requestedIn, requestedOut, existing, now, today });

  let doc;
  try {
    doc = await AttendanceCorrection.create({
      employee: employee._id,
      date: input.date,
      checkIn: requestedIn,
      checkOut: requestedOut,
      reason: input.reason,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, "You already have a pending correction request for this date");
    }
    throw error;
  }

  await logAudit({
    actor,
    action: "correction.request",
    entity: "attendance_correction",
    entityId: doc._id,
    before: attendanceSummary(existing),
    after: { date: doc.date, checkInTime: input.checkIn, checkOutTime: input.checkOut, reason: doc.reason },
  });

  for (const userId of await activeHrUserIds()) {
    await notify({
      user: userId,
      type: "correction_request",
      title: "New attendance correction request",
      message: `${employee.name} asked to correct attendance for ${doc.date}.`,
      link: "/corrections",
    });
  }

  return view(doc);
}

async function listMyCorrections(actor) {
  const employee = await requireOwnEmployee(actor);
  const docs = await AttendanceCorrection.find({ employee: employee._id }).sort({ createdAt: -1 }).limit(50);
  return docs.map(view);
}

function parseListQuery(query = {}) {
  let status = null;
  if (query.status !== undefined && query.status !== "" && query.status !== "all") {
    if (!STATUSES.includes(query.status)) {
      throw new AppError(422, `Status must be one of: ${STATUSES.join(", ")}, all`);
    }
    status = query.status;
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new AppError(422, "Page must be 1 or more");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(422, "Limit must be between 1 and 100");
  }
  return { status, page, limit };
}

async function listCorrections(query) {
  const { status, page, limit } = parseListQuery(query);
  const filter = status ? { status } : {};

  const [docs, total] = await Promise.all([
    AttendanceCorrection.find(filter)
      .populate("employee", "code name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AttendanceCorrection.countDocuments(filter),
  ]);

  return {
    corrections: docs.map(view),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function decideCorrection(actor, id, body, now = new Date()) {
  requireId(id, "Request");
  const { decision, comment } = validateDecision(body);

  const doc = await AttendanceCorrection.findById(id);
  if (!doc) throw new AppError(404, "Request not found");
  if (doc.status !== "pending") throw new AppError(409, "This request has already been decided");

  const today = dateStringPk(now);
  let beforeAttendance = null;
  let afterAttendance = null;

  if (decision === "approved") {
    const existing = await Attendance.findOne({ employee: doc.employee, date: doc.date });
    beforeAttendance = attendanceSummary(existing);

    // Checked again now: the saved attendance may have changed since the request was made
    const { checkIn, checkOut } = mergeTimes({
      date: doc.date,
      requestedIn: doc.checkIn,
      requestedOut: doc.checkOut,
      existing,
      now,
      today,
    });

    const calendar = await loadCalendar(doc.date, doc.date);
    const result = computeStatusFromTimes({
      checkIn,
      checkOut,
      settings: calendar.settings,
      workingDay: isWorkingDay(doc.date, calendar),
    });

    let record = existing;
    if (record) {
      record.set({ checkIn, checkOut });
    } else {
      record = new Attendance({ employee: doc.employee, date: doc.date, checkIn, checkOut });
    }
    record.status = result.status;
    record.isLate = result.isLate;
    record.workedMinutes = result.workedMinutes;
    record.source = "correction";
    record.corrected = true;
    await record.save();

    afterAttendance = attendanceSummary(record);
  }

  doc.status = decision;
  doc.decidedBy = actor.id;
  doc.decidedAt = now;
  doc.decisionComment = comment;
  await doc.save();

  await logAudit({
    actor,
    action: decision === "approved" ? "correction.approve" : "correction.reject",
    entity: "attendance_correction",
    entityId: doc._id,
    before: { status: "pending", attendance: beforeAttendance },
    after: { status: decision, comment, attendance: afterAttendance },
  });

  const employee = await Employee.findById(doc.employee).select("user");
  if (employee) {
    await notify({
      user: employee.user,
      type: "correction_decision",
      title: `Attendance correction ${decision}`,
      message: `Your request for ${doc.date} was ${decision}.${comment ? ` Comment: ${comment}` : ""}`,
      link: "/my-attendance",
    });
  }

  return view(doc);
}

module.exports = {
  createCorrection,
  listMyCorrections,
  listCorrections,
  decideCorrection,
  validateCorrectionInput,
  mergeTimes,
  parseListQuery,
};

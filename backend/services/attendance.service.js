const mongoose = require("mongoose");
const Attendance = require("../models/attendance");
const Employee = require("../models/employee");
const LeaveRequest = require("../models/leaveRequest");
const AppError = require("../utils/appError");
const {
  dateStringPk,
  secondsOfDayPk,
  timeStringPk,
  dayOfWeek,
  eachDate,
  monthRange,
  minutesFromHm,
} = require("../utils/time");
const { loadCalendar, isWeekend, holidayName, isWorkingDay } = require("./calendar.service");
const { requireOwnEmployee, requireId } = require("./employeeScope");
const { requireIsoDate } = require("./holiday.service");

const BOARD_STATUSES = [
  "present",
  "late",
  "half_day",
  "missing_checkout",
  "absent",
  "on_leave",
  "not_checked_in",
  "weekend",
  "holiday",
  "upcoming",
];

// ---------- pure rules (no database, easy to test) ----------

// Late only on a working day, after office start + grace time
function computeCheckInStatus(checkIn, settings, workingDay) {
  const limit = (minutesFromHm(settings.officeStartTime) + settings.graceMinutes) * 60;
  const isLate = workingDay && secondsOfDayPk(checkIn) > limit;
  return { status: isLate ? "late" : "present", isLate };
}

// Used on check-out and when a correction is approved
function computeStatusFromTimes({ checkIn, checkOut, settings, workingDay }) {
  const { isLate } = computeCheckInStatus(checkIn, settings, workingDay);
  if (!checkOut) {
    return { status: isLate ? "late" : "present", isLate, workedMinutes: null };
  }
  const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
  if (workedMinutes < settings.halfDayHours * 60) {
    return { status: "half_day", isLate, workedMinutes };
  }
  return { status: isLate ? "late" : "present", isLate, workedMinutes };
}

// The status of one employee on one day. "absent" and "missing_checkout" are never stored:
// they are worked out here, so they are always right even when nobody runs a daily job.
function deriveDayStatus({ date, today, record, weekend, holiday, onLeave }) {
  if (record) {
    if (record.checkOut) return record.status;
    if (date < today) return "missing_checkout";
    return record.status;
  }
  if (weekend) return "weekend";
  if (holiday) return "holiday";
  if (onLeave) return "on_leave";
  if (date > today) return "upcoming";
  if (date === today) return "not_checked_in";
  return "absent";
}

function resolveMonth(month, today) {
  const value = month === undefined || month === "" ? today.slice(0, 7) : month;
  const range = monthRange(value);
  if (!range) throw new AppError(422, "Month must look like 2026-10");
  return { month: value, ...range };
}

function parseBoardQuery(query = {}, today) {
  const date = query.date === undefined || query.date === "" ? today : requireIsoDate(query.date);

  let department = null;
  if (query.department !== undefined && query.department !== "") {
    if (typeof query.department !== "string" || !mongoose.isValidObjectId(query.department)) {
      throw new AppError(422, "Department is not valid");
    }
    department = query.department;
  }

  let status = null;
  if (query.status !== undefined && query.status !== "") {
    if (!BOARD_STATUSES.includes(query.status)) {
      throw new AppError(422, `Status must be one of: ${BOARD_STATUSES.join(", ")}`);
    }
    status = query.status;
  }

  let search = "";
  if (query.search !== undefined && query.search !== "") {
    if (typeof query.search !== "string" || query.search.length > 100) {
      throw new AppError(422, "Search text is not valid");
    }
    search = query.search.trim();
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new AppError(422, "Page must be 1 or more");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(422, "Limit must be between 1 and 100");
  }

  return { date, department, status, search, page, limit };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- shapes ----------

function recordView(record, today) {
  if (!record) return null;
  return {
    date: record.date,
    status: deriveDayStatus({ date: record.date, today, record }),
    isLate: record.isLate,
    checkIn: record.checkIn.toISOString(),
    checkOut: record.checkOut ? record.checkOut.toISOString() : null,
    checkInTime: timeStringPk(record.checkIn),
    checkOutTime: record.checkOut ? timeStringPk(record.checkOut) : null,
    workedMinutes: record.workedMinutes,
    corrected: record.corrected,
  };
}

async function approvedLeaveOn(employeeId, date) {
  return LeaveRequest.exists({
    employee: employeeId,
    status: "approved",
    startDate: { $lte: date },
    endDate: { $gte: date },
  });
}

// ---------- employee actions ----------

async function getToday(actor, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const date = dateStringPk(now);
  const calendar = await loadCalendar(date, date);

  const [record, onLeave] = await Promise.all([
    Attendance.findOne({ employee: employee._id, date }),
    approvedLeaveOn(employee._id, date),
  ]);

  return {
    date,
    serverTime: now.toISOString(),
    serverTimeLabel: timeStringPk(now),
    weekend: isWeekend(date, calendar),
    holiday: holidayName(date, calendar),
    onLeave: Boolean(onLeave),
    record: recordView(record, date),
    canCheckIn: !record && !onLeave,
    canCheckOut: Boolean(record && !record.checkOut),
  };
}

async function checkIn(actor, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const date = dateStringPk(now);
  const calendar = await loadCalendar(date, date);

  if (await approvedLeaveOn(employee._id, date)) {
    throw new AppError(409, "You are on approved leave today");
  }
  if (await Attendance.exists({ employee: employee._id, date })) {
    throw new AppError(409, "You have already checked in today");
  }

  const { status, isLate } = computeCheckInStatus(now, calendar.settings, isWorkingDay(date, calendar));

  try {
    const record = await Attendance.create({
      employee: employee._id,
      date,
      checkIn: now,
      status,
      isLate,
      source: "web",
    });
    return recordView(record, date);
  } catch (error) {
    // Two clicks at the same moment: the unique index lets only one through
    if (error.code === 11000) throw new AppError(409, "You have already checked in today");
    throw error;
  }
}

async function checkOut(actor, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  const date = dateStringPk(now);

  const record = await Attendance.findOne({ employee: employee._id, date });
  if (!record) throw new AppError(409, "You have not checked in today");
  if (record.checkOut) throw new AppError(409, "You have already checked out today");

  const calendar = await loadCalendar(date, date);
  const result = computeStatusFromTimes({
    checkIn: record.checkIn,
    checkOut: now,
    settings: calendar.settings,
    workingDay: isWorkingDay(date, calendar),
  });

  record.checkOut = now;
  record.status = result.status;
  record.isLate = result.isLate;
  record.workedMinutes = result.workedMinutes;
  await record.save();

  return recordView(record, date);
}

// ---------- calendar and board ----------

async function buildMonth(employee, monthText, now) {
  const today = dateStringPk(now);
  const { month, from, to } = resolveMonth(monthText, today);

  const [calendar, records, leaves] = await Promise.all([
    loadCalendar(from, to),
    Attendance.find({ employee: employee._id, date: { $gte: from, $lte: to } }),
    LeaveRequest.find({
      employee: employee._id,
      status: "approved",
      startDate: { $lte: to },
      endDate: { $gte: from },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.date, r]));
  const summary = { present: 0, late: 0, half_day: 0, missing_checkout: 0, absent: 0, on_leave: 0, workedMinutes: 0 };

  const days = eachDate(from, to).map((date) => {
    const record = recordMap.get(date) || null;
    const employed = employee.joiningDate <= date && (!employee.exitDate || date <= employee.exitDate);
    const onLeave = leaves.some((l) => l.startDate <= date && l.endDate >= date);

    const status = employed
      ? deriveDayStatus({
          date,
          today,
          record,
          weekend: isWeekend(date, calendar),
          holiday: holidayName(date, calendar),
          onLeave,
        })
      : "not_employed";

    if (status in summary) summary[status] += 1;
    if (record && record.workedMinutes) summary.workedMinutes += record.workedMinutes;

    return {
      date,
      weekday: dayOfWeek(date),
      status,
      holiday: holidayName(date, calendar),
      checkInTime: record ? timeStringPk(record.checkIn) : null,
      checkOutTime: record && record.checkOut ? timeStringPk(record.checkOut) : null,
      workedMinutes: record ? record.workedMinutes : null,
      isLate: record ? record.isLate : false,
      corrected: record ? record.corrected : false,
    };
  });

  return { month, today, days, summary };
}

async function getMyMonth(actor, month, now = new Date()) {
  const employee = await requireOwnEmployee(actor);
  return buildMonth(employee, month, now);
}

async function getEmployeeMonth(employeeId, month, now = new Date()) {
  requireId(employeeId, "Employee");
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new AppError(404, "Employee not found");
  return buildMonth(employee, month, now);
}

async function getBoard(query, now = new Date()) {
  const today = dateStringPk(now);
  const { date, department, status, search, page, limit } = parseBoardQuery(query, today);

  const filter = {
    joiningDate: { $lte: date },
    $or: [{ exitDate: null }, { exitDate: { $gte: date } }],
  };
  if (department) filter.department = department;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$and = [{ $or: [{ name: pattern }, { code: pattern }, { email: pattern }] }];
  }

  const employees = await Employee.find(filter)
    .populate("department", "name")
    .populate("designation", "name")
    .sort({ code: 1 })
    .collation({ locale: "en", numericOrdering: true })
    .limit(2000);

  const ids = employees.map((e) => e._id);
  const [calendar, records, leaves] = await Promise.all([
    loadCalendar(date, date),
    Attendance.find({ date, employee: { $in: ids } }),
    LeaveRequest.find({ status: "approved", startDate: { $lte: date }, endDate: { $gte: date }, employee: { $in: ids } }),
  ]);

  const recordMap = new Map(records.map((r) => [r.employee.toString(), r]));
  const leaveSet = new Set(leaves.map((l) => l.employee.toString()));
  const weekend = isWeekend(date, calendar);
  const holiday = holidayName(date, calendar);

  const summary = Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0]));

  const rows = employees.map((employee) => {
    const record = recordMap.get(employee._id.toString()) || null;
    const rowStatus = deriveDayStatus({
      date,
      today,
      record,
      weekend,
      holiday,
      onLeave: leaveSet.has(employee._id.toString()),
    });
    summary[rowStatus] += 1;

    return {
      employee: {
        id: employee._id.toString(),
        code: employee.code,
        name: employee.name,
        department: employee.department ? employee.department.name : null,
        designation: employee.designation ? employee.designation.name : null,
      },
      status: rowStatus,
      isLate: record ? record.isLate : false,
      checkInTime: record ? timeStringPk(record.checkIn) : null,
      checkOutTime: record && record.checkOut ? timeStringPk(record.checkOut) : null,
      workedMinutes: record ? record.workedMinutes : null,
      corrected: record ? record.corrected : false,
    };
  });

  const filtered = status ? rows.filter((row) => row.status === status) : rows;
  const total = filtered.length;

  return {
    date,
    weekend,
    holiday,
    summary,
    rows: filtered.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = {
  getToday,
  checkIn,
  checkOut,
  getMyMonth,
  getEmployeeMonth,
  getBoard,
  computeCheckInStatus,
  computeStatusFromTimes,
  deriveDayStatus,
  parseBoardQuery,
  resolveMonth,
  recordView,
  BOARD_STATUSES,
};

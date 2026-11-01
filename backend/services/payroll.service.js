const Attendance = require("../models/attendance");
const Company = require("../models/company");
const Employee = require("../models/employee");
const LeaveRequest = require("../models/leaveRequest");
const PayrollRun = require("../models/payrollRun");
const Payslip = require("../models/payslip");
const AppError = require("../utils/appError");
const { logAudit } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { buildPayslipPdf } = require("../utils/pdf");
const { dateStringPk, eachDate, monthRange } = require("../utils/time");
const { loadCalendar, isWorkingDay } = require("./calendar.service");
const { requireId } = require("./employeeScope");
const { computePayslip, sumTotals } = require("./payrollRules");

// Pure function (no database): the month of a payroll run. Future months are not allowed.
function validateRunMonth(body, today) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }
  const range = monthRange(body.month);
  if (!range) throw new AppError(422, "Month must look like 2026-10");
  if (body.month > today.slice(0, 7)) {
    throw new AppError(422, "Payroll cannot be run for a month that has not started");
  }
  return { month: body.month, ...range };
}

const runView = (run) => ({
  id: run._id.toString(),
  month: run.month,
  status: run.status,
  workingDays: run.workingDays,
  employeeCount: run.employeeCount,
  totals: run.totals,
  finalizedAt: run.finalizedAt,
  createdAt: run.createdAt,
});

const payslipView = (p) => ({
  id: p._id.toString(),
  run: p.run && p.run._id ? p.run._id.toString() : String(p.run),
  employeeId: p.employee.toString(),
  month: p.month,
  employee: p.snapshot,
  basic: p.basic,
  hra: p.hra,
  medical: p.medical,
  gross: p.gross,
  workingDays: p.workingDays,
  employedDays: p.employedDays,
  notEmployedDays: p.notEmployedDays,
  absentDays: p.absentDays,
  unpaidDays: p.unpaidDays,
  halfDays: p.halfDays,
  deductionDays: p.deductionDays,
  perDay: p.perDay,
  deductionAmount: p.deductionAmount,
  tax: p.tax,
  net: p.net,
});

// Works out a payslip for every employee who was employed at any time in the month
async function buildPayslips(month, from, to, today) {
  const calendar = await loadCalendar(from, to);
  const workingDates = eachDate(from, to).filter((date) => isWorkingDay(date, calendar));

  const employees = await Employee.find({
    joiningDate: { $lte: to },
    $or: [{ exitDate: null }, { exitDate: { $gte: from } }],
  })
    .populate("department", "name")
    .populate("designation", "name")
    .sort({ code: 1 })
    .collation({ locale: "en", numericOrdering: true });

  const ids = employees.map((e) => e._id);

  const [records, leaves] = await Promise.all([
    Attendance.find({ employee: { $in: ids }, date: { $gte: from, $lte: to } }).select("employee date status"),
    LeaveRequest.find({
      employee: { $in: ids },
      status: "approved",
      startDate: { $lte: to },
      endDate: { $gte: from },
    }).populate("leaveType", "isPaid"),
  ]);

  const recordMap = new Map();
  for (const record of records) {
    const key = record.employee.toString();
    if (!recordMap.has(key)) recordMap.set(key, new Map());
    recordMap.get(key).set(record.date, record.status);
  }

  const leaveMap = new Map();
  for (const leave of leaves) {
    const key = leave.employee.toString();
    if (!leaveMap.has(key)) leaveMap.set(key, new Map());
    const isPaid = leave.leaveType ? leave.leaveType.isPaid : true;
    for (const date of workingDates) {
      if (date >= leave.startDate && date <= leave.endDate) leaveMap.get(key).set(date, { isPaid });
    }
  }

  return {
    workingDays: workingDates.length,
    payslips: employees.map((employee) => ({
      employee: employee._id,
      user: employee.user,
      month,
      snapshot: {
        code: employee.code,
        name: employee.name,
        department: employee.department ? employee.department.name : null,
        designation: employee.designation ? employee.designation.name : null,
      },
      ...computePayslip({
        basicSalary: employee.basicSalary,
        joiningDate: employee.joiningDate,
        exitDate: employee.exitDate,
        workingDates,
        today,
        records: recordMap.get(employee._id.toString()) || new Map(),
        leaves: leaveMap.get(employee._id.toString()) || new Map(),
      }),
    })),
  };
}

async function fillRun(run, month, from, to, today) {
  const { workingDays, payslips } = await buildPayslips(month, from, to, today);
  if (payslips.length === 0) {
    throw new AppError(422, "There are no employees to pay in this month");
  }

  await Payslip.insertMany(payslips.map((p) => ({ ...p, run: run._id })));

  run.workingDays = workingDays;
  run.employeeCount = payslips.length;
  run.totals = sumTotals(payslips);
  await run.save();
}

async function createRun(actor, body, now = new Date()) {
  const today = dateStringPk(now);
  const { month, from, to } = validateRunMonth(body, today);

  const existing = await PayrollRun.findOne({ month });
  if (existing) {
    throw new AppError(
      409,
      existing.status === "finalized"
        ? `Payroll for ${month} is already finalized`
        : `A draft for ${month} already exists. Recalculate it instead.`
    );
  }

  let run;
  try {
    run = await PayrollRun.create({ month, workingDays: 1, createdBy: actor.id });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, `A payroll run for ${month} already exists`);
    throw error;
  }

  try {
    await fillRun(run, month, from, to, today);
  } catch (error) {
    // Nothing half-made is left behind
    await Payslip.deleteMany({ run: run._id });
    await PayrollRun.deleteOne({ _id: run._id });
    throw error;
  }

  await logAudit({
    actor,
    action: "payroll.create",
    entity: "payroll_run",
    entityId: run._id,
    before: null,
    after: { month, status: "draft", employeeCount: run.employeeCount, totals: run.totals },
  });

  return runView(run);
}

async function findDraft(id) {
  requireId(id, "Payroll run");
  const run = await PayrollRun.findById(id);
  if (!run) throw new AppError(404, "Payroll run not found");
  if (run.status === "finalized") throw new AppError(409, "This payroll is finalized and locked");
  return run;
}

async function recalculateRun(actor, id, now = new Date()) {
  const run = await findDraft(id);
  const { from, to } = monthRange(run.month);
  const before = { employeeCount: run.employeeCount, totals: run.totals };

  // Built first, saved after: a failure keeps the old draft
  const today = dateStringPk(now);
  const { workingDays, payslips } = await buildPayslips(run.month, from, to, today);
  if (payslips.length === 0) throw new AppError(422, "There are no employees to pay in this month");

  await Payslip.deleteMany({ run: run._id });
  await Payslip.insertMany(payslips.map((p) => ({ ...p, run: run._id })));

  run.workingDays = workingDays;
  run.employeeCount = payslips.length;
  run.totals = sumTotals(payslips);
  await run.save();

  await logAudit({
    actor,
    action: "payroll.recalculate",
    entity: "payroll_run",
    entityId: run._id,
    before,
    after: { employeeCount: run.employeeCount, totals: run.totals },
  });

  return runView(run);
}

async function deleteRun(actor, id) {
  const run = await findDraft(id);
  const before = { month: run.month, status: run.status, employeeCount: run.employeeCount, totals: run.totals };

  await Payslip.deleteMany({ run: run._id });
  await PayrollRun.deleteOne({ _id: run._id });

  await logAudit({ actor, action: "payroll.delete", entity: "payroll_run", entityId: run._id, before, after: null });
}

async function finalizeRun(actor, id, now = new Date()) {
  const run = await findDraft(id);

  run.status = "finalized";
  run.finalizedBy = actor.id;
  run.finalizedAt = now;
  await run.save();

  await logAudit({
    actor,
    action: "payroll.finalize",
    entity: "payroll_run",
    entityId: run._id,
    before: { status: "draft" },
    after: { status: "finalized", month: run.month, employeeCount: run.employeeCount, totals: run.totals },
  });

  const payslips = await Payslip.find({ run: run._id }).select("user month");
  for (const payslip of payslips) {
    await notify({
      user: payslip.user,
      type: "payslip",
      title: `Your payslip for ${run.month} is ready`,
      message: "You can view and download it now.",
      link: "/my-payslips",
    });
  }

  return runView(run);
}

async function listRuns() {
  const runs = await PayrollRun.find().sort({ month: -1 }).limit(60);
  return runs.map(runView);
}

async function getRun(id) {
  requireId(id, "Payroll run");
  const run = await PayrollRun.findById(id);
  if (!run) throw new AppError(404, "Payroll run not found");

  const payslips = await Payslip.find({ run: run._id })
    .sort({ "snapshot.code": 1 })
    .collation({ locale: "en", numericOrdering: true });

  return { run: runView(run), payslips: payslips.map(payslipView) };
}

// An employee reaches only their own payslips, and only from finalized runs.
// Anything else looks like "not found", so ids cannot be probed.
async function loadPayslipFor(actor, id) {
  requireId(id, "Payslip");
  const payslip = await Payslip.findById(id);
  if (!payslip) throw new AppError(404, "Payslip not found");

  const run = await PayrollRun.findById(payslip.run);
  if (!run) throw new AppError(404, "Payslip not found");

  if (actor.role === "employee") {
    if (payslip.user.toString() !== actor.id || run.status !== "finalized") {
      throw new AppError(404, "Payslip not found");
    }
  }

  return { payslip, run };
}

async function getPayslip(actor, id) {
  const { payslip, run } = await loadPayslipFor(actor, id);
  return { ...payslipView(payslip), runStatus: run.status };
}

async function listMyPayslips(actor) {
  const finalized = await PayrollRun.find({ status: "finalized" }).distinct("_id");
  const payslips = await Payslip.find({ user: actor.id, run: { $in: finalized } }).sort({ month: -1 }).limit(60);
  return payslips.map(payslipView);
}

async function payslipPdf(actor, id) {
  const { payslip, run } = await loadPayslipFor(actor, id);
  const company = await Company.findOne();

  const buffer = buildPayslipPdf({
    payslip,
    companyName: company ? company.name : "HCM Lite",
    draft: run.status !== "finalized",
  });

  return { buffer, filename: `payslip-${payslip.snapshot.code}-${payslip.month}.pdf` };
}

module.exports = {
  createRun,
  recalculateRun,
  deleteRun,
  finalizeRun,
  listRuns,
  getRun,
  getPayslip,
  listMyPayslips,
  payslipPdf,
  validateRunMonth,
};

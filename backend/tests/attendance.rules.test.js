const test = require("node:test");
const assert = require("node:assert");
const a = require("../services/attendance.service");
const c = require("../services/correction.service");
const { validateDecision } = require("../utils/decision");
const { timeOnDatePk } = require("../utils/time");

const settings = { officeStartTime: "09:00", graceMinutes: 15, halfDayHours: 5, weekendDays: [0, 6] };
const at = (hm, date = "2026-10-05") => timeOnDatePk(date, hm);
const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("check-in: on time up to and including 09:15, late after", () => {
  assert.deepStrictEqual(a.computeCheckInStatus(at("08:55"), settings, true), { status: "present", isLate: false });
  assert.strictEqual(a.computeCheckInStatus(at("09:15"), settings, true).isLate, false);
  const justAfter = new Date(at("09:15").getTime() + 1000);
  assert.deepStrictEqual(a.computeCheckInStatus(justAfter, settings, true), { status: "late", isLate: true });
  assert.strictEqual(a.computeCheckInStatus(at("11:00"), settings, true).status, "late");
});

test("check-in: never late on a weekend or holiday", () => {
  assert.strictEqual(a.computeCheckInStatus(at("11:00"), settings, false).status, "present");
});

test("check-in respects other office hours and grace time", () => {
  const custom = { ...settings, officeStartTime: "10:00", graceMinutes: 5 };
  assert.strictEqual(a.computeCheckInStatus(at("10:05"), custom, true).isLate, false);
  assert.strictEqual(a.computeCheckInStatus(at("10:06"), custom, true).isLate, true);
});

test("check-out: under 5 hours is a half day, 5 hours or more keeps the status", () => {
  const short = a.computeStatusFromTimes({ checkIn: at("09:00"), checkOut: at("13:59"), settings, workingDay: true });
  assert.deepStrictEqual(short, { status: "half_day", isLate: false, workedMinutes: 299 });

  const exact = a.computeStatusFromTimes({ checkIn: at("09:00"), checkOut: at("14:00"), settings, workingDay: true });
  assert.deepStrictEqual(exact, { status: "present", isLate: false, workedMinutes: 300 });

  const late = a.computeStatusFromTimes({ checkIn: at("10:00"), checkOut: at("18:00"), settings, workingDay: true });
  assert.deepStrictEqual(late, { status: "late", isLate: true, workedMinutes: 480 });
});

test("check-out: a late employee who leaves early is a half day (and still marked late)", () => {
  const r = a.computeStatusFromTimes({ checkIn: at("10:00"), checkOut: at("12:00"), settings, workingDay: true });
  assert.strictEqual(r.status, "half_day");
  assert.strictEqual(r.isLate, true);
});

test("no check-out yet: status from check-in only, no worked time", () => {
  const r = a.computeStatusFromTimes({ checkIn: at("09:30"), checkOut: null, settings, workingDay: true });
  assert.deepStrictEqual(r, { status: "late", isLate: true, workedMinutes: null });
});

test("deriveDayStatus: record, weekend, holiday, leave, today, past and future", () => {
  const base = { today: "2026-10-07", record: null, weekend: false, holiday: null, onLeave: false };
  const d = (extra) => a.deriveDayStatus({ ...base, date: "2026-10-05", ...extra });
  const done = { checkOut: new Date(), status: "present" };

  assert.strictEqual(d({ record: done }), "present");
  assert.strictEqual(d({ record: { checkOut: new Date(), status: "half_day" } }), "half_day");
  assert.strictEqual(d({ record: { checkOut: null, status: "late" } }), "missing_checkout"); // past day, no check-out
  assert.strictEqual(d({ date: "2026-10-07", record: { checkOut: null, status: "late" } }), "late"); // still working today
  assert.strictEqual(d({}), "absent");
  assert.strictEqual(d({ onLeave: true }), "on_leave");
  assert.strictEqual(d({ weekend: true }), "weekend");
  assert.strictEqual(d({ holiday: "Eid" }), "holiday");
  assert.strictEqual(d({ weekend: true, onLeave: true }), "weekend"); // leave never turns a weekend into leave
  assert.strictEqual(d({ date: "2026-10-07" }), "not_checked_in");
  assert.strictEqual(d({ date: "2026-10-09" }), "upcoming");
  assert.strictEqual(d({ weekend: true, record: done }), "present"); // someone who worked on a weekend
});

test("resolveMonth: default is the current month, bad values are 422", () => {
  assert.strictEqual(a.resolveMonth(undefined, "2026-10-25").month, "2026-10");
  assert.strictEqual(a.resolveMonth("2026-02", "2026-10-25").to, "2026-02-28");
  assert.strictEqual(status(() => a.resolveMonth("2026-13", "2026-10-25")), 422);
});

test("board query: defaults, filters and checks", () => {
  const q = a.parseBoardQuery({}, "2026-10-05");
  assert.strictEqual(q.date, "2026-10-05");
  assert.strictEqual(q.page, 1);
  assert.strictEqual(q.limit, 20);

  const f = a.parseBoardQuery({ date: "2026-10-01", status: "late", department: "507f1f77bcf86cd799439011", limit: "50" }, "2026-10-05");
  assert.strictEqual(f.status, "late");
  assert.strictEqual(f.limit, 50);

  for (const bad of [{ date: "2026-02-30" }, { status: "gone" }, { department: "x" }, { page: "0" }, { limit: "101" }, { search: { a: 1 } }]) {
    assert.strictEqual(status(() => a.parseBoardQuery(bad, "2026-10-05")), 422, JSON.stringify(bad));
  }
});

test("correction input: checks date window, times and reason", () => {
  const today = "2026-10-20";
  const ok = c.validateCorrectionInput({ date: "2026-10-19", checkIn: "09:05", reason: " forgot " }, today);
  assert.deepStrictEqual(ok, { date: "2026-10-19", checkIn: "09:05", checkOut: null, reason: "forgot" });

  for (const bad of [
    { date: "2026-10-21", checkIn: "09:00", reason: "x" }, // future
    { date: "2026-08-01", checkIn: "09:00", reason: "x" }, // older than 60 days
    { date: "2026-10-19", reason: "x" }, // no times
    { date: "2026-10-19", checkIn: "9:00", reason: "x" }, // bad time
    { date: "2026-10-19", checkIn: "09:00", reason: "" }, // no reason
    { date: "2026-02-30", checkIn: "09:00", reason: "x" }, // impossible date
    null,
  ]) {
    assert.strictEqual(status(() => c.validateCorrectionInput(bad, today)), 422, JSON.stringify(bad));
  }
});

test("mergeTimes: needs a check-in, a check-out for past days, and sensible order", () => {
  const now = at("18:00", "2026-10-06");
  const base = { date: "2026-10-05", existing: null, now, today: "2026-10-06" };
  const m = (extra) => c.mergeTimes({ ...base, requestedIn: null, requestedOut: null, ...extra });

  assert.strictEqual(status(() => m({})), 422); // nothing at all
  assert.strictEqual(status(() => m({ requestedIn: at("09:00") })), 422); // past day needs a check-out
  assert.strictEqual(status(() => m({ requestedIn: at("17:00"), requestedOut: at("09:00") })), 422); // out before in
  assert.strictEqual(status(() => m({ requestedIn: at("09:00"), requestedOut: at("17:00", "2026-10-09") })), 422); // future

  const fine = m({ requestedIn: at("09:00"), requestedOut: at("17:30") });
  assert.strictEqual(fine.checkOut.getTime(), at("17:30").getTime());

  // Only the check-out is requested: the saved check-in is kept
  const existing = { checkIn: at("09:10"), checkOut: null };
  const keep = m({ existing, requestedOut: at("17:00") });
  assert.strictEqual(keep.checkIn.getTime(), at("09:10").getTime());

  // Today may stay without a check-out
  const todayOnly = c.mergeTimes({ date: "2026-10-06", requestedIn: at("09:00", "2026-10-06"), requestedOut: null, existing: null, now, today: "2026-10-06" });
  assert.strictEqual(todayOnly.checkOut, null);
});

test("decision body: reject needs a comment", () => {
  assert.deepStrictEqual(validateDecision({ decision: "approved" }), { decision: "approved", comment: "" });
  assert.deepStrictEqual(validateDecision({ decision: "rejected", comment: " no proof " }), { decision: "rejected", comment: "no proof" });
  for (const bad of [{}, { decision: "maybe" }, { decision: "rejected" }, { decision: "rejected", comment: "  " }, { decision: "approved", comment: "x".repeat(301) }, { decision: "approved", comment: 5 }, null]) {
    assert.strictEqual(status(() => validateDecision(bad)), 422, JSON.stringify(bad));
  }
});

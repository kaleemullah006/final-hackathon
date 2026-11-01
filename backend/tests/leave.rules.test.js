const test = require("node:test");
const assert = require("node:assert");
const leave = require("../services/leave.service");
const { countWorkingDays, isWorkingDay } = require("../services/calendar.service");

const TYPE = "507f1f77bcf86cd799439011";
const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

const calendar = (holidays = {}) => ({
  settings: { officeStartTime: "09:00", graceMinutes: 15, halfDayHours: 5, weekendDays: [0, 6] },
  holidayMap: new Map(Object.entries(holidays)),
});

test("working days skip weekends and public holidays", () => {
  // Mon 5 Oct to Sun 11 Oct 2026
  assert.strictEqual(countWorkingDays("2026-10-05", "2026-10-11", calendar()), 5);
  assert.strictEqual(countWorkingDays("2026-10-05", "2026-10-11", calendar({ "2026-10-07": "Holiday" })), 4);
  assert.strictEqual(countWorkingDays("2026-10-10", "2026-10-11", calendar()), 0); // Sat and Sun only
  assert.strictEqual(countWorkingDays("2026-10-05", "2026-10-05", calendar()), 1);
  assert.strictEqual(isWorkingDay("2026-10-07", calendar({ "2026-10-07": "Holiday" })), false);
});

test("a different weekend (Friday and Saturday) is respected", () => {
  const c = calendar();
  c.settings.weekendDays = [5, 6];
  assert.strictEqual(countWorkingDays("2026-10-05", "2026-10-11", c), 5); // Sun to Thu work
  assert.strictEqual(isWorkingDay("2026-10-09", c), false); // Friday
});

test("leave input: valid body", () => {
  const ok = leave.validateLeaveInput({ leaveType: TYPE, startDate: "2026-10-12", endDate: "2026-10-13", reason: " wedding " });
  assert.deepStrictEqual(ok, { leaveType: TYPE, startDate: "2026-10-12", endDate: "2026-10-13", reason: "wedding" });
});

test("leave input: rejects bad type, dates, order, year change and reason", () => {
  const good = { leaveType: TYPE, startDate: "2026-10-12", endDate: "2026-10-13", reason: "x" };
  for (const change of [
    { leaveType: "abc" },
    { leaveType: undefined },
    { startDate: "2026-02-30" },
    { endDate: "13-10-2026" },
    { endDate: "2026-10-11" }, // before start
    { startDate: "2026-12-30", endDate: "2027-01-02" }, // two calendar years
    { reason: "" },
    { reason: "x".repeat(501) },
  ]) {
    assert.strictEqual(status(() => leave.validateLeaveInput({ ...good, ...change })), 422, JSON.stringify(change));
  }
  assert.strictEqual(status(() => leave.validateLeaveInput(null)), 422);
});

test("balance rows: approved and pending are counted per type", () => {
  const types = [
    { _id: "t1", name: "Annual", yearlyQuota: 14, isPaid: true },
    { _id: "t2", name: "Sick", yearlyQuota: 8, isPaid: true },
    { _id: "t3", name: "Unpaid", yearlyQuota: null, isPaid: false },
  ];
  const requests = [
    { leaveType: "t1", status: "approved", days: 3 },
    { leaveType: "t1", status: "pending", days: 2 },
    { leaveType: "t2", status: "approved", days: 8 },
    { leaveType: "t3", status: "approved", days: 20 },
  ];
  const rows = leave.computeBalanceRows(types, requests);

  assert.deepStrictEqual(rows[0], { leaveType: { id: "t1", name: "Annual", isPaid: true }, quota: 14, approved: 3, pending: 2, remaining: 11, available: 9 });
  assert.strictEqual(rows[1].remaining, 0);
  assert.strictEqual(rows[1].available, 0);
  assert.strictEqual(rows[2].remaining, null); // unlimited
  assert.strictEqual(rows[2].available, null);
  assert.strictEqual(rows[2].approved, 20);
});

test("balance rows: a type with no requests has its full quota", () => {
  const rows = leave.computeBalanceRows([{ _id: "t1", name: "Casual", yearlyQuota: 10, isPaid: true }], []);
  assert.strictEqual(rows[0].remaining, 10);
  assert.strictEqual(rows[0].available, 10);
});

test("parseYear: default and checks", () => {
  assert.strictEqual(leave.parseYear(undefined, "2026-10-25"), 2026);
  assert.strictEqual(leave.parseYear("2025", "2026-10-25"), 2025);
  for (const bad of ["abc", "1999", "2101", "2026.5"]) {
    assert.strictEqual(status(() => leave.parseYear(bad, "2026-10-25")), 422, bad);
  }
});

test("leave list query: status, department, paging", () => {
  const q = leave.parseListQuery({ status: "pending", department: "507f1f77bcf86cd799439011", page: "2", limit: "10" });
  assert.strictEqual(q.status, "pending");
  assert.strictEqual(q.page, 2);
  assert.strictEqual(leave.parseListQuery({ status: "all" }).status, null);
  for (const bad of [{ status: "gone" }, { department: "x" }, { page: "0" }, { limit: "0" }, { search: "x".repeat(101) }]) {
    assert.strictEqual(status(() => leave.parseListQuery(bad)), 422, JSON.stringify(bad));
  }
});

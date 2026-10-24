const test = require("node:test");
const assert = require("node:assert");
const { validateLeaveTypeInput } = require("../services/leaveType.service");
const { validateHolidayInput, parseYear } = require("../services/holiday.service");

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("leave type: valid create with quota, and unlimited with null", () => {
  assert.deepStrictEqual(validateLeaveTypeInput({ name: " Annual ", yearlyQuota: 14 }, { partial: false }), {
    name: "Annual",
    yearlyQuota: 14,
  });
  assert.deepStrictEqual(
    validateLeaveTypeInput({ name: "Unpaid", yearlyQuota: null, isPaid: false }, { partial: false }),
    { name: "Unpaid", yearlyQuota: null, isPaid: false }
  );
});

test("leave type: create rejects missing or bad quota and blank name", () => {
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "Sick" }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "Sick", yearlyQuota: -1 }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "Sick", yearlyQuota: 8.5 }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "Sick", yearlyQuota: "8" }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "Sick", yearlyQuota: 400 }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: " ", yearlyQuota: 5 }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ name: "X", yearlyQuota: 5, isPaid: "yes" }, { partial: false })), 422);
});

test("leave type: update accepts partial fields and rejects empty or bad ones", () => {
  assert.deepStrictEqual(validateLeaveTypeInput({ yearlyQuota: 12 }, { partial: true }), { yearlyQuota: 12 });
  assert.deepStrictEqual(validateLeaveTypeInput({ isActive: false }, { partial: true }), { isActive: false });
  assert.strictEqual(status(() => validateLeaveTypeInput({}, { partial: true })), 422);
  assert.strictEqual(status(() => validateLeaveTypeInput({ isActive: "no" }, { partial: true })), 422);
});

test("leave type: isActive is ignored on create", () => {
  assert.deepStrictEqual(
    validateLeaveTypeInput({ name: "Casual", yearlyQuota: 10, isActive: false }, { partial: false }),
    { name: "Casual", yearlyQuota: 10 }
  );
});

test("holiday: valid create", () => {
  assert.deepStrictEqual(validateHolidayInput({ date: "2026-12-25", name: " Christmas " }, { partial: false }), {
    date: "2026-12-25",
    name: "Christmas",
  });
});

test("holiday: rejects bad or impossible dates", () => {
  const bad = ["2026-02-30", "2026-13-01", "26-01-01", "2026/01/01", "2026-1-1", "1999-01-01", "2101-01-01", 20260101, null];
  for (const date of bad) {
    assert.strictEqual(status(() => validateHolidayInput({ date, name: "X" }, { partial: false })), 422, String(date));
  }
  assert.strictEqual(status(() => validateHolidayInput({ date: "2026-01-01" }, { partial: false })), 422);
});

test("holiday: leap day is allowed only in a leap year", () => {
  assert.deepStrictEqual(validateHolidayInput({ date: "2028-02-29", name: "Leap" }, { partial: false }).date, "2028-02-29");
  assert.strictEqual(status(() => validateHolidayInput({ date: "2026-02-29", name: "Leap" }, { partial: false })), 422);
});

test("holiday: update takes date and/or name, rejects empty", () => {
  assert.deepStrictEqual(validateHolidayInput({ name: "Eid" }, { partial: true }), { name: "Eid" });
  assert.strictEqual(status(() => validateHolidayInput({}, { partial: true })), 422);
});

test("parseYear", () => {
  assert.strictEqual(parseYear(undefined), null);
  assert.strictEqual(parseYear("2026"), 2026);
  assert.strictEqual(status(() => parseYear("abc")), 422);
  assert.strictEqual(status(() => parseYear("1900")), 422);
});

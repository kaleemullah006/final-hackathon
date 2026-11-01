const test = require("node:test");
const assert = require("node:assert");
const t = require("../utils/time");

test("dateStringPk and timeStringPk use Pakistan time (UTC+5)", () => {
  const utc = new Date("2026-10-05T20:30:00Z"); // 01:30 the next day in Pakistan
  assert.strictEqual(t.dateStringPk(utc), "2026-10-06");
  assert.strictEqual(t.timeStringPk(utc), "01:30");
  assert.strictEqual(t.dateStringPk(new Date("2026-10-05T04:00:00Z")), "2026-10-05");
});

test("timeOnDatePk is the reverse of timeStringPk", () => {
  const d = t.timeOnDatePk("2026-10-05", "09:15");
  assert.strictEqual(d.toISOString(), "2026-10-05T04:15:00.000Z");
  assert.strictEqual(t.timeStringPk(d), "09:15");
  assert.strictEqual(t.secondsOfDayPk(d), 9 * 3600 + 15 * 60);
});

test("dayOfWeek, addDays and eachDate", () => {
  assert.strictEqual(t.dayOfWeek("2026-10-05"), 1); // Monday
  assert.strictEqual(t.dayOfWeek("2026-10-04"), 0); // Sunday
  assert.strictEqual(t.addDays("2026-10-31", 1), "2026-11-01");
  assert.strictEqual(t.addDays("2026-03-01", -1), "2026-02-28");
  assert.deepStrictEqual(t.eachDate("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepStrictEqual(t.eachDate("2026-10-05", "2026-10-04"), []);
});

test("monthRange handles month lengths and bad input", () => {
  assert.deepStrictEqual(t.monthRange("2026-10"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepStrictEqual(t.monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepStrictEqual(t.monthRange("2027-02"), { from: "2027-02-01", to: "2027-02-28" });
  for (const bad of ["2026-13", "2026-00", "26-10", "2026-1", "", undefined, 5]) {
    assert.strictEqual(t.monthRange(bad), null, String(bad));
  }
});

test("TIME_RE accepts 24-hour HH:mm only", () => {
  for (const ok of ["00:00", "09:15", "23:59"]) assert.ok(t.TIME_RE.test(ok), ok);
  for (const bad of ["24:00", "9:15", "09:60", "09:15:00", "ab:cd"]) assert.ok(!t.TIME_RE.test(bad), bad);
});

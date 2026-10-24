const test = require("node:test");
const assert = require("node:assert");
const { validateSettingsUpdate } = require("../services/settings.service");

const current = {
  name: "Acme",
  officeStartTime: "09:00",
  graceMinutes: 15,
  halfDayHours: 5,
  weekendDays: [0, 6],
  officeLocation: { lat: null, lng: null, radiusMeters: 150 },
};

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("accepts a valid partial update", () => {
  const updates = validateSettingsUpdate({ graceMinutes: 10, officeStartTime: "08:30" }, current);
  assert.deepStrictEqual(updates, { graceMinutes: 10, officeStartTime: "08:30" });
});

test("rejects bad time, grace, half day and weekend values with 422", () => {
  assert.strictEqual(status(() => validateSettingsUpdate({ officeStartTime: "9am" }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ officeStartTime: "25:00" }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ graceMinutes: -1 }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ graceMinutes: "15" }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ halfDayHours: 0 }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ weekendDays: [7] }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ weekendDays: [6, 6] }, current)), 422);
});

test("sorts weekend days", () => {
  const updates = validateSettingsUpdate({ weekendDays: [6, 5] }, current);
  assert.deepStrictEqual(updates.weekendDays, [5, 6]);
});

test("office location: lat and lng must be set together", () => {
  assert.strictEqual(status(() => validateSettingsUpdate({ officeLocation: { lat: 24.86 } }, current)), 422);

  const updates = validateSettingsUpdate(
    { officeLocation: { lat: 24.86, lng: 67.01, radiusMeters: 200 } },
    current
  );
  assert.deepStrictEqual(updates.officeLocation, { lat: 24.86, lng: 67.01, radiusMeters: 200 });
});

test("office location: radius only keeps the existing lat/lng", () => {
  const withLocation = { ...current, officeLocation: { lat: 24.86, lng: 67.01, radiusMeters: 150 } };
  const updates = validateSettingsUpdate({ officeLocation: { radiusMeters: 300 } }, withLocation);
  assert.deepStrictEqual(updates.officeLocation, { lat: 24.86, lng: 67.01, radiusMeters: 300 });
});

test("office location: range checks", () => {
  assert.strictEqual(status(() => validateSettingsUpdate({ officeLocation: { lat: 91, lng: 0 } }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ officeLocation: { radiusMeters: 5 } }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ officeLocation: { radiusMeters: 99999 } }, current)), 422);
});

test("empty body or unknown fields only = 422", () => {
  assert.strictEqual(status(() => validateSettingsUpdate({}, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate({ role: "admin" }, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate(null, current)), 422);
  assert.strictEqual(status(() => validateSettingsUpdate([], current)), 422);
});

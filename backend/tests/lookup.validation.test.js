const test = require("node:test");
const assert = require("node:assert");
const { validateLookupInput } = require("../services/lookup.service");

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("create: trims the name", () => {
  assert.deepStrictEqual(validateLookupInput({ name: "  Engineering " }, { partial: false }), {
    name: "Engineering",
  });
});

test("create: name is required and must be a string", () => {
  assert.strictEqual(status(() => validateLookupInput({}, { partial: false })), 422);
  assert.strictEqual(status(() => validateLookupInput({ name: "   " }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLookupInput({ name: 5 }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLookupInput({ name: "x".repeat(101) }, { partial: false })), 422);
  assert.strictEqual(status(() => validateLookupInput(null, { partial: false })), 422);
});

test("create: isActive in the body is ignored", () => {
  assert.deepStrictEqual(validateLookupInput({ name: "HR", isActive: false }, { partial: false }), { name: "HR" });
});

test("update: name and/or isActive", () => {
  assert.deepStrictEqual(validateLookupInput({ isActive: false }, { partial: true }), { isActive: false });
  assert.deepStrictEqual(validateLookupInput({ name: "Ops", isActive: true }, { partial: true }), {
    name: "Ops",
    isActive: true,
  });
});

test("update: rejects empty body, bad isActive, blank name", () => {
  assert.strictEqual(status(() => validateLookupInput({}, { partial: true })), 422);
  assert.strictEqual(status(() => validateLookupInput({ role: "admin" }, { partial: true })), 422);
  assert.strictEqual(status(() => validateLookupInput({ isActive: "no" }, { partial: true })), 422);
  assert.strictEqual(status(() => validateLookupInput({ name: "" }, { partial: true })), 422);
});

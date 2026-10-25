const test = require("node:test");
const assert = require("node:assert");
const { validateHrInput, validateActiveInput } = require("../services/user.service");

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("HR login: trims the name and lowercases the email", () => {
  assert.deepStrictEqual(validateHrInput({ name: " Hina ", email: " HINA@Example.com " }), {
    name: "Hina",
    email: "hina@example.com",
  });
});

test("HR login: name and a valid email are required", () => {
  assert.strictEqual(status(() => validateHrInput({ email: "a@b.com" })), 422);
  assert.strictEqual(status(() => validateHrInput({ name: "Hina" })), 422);
  assert.strictEqual(status(() => validateHrInput({ name: "Hina", email: "nope" })), 422);
  assert.strictEqual(status(() => validateHrInput(null)), 422);
});

test("HR login: a role or password in the body is ignored", () => {
  const data = validateHrInput({ name: "Hina", email: "h@b.com", role: "admin", password: "x" });
  assert.deepStrictEqual(Object.keys(data).sort(), ["email", "name"]);
});

test("active flag must be a real boolean", () => {
  assert.deepStrictEqual(validateActiveInput({ isActive: false }), { isActive: false });
  assert.deepStrictEqual(validateActiveInput({ isActive: true }), { isActive: true });
  for (const body of [{}, { isActive: "false" }, { isActive: 0 }, null, []]) {
    assert.strictEqual(status(() => validateActiveInput(body)), 422, JSON.stringify(body));
  }
});

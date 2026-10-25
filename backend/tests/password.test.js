const test = require("node:test");
const assert = require("node:assert");
const { generateTempPassword } = require("../utils/password");

test("temp password: 12 characters with upper, lower and a digit, no look-alikes", () => {
  for (let i = 0; i < 200; i++) {
    const password = generateTempPassword();
    assert.strictEqual(password.length, 12);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.doesNotMatch(password, /[0OIl1]/);
  }
});

test("temp password: different every time", () => {
  const set = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
  assert.strictEqual(set.size, 100);
});

test("temp password: respects a longer length", () => {
  assert.strictEqual(generateTempPassword(20).length, 20);
});

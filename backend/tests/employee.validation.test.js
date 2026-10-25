const test = require("node:test");
const assert = require("node:assert");
const { validateEmployeeInput, buildListQuery } = require("../services/employee.service");

const ID = "507f1f77bcf86cd799439011";
const ID2 = "507f1f77bcf86cd799439012";

const valid = () => ({
  name: "  Ali Khan ",
  email: " ALI@Example.com ",
  gender: "male",
  department: ID,
  designation: ID2,
  joiningDate: "2026-01-15",
  basicSalary: 100000,
});

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

test("create: trims, lowercases the email and keeps the job fields", () => {
  const data = validateEmployeeInput(valid(), { mode: "create" });
  assert.strictEqual(data.name, "Ali Khan");
  assert.strictEqual(data.email, "ali@example.com");
  assert.strictEqual(data.basicSalary, 100000);
  assert.strictEqual(data.joiningDate, "2026-01-15");
});

test("create: every required field is checked", () => {
  for (const key of ["name", "email", "gender", "department", "designation", "joiningDate", "basicSalary"]) {
    const body = valid();
    delete body[key];
    assert.strictEqual(status(() => validateEmployeeInput(body, { mode: "create" })), 422, key);
  }
  assert.strictEqual(status(() => validateEmployeeInput(null, { mode: "create" })), 422);
  assert.strictEqual(status(() => validateEmployeeInput([], { mode: "create" })), 422);
});

test("create: rejects bad email, gender, ids, dates and salaries", () => {
  const bad = [
    { email: "not-an-email" },
    { gender: "robot" },
    { department: "abc" },
    { designation: 5 },
    { joiningDate: "2026-02-30" },
    { joiningDate: "15-01-2026" },
    { basicSalary: 0 },
    { basicSalary: -5 },
    { basicSalary: "100000" },
    { basicSalary: Infinity },
    { phone: "12" },
    { phone: "abc-defg-hij" },
    { code: "a b" },
    { code: "x" },
  ];
  for (const change of bad) {
    assert.strictEqual(
      status(() => validateEmployeeInput({ ...valid(), ...change }, { mode: "create" })),
      422,
      JSON.stringify(change)
    );
  }
});

test("create: optional code is uppercased, phone and address are kept", () => {
  const data = validateEmployeeInput(
    { ...valid(), code: "ab-77", phone: "+92 300 1234567", address: " Karachi " },
    { mode: "create" }
  );
  assert.strictEqual(data.code, "AB-77");
  assert.strictEqual(data.phone, "+92 300 1234567");
  assert.strictEqual(data.address, "Karachi");
});

test("create: cannot be registered as exited or with an exit date", () => {
  assert.strictEqual(status(() => validateEmployeeInput({ ...valid(), status: "exited" }, { mode: "create" })), 422);
  assert.strictEqual(
    status(() => validateEmployeeInput({ ...valid(), exitDate: "2026-05-01" }, { mode: "create" })),
    422
  );
  assert.strictEqual(
    validateEmployeeInput({ ...valid(), status: "active" }, { mode: "create" }).status,
    "active"
  );
});

test("update: only the fields sent are checked, empty body is rejected", () => {
  assert.deepStrictEqual(validateEmployeeInput({ basicSalary: 120000 }, { mode: "update" }), { basicSalary: 120000 });
  assert.strictEqual(status(() => validateEmployeeInput({}, { mode: "update" })), 422);
  assert.strictEqual(status(() => validateEmployeeInput({ basicSalary: 0 }, { mode: "update" })), 422);
  assert.strictEqual(status(() => validateEmployeeInput({ status: "gone" }, { mode: "update" })), 422);
});

test("update: status exited and exit date can be set, exit date can be cleared with null", () => {
  assert.deepStrictEqual(
    validateEmployeeInput({ status: "exited", exitDate: "2026-10-20" }, { mode: "update" }),
    { status: "exited", exitDate: "2026-10-20" }
  );
  assert.deepStrictEqual(validateEmployeeInput({ exitDate: null }, { mode: "update" }), { exitDate: null });
});

test("self: only phone and address, anything else is 403", () => {
  assert.deepStrictEqual(
    validateEmployeeInput({ phone: "0300-1234567", address: " Lahore " }, { mode: "self" }),
    { phone: "0300-1234567", address: "Lahore" }
  );
  for (const body of [{ basicSalary: 1 }, { role: "admin" }, { phone: "0300-1234567", status: "active" }, { code: "X1" }]) {
    assert.strictEqual(status(() => validateEmployeeInput(body, { mode: "self" })), 403, JSON.stringify(body));
  }
  assert.strictEqual(status(() => validateEmployeeInput({}, { mode: "self" })), 422);
  assert.strictEqual(status(() => validateEmployeeInput({ phone: "1" }, { mode: "self" })), 422);
});

test("list query: defaults, filters and paging", () => {
  const { filter, page, limit } = buildListQuery({});
  assert.deepStrictEqual(filter, {});
  assert.strictEqual(page, 1);
  assert.strictEqual(limit, 20);

  const q = buildListQuery({ department: ID, status: "active", page: "2", limit: "50" });
  assert.strictEqual(q.filter.department, ID);
  assert.strictEqual(q.filter.status, "active");
  assert.strictEqual(q.page, 2);
  assert.strictEqual(q.limit, 50);
});

test("list query: search text becomes a safe case-insensitive pattern", () => {
  const { filter } = buildListQuery({ search: "a.*" });
  assert.strictEqual(filter.$or.length, 3);
  const pattern = filter.$or[0].name;
  assert.ok(pattern.test("xA.*y"));
  assert.ok(!pattern.test("abc")); // "." and "*" are matched literally, not as a regex
});

test("list query: rejects bad filters and paging", () => {
  for (const query of [
    { status: "gone" },
    { department: "x" },
    { designation: "x" },
    { page: "0" },
    { page: "1.5" },
    { limit: "0" },
    { limit: "101" },
    { limit: "abc" },
    { search: "x".repeat(101) },
    { search: { $ne: "" } },
  ]) {
    assert.strictEqual(status(() => buildListQuery(query)), 422, JSON.stringify(query));
  }
});

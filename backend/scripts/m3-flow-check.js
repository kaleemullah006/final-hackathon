// Live check for M3 (employees + HR logins) against a RUNNING server.
// Usage (local only): node scripts/m3-flow-check.js
// Optional env: BASE_URL (default http://localhost:5000), ADMIN_EMAIL, ADMIN_PASSWORD
// It creates test records with a unique suffix, so it can be run many times.
const BASE = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Test12345";

if (/vercel\.app/i.test(BASE) && process.env.FORCE !== "1") {
  console.error("Refusing to create test data on a live server. Use a local server.");
  process.exit(1);
}

const sfx = Date.now().toString(36);
let total = 0;
let failed = 0;

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, body: json };
}

function check(name, condition, detail) {
  total++;
  if (condition) {
    console.log("PASS  " + name);
  } else {
    failed++;
    console.log("FAIL  " + name + (detail ? "  -> " + JSON.stringify(detail).slice(0, 300) : ""));
  }
}

async function login(email, password) {
  const r = await call("POST", "/auth/login", null, { email, password });
  return r.body && r.body.token;
}

(async () => {
  const A = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!A) {
    console.error("Admin login failed. Check ADMIN_EMAIL / ADMIN_PASSWORD and that the server is running.");
    process.exit(1);
  }

  const dep = (await call("POST", "/departments", A, { name: `Test Dept ${sfx}` })).body.department;
  const dep2 = (await call("POST", "/departments", A, { name: `Test Dept2 ${sfx}` })).body.department;
  const des = (await call("POST", "/designations", A, { name: `Test Role ${sfx}` })).body.designation;

  // HR login (Admin)
  const hrEmail = `hr.${sfx}@test.com`;
  let r = await call("POST", "/users/hr", A, { name: "Test HR", email: hrEmail });
  check("Admin creates HR login", r.status === 201 && r.body.login.tempPassword, r);
  const hrTemp = r.body.login.tempPassword;
  const hrId = r.body.user.id;
  r = await call("POST", "/users/hr", A, { name: "Dup", email: hrEmail.toUpperCase() });
  check("Same HR email again -> 409", r.status === 409, r);

  let H = await login(hrEmail, hrTemp);
  r = await call("GET", "/employees", H);
  check("HR is blocked until the temporary password is changed", r.status === 403 && r.body.code === "PASSWORD_CHANGE_REQUIRED", r);
  await call("POST", "/auth/change-password", H, { currentPassword: hrTemp, newPassword: "HrPass12345" });
  H = await login(hrEmail, "HrPass12345");
  check("HR logs in with the new password", !!H);

  const emp = (extra = {}) => ({
    name: "Ali Khan",
    email: `ali.${sfx}@test.com`,
    gender: "male",
    department: dep.id,
    designation: des.id,
    joiningDate: "2026-01-15",
    basicSalary: 100000,
    phone: "0300-1234567",
    ...extra,
  });

  // Permissions
  r = await call("POST", "/users/hr", H, { name: "x", email: `x.${sfx}@test.com` });
  check("HR cannot create HR login (403)", r.status === 403);
  r = await call("POST", "/employees", A, emp());
  check("Admin cannot register employees (403)", r.status === 403);
  r = await call("POST", "/employees", null, emp());
  check("No token -> 401", r.status === 401);

  // Register
  r = await call("POST", "/employees", H, emp());
  check("HR registers an employee", r.status === 201 && /^EMP-\d{4}$/.test(r.body.employee.code), r);
  const e1 = r.body.employee;
  const e1Temp = r.body.login.tempPassword;
  r = await call("POST", "/employees", H, emp({ name: "Sara", email: `sara.${sfx}@test.com` }));
  check("Second employee gets the next code", r.status === 201 && r.body.employee.code !== e1.code, r);
  const e2 = r.body.employee;
  r = await call("POST", "/employees", H, emp({ email: `ALI.${sfx}@test.com` }));
  check("Duplicate email -> 409", r.status === 409, r);
  r = await call("POST", "/employees", H, emp({ email: `c1.${sfx}@test.com`, code: e1.code }));
  check("Duplicate code -> 409", r.status === 409, r);
  r = await call("POST", "/employees", H, emp({ email: `c2.${sfx}@test.com`, basicSalary: 0 }));
  check("Salary 0 -> 422", r.status === 422);
  r = await call("POST", "/employees", H, emp({ email: `c3.${sfx}@test.com`, joiningDate: "2026-02-30" }));
  check("Impossible date -> 422", r.status === 422);
  r = await call("POST", "/employees", H, emp({ email: `c4.${sfx}@test.com`, department: "507f1f77bcf86cd799439011" }));
  check("Unknown department -> 422", r.status === 422);
  await call("PATCH", `/departments/${dep2.id}`, A, { isActive: false });
  r = await call("POST", "/employees", H, emp({ email: `c5.${sfx}@test.com`, department: dep2.id }));
  check("Inactive department -> 422", r.status === 422);

  // Employee self-service and scope
  let E = await login(`ali.${sfx}@test.com`, e1Temp);
  r = await call("GET", "/employees/me", E);
  check("Employee is blocked until the temporary password is changed", r.status === 403 && r.body.code === "PASSWORD_CHANGE_REQUIRED");
  await call("POST", "/auth/change-password", E, { currentPassword: e1Temp, newPassword: "AliPass12345" });
  E = await login(`ali.${sfx}@test.com`, "AliPass12345");
  r = await call("GET", "/employees/me", E);
  check("Employee reads own profile", r.status === 200 && r.body.employee.id === e1.id, r);
  check("Employee does NOT see the salary", r.body.employee.basicSalary === undefined);
  r = await call("PATCH", "/employees/me", E, { phone: "+92 300 7654321", address: "Karachi" });
  check("Employee edits phone and address", r.status === 200 && r.body.employee.address === "Karachi", r);
  r = await call("PATCH", "/employees/me", E, { basicSalary: 999999 });
  check("Employee cannot edit own salary (403)", r.status === 403, r);
  r = await call("GET", "/employees", E);
  check("Employee cannot list employees (403)", r.status === 403);
  r = await call("GET", `/employees/${e2.id}`, E);
  check("Employee cannot read a colleague (403)", r.status === 403);

  // Directory
  r = await call("GET", `/employees?search=${encodeURIComponent("Sara")}`, H);
  check("Search by name", r.status === 200 && r.body.employees.some((x) => x.id === e2.id), r);
  r = await call("GET", `/employees?department=${dep.id}&limit=1&page=1`, H);
  check("Filter + paging", r.status === 200 && r.body.employees.length === 1 && r.body.total === 2 && r.body.totalPages === 2, r);
  r = await call("GET", `/employees/${e1.id}`, A);
  check("Employee 360 for Admin (salary + login state)", r.status === 200 && r.body.employee.basicSalary === 100000 && r.body.employee.login, r);

  // HR edits
  r = await call("PATCH", `/employees/${e1.id}`, H, { basicSalary: 120000, status: "active" });
  check("HR edits salary and status", r.status === 200 && r.body.employee.basicSalary === 120000, r);
  r = await call("PATCH", `/employees/${e1.id}`, H, { status: "exited" });
  check("Exited needs an exit date -> 422", r.status === 422);
  r = await call("PATCH", `/employees/${e1.id}`, H, { status: "exited", exitDate: "2026-10-20" });
  check("HR marks the employee exited", r.status === 200 && r.body.employee.status === "exited", r);
  check("Exited employee can no longer log in", (await login(`ali.${sfx}@test.com`, "AliPass12345")) === undefined);

  // Admin controls on logins
  const adminId = (await call("GET", "/users?role=admin", A)).body.users[0].id;
  r = await call("PATCH", `/users/${adminId}/active`, A, { isActive: false });
  check("Admin cannot deactivate self (409)", r.status === 409);
  r = await call("PATCH", `/users/${hrId}/active`, A, { isActive: false });
  check("Admin deactivates HR", r.status === 200 && r.body.user.isActive === false);
  r = await call("GET", "/employees", H);
  check("Deactivated HR token stops working (401)", r.status === 401);
  await call("PATCH", `/users/${hrId}/active`, A, { isActive: true });
  r = await call("POST", `/users/${hrId}/reset-password`, A);
  check("Admin resets HR password", r.status === 200 && r.body.login.tempPassword, r);
  const reset = r.body.login.tempPassword;
  check("Old HR password stops working", (await login(hrEmail, "HrPass12345")) === undefined);
  r = await call("POST", "/auth/login", null, { email: hrEmail, password: reset });
  check("Reset password works and forces a change", r.status === 200 && r.body.user.mustChangePassword === true);

  console.log(`\n${total - failed} of ${total} checks passed` + (failed ? `, ${failed} FAILED` : ""));
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error("Script error:", error.message);
  process.exit(2);
});
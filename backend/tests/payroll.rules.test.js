const test = require("node:test");
const assert = require("node:assert");
const r = require("../services/payrollRules");
const payroll = require("../services/payroll.service");
const { buildPayslipPdf } = require("../utils/pdf");
const { eachDate } = require("../utils/time");

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.status;
  }
};

// 22 working days: Mon-Fri from 1 Sep to 30 Sep 2026
const workingDates = eachDate("2026-09-01", "2026-09-30").filter((d) => {
  const day = new Date(`${d}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
});
const allPresent = () => new Map(workingDates.map((d) => [d, "present"]));
const base = { basicSalary: 100000, joiningDate: "2026-01-01", exitDate: null, workingDates, today: "2026-10-05", records: allPresent(), leaves: new Map() };

test("the month used in the tests has 22 working days", () => {
  assert.strictEqual(workingDates.length, 22);
});

test("salary structure: gross = 1.5 x basic, HRA 40%, medical 10%", () => {
  assert.deepStrictEqual(r.salaryStructure(100000), { basic: 100000, hra: 40000, medical: 10000, gross: 150000 });
  assert.strictEqual(r.salaryStructure(33333).gross, 49999.5);
});

test("tax slab: band edges and middle values", () => {
  assert.strictEqual(r.computeAnnualTax(0), 0);
  assert.strictEqual(r.computeAnnualTax(600000), 0);
  assert.strictEqual(r.computeAnnualTax(600001), 0.05);
  assert.strictEqual(r.computeAnnualTax(900000), 15000);
  assert.strictEqual(r.computeAnnualTax(1200000), 30000);
  assert.strictEqual(r.computeAnnualTax(1800000), 120000);
  assert.strictEqual(r.computeAnnualTax(2400000), 210000);
  assert.strictEqual(r.computeAnnualTax(3000000), 360000);
  assert.strictEqual(r.computeAnnualTax(3600000), 510000);
  assert.strictEqual(r.computeAnnualTax(4000000), 650000);
});

test("payslip: full attendance, no deduction, tax on gross x 12", () => {
  const p = r.computePayslip(base);
  assert.strictEqual(p.gross, 150000);
  assert.strictEqual(p.workingDays, 22);
  assert.strictEqual(p.deductionDays, 0);
  assert.strictEqual(p.deductionAmount, 0);
  assert.strictEqual(p.perDay, 6818.18);
  assert.strictEqual(p.annualTax, 120000);
  assert.strictEqual(p.tax, 10000);
  assert.strictEqual(p.net, 140000);
});

test("payslip: absent + unpaid + 0.5 x half days are deducted at gross / working days", () => {
  const records = allPresent();
  records.delete(workingDates[0]); // absent
  records.delete(workingDates[1]); // absent
  records.delete(workingDates[2]); // unpaid leave
  records.set(workingDates[3], "half_day");
  records.set(workingDates[4], "half_day");
  const leaves = new Map([[workingDates[2], { isPaid: false }]]);

  const p = r.computePayslip({ ...base, records, leaves });
  assert.strictEqual(p.absentDays, 2);
  assert.strictEqual(p.unpaidDays, 1);
  assert.strictEqual(p.halfDays, 2);
  assert.strictEqual(p.deductionDays, 4);
  assert.strictEqual(p.deductionAmount, r.round2((150000 / 22) * 4));
  assert.strictEqual(p.net, r.round2(150000 - (150000 / 22) * 4 - 10000));
});

test("payslip: paid leave and late arrivals cost nothing", () => {
  const records = allPresent();
  records.delete(workingDates[5]);
  records.set(workingDates[6], "late");
  const leaves = new Map([[workingDates[5], { isPaid: true }]]);
  const p = r.computePayslip({ ...base, records, leaves });
  assert.strictEqual(p.deductionDays, 0);
});

test("payslip: a joiner is paid only for the days after joining", () => {
  const joiningDate = workingDates[11]; // joins on the 12th working day
  const records = new Map(workingDates.filter((d) => d >= joiningDate).map((d) => [d, "present"]));
  const p = r.computePayslip({ ...base, joiningDate, records });
  assert.strictEqual(p.notEmployedDays, 11);
  assert.strictEqual(p.employedDays, 11);
  assert.strictEqual(p.absentDays, 0);
  assert.strictEqual(p.deductionDays, 11);
  assert.strictEqual(p.deductionAmount, 75000);
});

test("payslip: a leaver is paid only up to the exit date", () => {
  const exitDate = workingDates[9]; // last day is the 10th working day
  const records = new Map(workingDates.filter((d) => d <= exitDate).map((d) => [d, "present"]));
  const p = r.computePayslip({ ...base, exitDate, records });
  assert.strictEqual(p.employedDays, 10);
  assert.strictEqual(p.notEmployedDays, 12);
  assert.strictEqual(p.absentDays, 0);
});

test("payslip: days that have not happened yet, and today, are never absent", () => {
  // The month is still running: today is the 10th working day and nobody has records yet
  const today = workingDates[9];
  const records = new Map(workingDates.filter((d) => d < today).map((d) => [d, "present"]));
  const p = r.computePayslip({ ...base, today, records });
  assert.strictEqual(p.absentDays, 0);
  assert.strictEqual(p.deductionDays, 0);

  // One missed day before today is absent
  records.delete(workingDates[3]);
  assert.strictEqual(r.computePayslip({ ...base, today, records }).absentDays, 1);
});

test("payslip: the deduction never goes above gross and net never below zero", () => {
  const p = r.computePayslip({ ...base, records: new Map(), today: "2026-10-05" });
  assert.strictEqual(p.absentDays, 22);
  assert.strictEqual(p.deductionAmount, 150000);
  assert.strictEqual(p.net, 0);
});

test("payslip: a month with no working days is a 422", () => {
  assert.strictEqual(status(() => r.computePayslip({ ...base, workingDates: [] })), 422);
});

test("run totals add up the payslips", () => {
  const totals = r.sumTotals([
    { gross: 150000, deductionAmount: 1000.5, tax: 10000, net: 138999.5 },
    { gross: 75000, deductionAmount: 0, tax: 0, net: 75000 },
  ]);
  assert.deepStrictEqual(totals, { gross: 225000, deductions: 1000.5, tax: 10000, net: 213999.5 });
});

test("run month: format and no future months", () => {
  const ok = payroll.validateRunMonth({ month: "2026-10" }, "2026-10-25");
  assert.deepStrictEqual(ok, { month: "2026-10", from: "2026-10-01", to: "2026-10-31" });
  assert.strictEqual(payroll.validateRunMonth({ month: "2026-09" }, "2026-10-25").month, "2026-09");
  for (const bad of [{ month: "2026-11" }, { month: "2026-13" }, { month: "" }, {}, null]) {
    assert.strictEqual(status(() => payroll.validateRunMonth(bad, "2026-10-25")), 422, JSON.stringify(bad));
  }
});

test("pdf: a valid single-page file with the payslip text and safe escaping", () => {
  const payslip = {
    month: "2026-10",
    snapshot: { name: "Ali (Khan) \\ \u0639\u0644\u06cc", code: "EMP-0001", department: "Eng", designation: "Dev" },
    basic: 100000, hra: 40000, medical: 10000, gross: 150000, workingDays: 22, perDay: 6818.18,
    deductionDays: 3.5, deductionAmount: 23863.64, tax: 10000, net: 116136.36, absentDays: 2, unpaidDays: 1, halfDays: 1, notEmployedDays: 0,
  };
  const buffer = buildPayslipPdf({ payslip, companyName: "Test Co", draft: true });
  const text = buffer.toString("latin1");

  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.ok(text.includes("EMP-0001"));
  assert.ok(text.includes("116,136.36"));
  assert.ok(text.includes("DRAFT"));
  assert.ok(text.includes("Ali \\(Khan\\) \\\\ ??")); // brackets and backslash escaped, non-Latin letters become ?

  const startxref = Number(text.match(/startxref\n(\d+)\n/)[1]);
  assert.strictEqual(text.slice(startxref, startxref + 4), "xref");
  assert.ok(!buildPayslipPdf({ payslip, companyName: "Test Co", draft: false }).toString("latin1").includes("DRAFT"));
});

const AppError = require("../utils/appError");

// Salary rules from the brief: gross = 1.5 x basic (HRA 40%, medical 10%)
const HRA_RATE = 0.4;
const MEDICAL_RATE = 0.1;
const GROSS_RATE = 1.5;

// Tax slab on gross x 12 (illustrative): [upper limit of the band, base tax, rate above the band start]
const TAX_BANDS = [
  { upTo: 600000, base: 0, rate: 0, from: 0 },
  { upTo: 1200000, base: 0, rate: 0.05, from: 600000 },
  { upTo: 2400000, base: 30000, rate: 0.15, from: 1200000 },
  { upTo: 3600000, base: 210000, rate: 0.25, from: 2400000 },
  { upTo: Infinity, base: 510000, rate: 0.35, from: 3600000 },
];

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function salaryStructure(basic) {
  return {
    basic: round2(basic),
    hra: round2(basic * HRA_RATE),
    medical: round2(basic * MEDICAL_RATE),
    gross: round2(basic * GROSS_RATE),
  };
}

// Yearly tax for a yearly gross
function computeAnnualTax(annualGross) {
  const band = TAX_BANDS.find((b) => annualGross <= b.upTo);
  return round2(band.base + (annualGross - band.from) * band.rate);
}

// Pure function (no database). One employee, one month.
//  workingDates: every working day of the month (weekends and public holidays already removed)
//  records:      Map(date -> stored status) of attendance records
//  leaves:       Map(date -> { isPaid }) for days covered by approved leave
// Days after today are not counted, and today is not counted as absent (the day is not over).
function computePayslip({ basicSalary, joiningDate, exitDate, workingDates, today, records, leaves }) {
  const workingDays = workingDates.length;
  if (workingDays === 0) {
    throw new AppError(422, "This month has no working days");
  }

  const employed = workingDates.filter((date) => date >= joiningDate && (!exitDate || date <= exitDate));
  const notEmployedDays = workingDays - employed.length;

  let absentDays = 0;
  let unpaidDays = 0;
  let halfDays = 0;

  for (const date of employed) {
    if (date > today) continue;

    const status = records.get(date);
    if (status) {
      if (status === "half_day") halfDays += 1;
      continue;
    }

    const leave = leaves.get(date);
    if (leave) {
      if (!leave.isPaid) unpaidDays += 1;
      continue;
    }

    if (date < today) absentDays += 1;
  }

  const structure = salaryStructure(basicSalary);
  const perDay = structure.gross / workingDays;
  const deductionDays = notEmployedDays + absentDays + unpaidDays + 0.5 * halfDays;
  const deductionAmount = round2(Math.min(structure.gross, perDay * deductionDays));

  const annualTax = computeAnnualTax(structure.gross * 12);
  const tax = round2(annualTax / 12);
  const net = round2(Math.max(0, structure.gross - deductionAmount - tax));

  return {
    ...structure,
    workingDays,
    employedDays: employed.length,
    notEmployedDays,
    absentDays,
    unpaidDays,
    halfDays,
    deductionDays,
    perDay: round2(perDay),
    deductionAmount,
    annualTax,
    tax,
    net,
  };
}

// Totals of a whole run
function sumTotals(payslips) {
  const sum = (key) => round2(payslips.reduce((total, p) => total + p[key], 0));
  return { gross: sum("gross"), deductions: sum("deductionAmount"), tax: sum("tax"), net: sum("net") };
}

module.exports = { salaryStructure, computeAnnualTax, computePayslip, sumTotals, round2, TAX_BANDS };

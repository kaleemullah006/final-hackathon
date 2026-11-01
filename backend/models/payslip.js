const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema(
  {
    run: { type: mongoose.Schema.Types.ObjectId, ref: "PayrollRun", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    // The employee's login, so "own payslips only" is a simple check
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: String, required: true },
    // Copied when the run is made, so an old payslip never changes if the employee is edited later
    snapshot: {
      code: String,
      name: String,
      department: String,
      designation: String,
    },
    basic: Number,
    hra: Number,
    medical: Number,
    gross: Number,
    workingDays: Number,
    employedDays: Number,
    notEmployedDays: Number,
    absentDays: Number,
    unpaidDays: Number,
    halfDays: Number,
    deductionDays: Number,
    perDay: Number,
    deductionAmount: Number,
    annualTax: Number,
    tax: Number,
    net: Number,
  },
  { timestamps: true }
);

payslipSchema.index({ run: 1, employee: 1 }, { unique: true });
payslipSchema.index({ user: 1, month: -1 });

module.exports = mongoose.model("Payslip", payslipSchema);

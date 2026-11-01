const mongoose = require("mongoose");

const payrollRunSchema = new mongoose.Schema(
  {
    // "YYYY-MM": one run per month
    month: { type: String, required: true, unique: true },
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    workingDays: { type: Number, required: true },
    employeeCount: { type: Number, default: 0 },
    totals: {
      gross: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayrollRun", payrollRunSchema);

const mongoose = require("mongoose");

const correctionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true },
    // Requested times as real dates (null = keep the existing value)
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, default: "" },
  },
  { timestamps: true }
);

// Only one open request per employee per day
correctionSchema.index(
  { employee: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
correctionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AttendanceCorrection", correctionSchema);

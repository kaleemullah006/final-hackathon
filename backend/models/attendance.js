const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    // "YYYY-MM-DD" in Pakistan time
    date: { type: String, required: true },
    // Set by the server clock, never by the browser
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
    // present, late or half_day. Absent and missing_checkout are worked out when read.
    status: { type: String, enum: ["present", "late", "half_day"], required: true },
    isLate: { type: Boolean, default: false },
    workedMinutes: { type: Number, default: null },
    source: { type: String, enum: ["web", "correction"], default: "web" },
    corrected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One record per employee per day: a second check-in is refused
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);

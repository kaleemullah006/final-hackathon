const mongoose = require("mongoose");

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Days per year. null means unlimited (for example unpaid leave).
    yearlyQuota: { type: Number, default: null, min: 0, max: 365 },
    isPaid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Names are unique ignoring upper/lower case
leaveTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("LeaveType", leaveTypeSchema);

const mongoose = require("mongoose");

// Single document: the company profile and its rules (set by Admin)
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    officeStartTime: { type: String, default: "09:00" },
    graceMinutes: { type: Number, default: 15 },
    halfDayHours: { type: Number, default: 5 },
    weekendDays: { type: [Number], default: [0, 6] }, // 0 = Sunday, 6 = Saturday
    officeLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      radiusMeters: { type: Number, default: 150 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Company", companySchema);

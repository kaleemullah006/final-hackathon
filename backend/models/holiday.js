const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    // Stored as plain text "YYYY-MM-DD" so time zones can never shift the day
    date: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Holiday", holidaySchema);

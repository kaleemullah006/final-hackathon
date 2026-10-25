const mongoose = require("mongoose");

// Small atomic counters (used for employee codes EMP-0001, EMP-0002, ...)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);

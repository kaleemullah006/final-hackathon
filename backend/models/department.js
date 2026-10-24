const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Names are unique ignoring upper/lower case ("IT" and "it" are the same)
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("Department", departmentSchema);

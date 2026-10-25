const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    // The login that belongs to this employee (one login per employee)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "", maxlength: 300 },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: "Designation", required: true },
    // Plain text "YYYY-MM-DD" so time zones can never shift the day
    joiningDate: { type: String, required: true },
    status: { type: String, enum: ["probation", "active", "exited"], default: "probation" },
    exitDate: { type: String, default: null },
    basicSalary: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ designation: 1 });
employeeSchema.index({ name: 1 });

module.exports = mongoose.model("Employee", employeeSchema);

const mongoose = require("mongoose");
const Employee = require("../models/employee");
const User = require("../models/user");
const AppError = require("../utils/appError");

// The employee record is always found from the logged-in user, never from an id sent by the client
async function requireOwnEmployee(actor) {
  const employee = await Employee.findOne({ user: actor.id });
  if (!employee) throw new AppError(404, "No employee record is linked to this login");
  if (employee.status === "exited") throw new AppError(403, "This employee has left the company");
  return employee;
}

function requireId(value, label) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(404, `${label} not found`);
  }
  return value;
}

async function activeHrUserIds() {
  const users = await User.find({ role: "hr", isActive: true }).select("_id");
  return users.map((user) => user._id);
}

module.exports = { requireOwnEmployee, requireId, activeHrUserIds };

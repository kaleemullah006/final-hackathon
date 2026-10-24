const User = require("../models/user");
const Company = require("../models/company");
const AppError = require("../utils/appError");
const { requireString, requireEmail, requirePassword } = require("../utils/validators");
const { hashPassword } = require("./auth.service");
const { logAudit } = require("../utils/audit");

async function getSetupStatus() {
  const userCount = await User.countDocuments({});
  return { needsSetup: userCount === 0 };
}

async function completeSetupService({ companyName, adminName, adminEmail, adminPassword }) {
  const name = requireString(companyName, "Company name");
  const adminDisplayName = requireString(adminName, "Admin name");
  const email = requireEmail(adminEmail);
  requirePassword(adminPassword, "Admin password");

  const { needsSetup } = await getSetupStatus();
  if (!needsSetup) {
    throw new AppError(403, "Setup is already completed");
  }

  const company = await Company.findOneAndUpdate(
    {},
    { name },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const admin = await User.create({
    name: adminDisplayName,
    email,
    password: await hashPassword(adminPassword),
    role: "admin",
    mustChangePassword: false,
  });

  await logAudit({
    actor: { id: admin._id, email: admin.email },
    action: "setup.complete",
    entity: "company",
    entityId: company._id,
    before: null,
    after: { companyName: company.name, adminEmail: admin.email },
  });

  return { companyName: company.name, adminEmail: admin.email };
}

module.exports = { getSetupStatus, completeSetupService };

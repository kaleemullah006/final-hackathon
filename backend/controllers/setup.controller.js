const { getSetupStatus, completeSetupService } = require("../services/setup.service");

const status = async (req, res) => {
  const result = await getSetupStatus();
  res.status(200).json({ success: true, ...result });
};

const complete = async (req, res) => {
  const { companyName, adminName, adminEmail, adminPassword } = req.body || {};
  const result = await completeSetupService({ companyName, adminName, adminEmail, adminPassword });

  res.status(201).json({
    success: true,
    message: "Setup completed. You can now log in as Admin.",
    ...result,
  });
};

module.exports = { status, complete };

const { getSettingsService, updateSettingsService } = require("../services/settings.service");

const getSettings = async (req, res) => {
  const settings = await getSettingsService();
  res.status(200).json({ success: true, settings });
};

const updateSettings = async (req, res) => {
  const settings = await updateSettingsService(req.user, req.body);
  res.status(200).json({ success: true, message: "Settings saved", settings });
};

module.exports = { getSettings, updateSettings };

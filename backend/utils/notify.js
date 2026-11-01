const Notification = require("../models/notification");

// Sends an in-app notification. A failure here must never break the real action.
async function notify({ user, type, title, message = "", link = "" }) {
  try {
    await Notification.create({ user, type, title, message, link });
  } catch (error) {
    console.error("notification failed:", error.message);
  }
}

module.exports = { notify };

const AuditLog = require("../models/auditLog");

// actor: { id, email } (for example req.user). Never put passwords in before/after.
async function logAudit({ actor = null, action, entity, entityId = null, before = null, after = null }) {
  try {
    await AuditLog.create({
      actor: actor ? actor.id : null,
      actorEmail: actor ? actor.email : null,
      action,
      entity,
      entityId,
      before,
      after,
    });
  } catch (error) {
    console.error("audit log failed:", error.message);
  }
}

module.exports = { logAudit };

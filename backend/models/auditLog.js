const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true }, // e.g. "setup.complete"
    entity: { type: String, required: true }, // e.g. "company"
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Audit entries are append-only: block every update and delete.
const blocked = async function () {
  throw new Error("Audit log entries cannot be changed or deleted");
};

[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
].forEach((operation) => auditLogSchema.pre(operation, blocked));

auditLogSchema.pre("deleteOne", { document: true, query: false }, blocked);
auditLogSchema.pre("save", async function () {
  if (!this.isNew) {
    throw new Error("Audit log entries cannot be changed or deleted");
  }
});

module.exports = mongoose.model("AuditLog", auditLogSchema);

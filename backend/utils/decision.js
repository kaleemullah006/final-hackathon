const AppError = require("./appError");

// Body for approve / reject. A reject always needs a comment so the employee knows why.
function validateDecision(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  if (body.decision !== "approved" && body.decision !== "rejected") {
    throw new AppError(422, "Decision must be approved or rejected");
  }

  let comment = "";
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== "string") throw new AppError(422, "Comment must be text");
    comment = body.comment.trim();
    if (comment.length > 300) throw new AppError(422, "Comment is too long (300 characters at most)");
  }

  if (body.decision === "rejected" && !comment) {
    throw new AppError(422, "A comment is required when rejecting");
  }

  return { decision: body.decision, comment };
}

module.exports = { validateDecision };

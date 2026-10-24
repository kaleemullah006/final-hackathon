const express = require("express");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

// Admin and HR can read. Only Admin can create or change. There is no delete:
// a record is switched off with isActive: false so old data keeps its link.
function createLookupRouter(controller) {
  const router = express.Router();

  router.use(authMiddleware);

  router.get("/", authorize("admin", "hr"), controller.list);
  router.post("/", authorize("admin"), controller.create);
  router.patch("/:id", authorize("admin"), controller.update);

  return router;
}

module.exports = { createLookupRouter };

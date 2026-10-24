const express = require("express");
const controller = require("../controllers/leaveType.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

router.get("/", authorize("admin", "hr"), controller.list); // HR can only view
router.post("/", authorize("admin"), controller.create);
router.post("/standard", authorize("admin"), controller.addStandard);
router.patch("/:id", authorize("admin"), controller.update);

module.exports = router;

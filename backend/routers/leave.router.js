const express = require("express");
const controller = require("../controllers/leave.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

// Employee
router.get("/balance", authorize("employee"), controller.myBalance);
router.get("/preview", authorize("employee"), controller.preview);
router.get("/my", authorize("employee"), controller.myLeaves);
router.post("/", authorize("employee"), controller.apply);
router.post("/:id/cancel", authorize("employee"), controller.cancel);

// Admin and HR
router.get("/balance/:employeeId", authorize("admin", "hr"), controller.employeeBalance);
router.get("/", authorize("admin", "hr"), controller.list);

// Only HR decides
router.patch("/:id/decision", authorize("hr"), controller.decide);

module.exports = router;

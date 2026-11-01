const express = require("express");
const controller = require("../controllers/attendance.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

// Employee
router.get("/today", authorize("employee"), controller.today);
router.post("/check-in", authorize("employee"), controller.checkIn);
router.post("/check-out", authorize("employee"), controller.checkOut);
router.get("/my", authorize("employee"), controller.myMonth);
router.post("/corrections", authorize("employee"), controller.createCorrection);
router.get("/corrections/my", authorize("employee"), controller.myCorrections);

// Admin and HR
router.get("/board", authorize("admin", "hr"), controller.board);
router.get("/employee/:id", authorize("admin", "hr"), controller.employeeMonth);
router.get("/corrections", authorize("admin", "hr"), controller.listCorrections);

// Only HR decides
router.patch("/corrections/:id/decision", authorize("hr"), controller.decideCorrection);

module.exports = router;

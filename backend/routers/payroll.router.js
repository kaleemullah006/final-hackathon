const express = require("express");
const controller = require("../controllers/payroll.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

// Admin and HR can see every run and payslip
router.get("/runs", authorize("admin", "hr"), controller.listRuns);
router.get("/runs/:id", authorize("admin", "hr"), controller.getRun);

// Only HR prepares the draft
router.post("/runs", authorize("hr"), controller.createRun);
router.post("/runs/:id/recalculate", authorize("hr"), controller.recalculate);
router.delete("/runs/:id", authorize("hr"), controller.remove);

// Only Admin locks the month
router.post("/runs/:id/finalize", authorize("admin"), controller.finalize);

// Employee: own payslips (finalized only). The service also checks ownership for every id.
router.get("/my", authorize("employee"), controller.myPayslips);
router.get("/payslips/:id", controller.getPayslip);
router.get("/payslips/:id/pdf", controller.payslipPdf);

module.exports = router;

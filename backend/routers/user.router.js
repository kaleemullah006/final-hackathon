const express = require("express");
const controller = require("../controllers/user.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

// Everything here is Admin only
router.use(authMiddleware);
router.use(authorize("admin"));

router.get("/", controller.list);
router.post("/hr", controller.createHr);
router.patch("/:id/active", controller.setActive);
router.post("/:id/reset-password", controller.resetPassword);

module.exports = router;

const express = require("express");
const { getSettings, updateSettings } = require("../controllers/settings.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

router.get("/", authorize("admin", "hr"), getSettings); // HR can only view
router.put("/", authorize("admin"), updateSettings); // only Admin can change

module.exports = router;

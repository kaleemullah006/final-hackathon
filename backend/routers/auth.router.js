const express = require("express");
const { login, me, changePassword } = require("../controllers/auth.controller");
const { authMiddlewareAllowPending } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.get("/me", authMiddlewareAllowPending, me);
router.get("/profile", authMiddlewareAllowPending, me); // kept for the existing profile page
router.post("/change-password", authMiddlewareAllowPending, changePassword);

module.exports = router;

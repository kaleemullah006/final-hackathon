const express = require("express")
const { signup, login } = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth..iddleware")

const router = express.Router()

router.post("/signup",signup)
router.post("/login",login)
router.get("/profile", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Protected profile accessed successfully",
    user: req.user,
  });
});


module.exports = router
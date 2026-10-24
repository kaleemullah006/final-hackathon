const express = require("express");
const controller = require("../controllers/holiday.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

router.get("/", authorize("admin", "hr"), controller.list); // HR can only view
router.post("/", authorize("admin"), controller.create);
router.patch("/:id", authorize("admin"), controller.update);
router.delete("/:id", authorize("admin"), controller.remove);

module.exports = router;

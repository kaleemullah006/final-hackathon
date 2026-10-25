const express = require("express");
const controller = require("../controllers/employee.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(authMiddleware);

// "/me" routes must stay above "/:id", or "me" would be read as an id
router.get("/me", authorize("employee"), controller.getMe);
router.patch("/me", authorize("employee"), controller.updateMe); // phone and address only

router.post("/", authorize("hr"), controller.create);
router.get("/", authorize("admin", "hr"), controller.list);
router.get("/:id", authorize("admin", "hr"), controller.getOne);
router.patch("/:id", authorize("hr"), controller.update);

module.exports = router;

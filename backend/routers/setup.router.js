const express = require("express");
const { status, complete } = require("../controllers/setup.controller");

const router = express.Router();

router.get("/status", status);
router.post("/", complete);

module.exports = router;


require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRouter = require("./routers/auth.router");

const app = express();

app.use(cors());
app.use(express.json());

let dbPromise;

app.use(async (req, res, next) => {
  try {
    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;
    next();
  } catch (error) {
    dbPromise = null;
    console.error("Database connection failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/auth", authRouter);

module.exports = app;

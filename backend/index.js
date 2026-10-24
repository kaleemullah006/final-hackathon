require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRouter = require("./routers/auth.router");
const setupRouter = require("./routers/setup.router");
   const settingsRouter = require("./routers/settings.router");
      const departmentRouter = require("./routers/department.router");
   const designationRouter = require("./routers/designation.router");
      const leaveTypeRouter = require("./routers/leaveType.router");
   const holidayRouter = require("./routers/holiday.router");

const app = express();
app.disable("x-powered-by");

// FRONTEND_URL can hold one or more comma-separated frontend URLs
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    "FRONTEND_URL is not set: CORS is open to every origin. Set it before submission."
  );
}

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "1mb" }));

// Health check: works even if the database is down
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

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

app.use("/setup", setupRouter);
app.use("/auth", authRouter);
   app.use("/settings", settingsRouter);
      app.use("/departments", departmentRouter);
   app.use("/designations", designationRouter);
      app.use("/leave-types", leaveTypeRouter);
   app.use("/holidays", holidayRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Central error handler: never leaks stack traces or internal messages
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err.code === 11000) {
    status = 409;
    message = "A record with this value already exists";
  }

  if (err.type === "entity.parse.failed") {
    message = "Invalid JSON in request body";
  }

  if (status >= 500) {
    console.error(err);
    message = "Something went wrong on the server";
  }

  const body = { success: false, message };
  if (err.errorCode) body.code = err.errorCode;

  res.status(status).json(body);
});

// Start the server only when run directly (npm run dev / node index.js).
// On Vercel the file is imported, so the app is exported instead.
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on port ${port}`));
}

module.exports = app;

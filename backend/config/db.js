const mongoose = require("mongoose");
const dns = require("node:dns");

// Local-only DNS workaround for mongodb+srv lookups. Skipped in production.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("mongodb connected successfully");
};

module.exports = connectDB;

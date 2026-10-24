const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");

function createAuth({ allowPendingPasswordChange }) {
  return async function authMiddleware(req, res, next) {
    const [scheme, token] = (req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Please login again" });
    }

    if (!process.env.SECRET) {
      console.error("SECRET is not configured");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET);
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    if (!decoded.id || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Role and active status always come from the database, not from the token
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Account not found or deactivated" });
    }

    if (user.mustChangePassword && !allowPendingPasswordChange) {
      return res.status(403).json({
        success: false,
        message: "You must change your temporary password first",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };

    return next();
  };
}

module.exports = {
  // normal protected routes
  authMiddleware: createAuth({ allowPendingPasswordChange: false }),
  // only for /me and /change-password (user with a temporary password)
  authMiddlewareAllowPending: createAuth({ allowPendingPasswordChange: true }),
};

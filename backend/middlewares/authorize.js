// Usage: router.get("/x", authMiddleware, authorize("admin", "hr"), handler)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to do this",
      });
    }
    return next();
  };
}

module.exports = authorize;

const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// Limit account creation attempts per IP (or adapt keyGenerator if you prefer per-user)
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit to 3 registrations per window
  message:
    "Too many accounts created from this IP, please try again after an hour",
  // Use ipKeyGenerator helper when available to properly normalize IPv6 addresses
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Login limiter: max failed attempts per email or IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  // Prefer per-email key, fall back to normalized IP for IPv6 safety
  keyGenerator: (req) => (req.body && req.body.email) || ipKeyGenerator(req.ip),
  message: "Too many login attempts, please try again later.",
});

// Attendance submission limiter: per user
const attendanceSubmitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 attempts per minute
  // Use per-user id when available, otherwise use IP (use ipKeyGenerator for IPv6)
  keyGenerator: (req) => (req.user && req.user.id) || ipKeyGenerator(req.ip),
  message:
    "Too many attendance submission attempts. Please wait a moment and try again.",
});

module.exports = {
  createAccountLimiter,
  loginLimiter,
  attendanceSubmitLimiter,
};

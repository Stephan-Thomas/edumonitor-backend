require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

// Connect Database
connectDB();

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use("/api/", limiter);

// Apply stronger per-user/account limits for sensitive auth endpoints
const {
  createAccountLimiter,
  loginLimiter,
} = require("./middleware/rateLimit.middleware");

app.use("/api/auth/register", createAccountLimiter);
app.use("/api/auth/login", loginLimiter);

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/courses", require("./routes/course.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/assessments", require("./routes/assessment.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/reports", require("./routes/report.routes"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;

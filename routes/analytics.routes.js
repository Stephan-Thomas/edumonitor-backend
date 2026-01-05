const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  getRiskAssessment,
  getPerformanceTrends,
  getAttendancePerformanceCorrelation,
  getDepartmentSummary,
} = require("../controllers/analytics.controller");

router.get(
  "/risk-assessment/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getRiskAssessment
);
router.get("/performance-trends/:studentId", protect, getPerformanceTrends);
router.get(
  "/attendance-vs-performance/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getAttendancePerformanceCorrelation
);
router.get(
  "/department-summary/:department",
  protect,
  authorize("admin"),
  getDepartmentSummary
);

module.exports = router;

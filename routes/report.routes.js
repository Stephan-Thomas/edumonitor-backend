const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  generateStudentReportPDF,
  getCoursePerformanceReport,
  getAtRiskStudents,
  getAttendanceSummary,
} = require("../controllers/report.controller");

router.get("/student/:studentId/pdf", protect, generateStudentReportPDF);
router.get(
  "/course/:courseId/performance",
  protect,
  authorize("lecturer", "admin"),
  getCoursePerformanceReport
);
router.get(
  "/at-risk-students/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getAtRiskStudents
);
router.get(
  "/attendance-summary/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getAttendanceSummary
);

module.exports = router;

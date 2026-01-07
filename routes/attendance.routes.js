const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validator.middleware");
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  attendanceSubmitLimiter,
} = require("../middleware/rateLimit.middleware");
const {
  generateCode,
  submitAttendance,
  getSessionAttendance,
  getFlaggedAttendance,
  reviewAttendance,
  getStudentAttendanceStats,
  bulkReviewAttendance,
} = require("../controllers/attendance.controller");

router.post(
  "/generate-code",
  protect,
  authorize("lecturer", "admin"),
  [body("courseId").notEmpty().withMessage("Course ID is required"), validate],
  generateCode
);

router.post(
  "/submit",
  protect,
  authorize("student"),
  attendanceSubmitLimiter,
  [
    body("courseId").notEmpty().withMessage("Course ID is required"),
    body("code")
      .isLength({ min: 6, max: 6 })
      .withMessage("Invalid attendance code"),
    validate,
  ],
  submitAttendance
);

router.get(
  "/session/:courseId/:date",
  protect,
  authorize("lecturer", "admin"),
  getSessionAttendance
);
router.get(
  "/flagged/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getFlaggedAttendance
);
router.put(
  "/:id/review",
  protect,
  authorize("lecturer", "admin"),
  reviewAttendance
);
router.get("/student/:studentId/:courseId", protect, getStudentAttendanceStats);
router.post(
  "/bulk-review",
  protect,
  authorize("lecturer", "admin"),
  bulkReviewAttendance
);

module.exports = router;

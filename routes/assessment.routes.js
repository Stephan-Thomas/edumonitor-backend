const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validator.middleware");
const { protect, authorize } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const {
  createAssessment,
  bulkUploadAssessments,
  getCourseAssessments,
  getStudentAssessments,
  updateAssessment,
  deleteAssessment,
} = require("../controllers/assessment.controller");

router.post(
  "/",
  protect,
  authorize("lecturer", "admin"),
  [
    body("courseId").notEmpty().withMessage("Course ID is required"),
    body("studentId").notEmpty().withMessage("Student ID is required"),
    body("assessmentType").isIn([
      "CA1",
      "CA2",
      "midterm",
      "exam",
      "assignment",
      "project",
    ]),
    body("score").isNumeric().withMessage("Score must be numeric"),
    body("maxScore").isNumeric().withMessage("Max score must be numeric"),
    validate,
  ],
  createAssessment
);

router.post(
  "/bulk-upload",
  protect,
  authorize("lecturer", "admin"),
  upload.single("file"),
  bulkUploadAssessments
);
router.get(
  "/course/:courseId",
  protect,
  authorize("lecturer", "admin"),
  getCourseAssessments
);
router.get("/student/:studentId/:courseId", protect, getStudentAssessments);
router.put("/:id", protect, authorize("lecturer", "admin"), updateAssessment);
router.delete(
  "/:id",
  protect,
  authorize("lecturer", "admin"),
  deleteAssessment
);

module.exports = router;

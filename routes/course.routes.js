const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validator.middleware");
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  enrollStudents,
  getLecturerCourses,
  getStudentCourses,
  selfEnrollInCourse,
  getAvailableCoursesForStudent,
  unenrollFromCourse,
} = require("../controllers/course.controller");

router.post(
  "/",
  protect,
  authorize("admin"),
  [
    body("courseCode").notEmpty().withMessage("Course code is required"),
    body("courseTitle").notEmpty().withMessage("Course title is required"),
    body("department").notEmpty().withMessage("Department is required"),
    body("semester").isIn(["First", "Second"]).withMessage("Invalid semester"),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("creditUnits")
      .isInt({ min: 1, max: 6 })
      .withMessage("Credit units must be 1-6"),
    body("lecturer").notEmpty().withMessage("Lecturer is required"),
    validate,
  ],
  createCourse
);

router.get("/", protect, getAllCourses);
router.get("/:id", protect, getCourseById);
router.put("/:id", protect, authorize("lecturer", "admin"), updateCourse);
router.delete("/:id", protect, authorize("admin"), deleteCourse);
router.post(
  "/:id/enroll",
  protect,
  authorize("lecturer", "admin"),
  enrollStudents
);
router.get("/lecturer/:lecturerId", protect, getLecturerCourses);
router.get("/student/:studentId", protect, getStudentCourses);
router.post("/enroll-self", protect, authorize("student"), selfEnrollInCourse);
router.get(
  "/available",
  protect,
  authorize("student"),
  getAvailableCoursesForStudent
);

module.exports = router;

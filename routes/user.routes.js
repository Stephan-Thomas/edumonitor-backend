const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  getProfile,
  updateProfile,
  getUserById,
  getAllStudents,
  getAllLecturers,
  updateUserStatus,
} = require("../controllers/user.controller");

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.get(
  "/students",
  protect,
  authorize("lecturer", "admin"),
  getAllStudents
);
router.get("/lecturers", protect, authorize("admin"), getAllLecturers);
router.get("/:id", protect, authorize("lecturer", "admin"), getUserById);
router.put("/:id/status", protect, authorize("admin"), updateUserStatus);

module.exports = router;

const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { validate } = require("../middleware/validator.middleware");
const { protect } = require("../middleware/auth.middleware");
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controller");

router.post(
  "/register",
  [
    body("userId").notEmpty().withMessage("User ID is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("department").notEmpty().withMessage("Department is required"),
    validate,
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
    validate,
  ],
  login
);

router.get("/me", protect, (req, res) => {
  res.json({
    user: req.user,
  });
});

router.post("/refresh-token", refreshToken);
router.post("/logout", protect, logout);
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required"), validate],
  forgotPassword
);

router.post(
  "/reset-password/:token",
  [
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    validate,
  ],
  resetPassword
);

module.exports = router;

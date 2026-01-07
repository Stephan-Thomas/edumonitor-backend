const User = require("../models/User.model");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/tokenGenerator");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      middleName,
      department,
      phoneNumber,
      dateOfBirth,
      gender,
      matricNumber, // For students
      lecturerRegistrationNumber, // For lecturers
    } = req.body;

    // Explicitly validate required fields
    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !department ||
      !phoneNumber ||
      !dateOfBirth ||
      !gender
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Role-specific validation
    let userId;
    if (role === "student") {
      if (!matricNumber) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Matric number is required for students",
          });
      }
      userId = matricNumber;
    } else if (role === "lecturer") {
      if (!lecturerRegistrationNumber) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Lecturer registration number is required",
          });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Proof file is required for lecturers",
          });
      }
      userId = lecturerRegistrationNumber;
    } else {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Check if user exists (update query to check email or userId)
    const existingUser = await User.findOne({
      $or: [{ email }, { userId }], // Assuming schema uses 'userId' now
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email or ID" });
    }

    // Create user (update schema to use 'userId' instead of 'matricNumber')
    const user = await User.create({
      userId, // Generic ID field
      email,
      password,
      role: role || "student",
      firstName,
      lastName,
      middleName,
      department,
      phoneNumber,
      dateOfBirth,
      gender,
      proof: req.file ? req.file.path : undefined, // Save file path if uploaded
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        department: user.department,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error); // Log full error with stack trace for debugging
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Internal server error",
      });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user (include password field)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Contact administrator.",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        matricNumber: user.matricNumber,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
        department: user.department,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id);

    res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    res
      .status(403)
      .json({ success: false, message: "Invalid or expired refresh token" });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.refreshToken = undefined;
    await user.save();

    res.json({ success: true, message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No user found with this email" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes

    await user.save();

    // In production, send email with reset link
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/reset-password/${resetToken}`;

    // TODO: Implement email sending
    // await sendEmail({ to: user.email, subject: 'Password Reset', html: resetUrl });

    res.json({
      success: true,
      message: "Password reset email sent",
      resetToken, // Remove in production
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

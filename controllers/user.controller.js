const User = require("../models/User.model");

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      middleName,
      phoneNumber,
      dateOfBirth,
      gender,
      profilePhoto,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (middleName !== undefined) user.middleName = middleName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;
    if (profilePhoto) user.profilePhoto = profilePhoto;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin/Lecturer)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all students
// @route   GET /api/users/students
// @access  Private (Admin/Lecturer)
exports.getAllStudents = async (req, res) => {
  try {
    const { department, search, page = 1, limit = 20 } = req.query;

    const query = { role: "student", isActive: true };

    if (department) {
      query.department = department;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const students = await User.find(query)
      .select("-password -refreshToken")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ firstName: 1 });

    const count = await User.countDocuments(query);

    res.json({
      success: true,
      students,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all lecturers
// @route   GET /api/users/lecturers
// @access  Private (Admin)
exports.getAllLecturers = async (req, res) => {
  try {
    const { department } = req.query;
    const query = { role: "lecturer", isActive: true };

    if (department) {
      query.department = department;
    }

    const lecturers = await User.find(query)
      .select("-password -refreshToken")
      .sort({ firstName: 1 });

    res.json({ success: true, lecturers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user status (activate/deactivate)
// @route   PUT /api/users/:id/status
// @access  Private (Admin)
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// Allows an admin to promote or demote another user's role.
// e.g., promote a lecturer to admin, or demote an admin back to lecturer.
// ============================================================================
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    // Prevent admin from changing their own role
    if (targetUserId === req.user.id) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot change your own role" });
    }

    // Only allow valid roles
    if (!["student", "lecturer", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Don't allow demoting the last admin
    if (user.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot demote the last admin. Promote another user to admin first.",
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to '${role}'`,
      user: {
        id: user._id,
        userId: user.userId,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

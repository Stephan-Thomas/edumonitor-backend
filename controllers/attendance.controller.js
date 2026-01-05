const Attendance = require("../models/Attendance.model");
const Course = require("../models/Course.model");
const { generateAttendanceCode } = require("../utils/attendanceCodeGenerator");
const { isOnCampusNetwork } = require("../utils/ipValidator");

// @desc    Generate attendance code
// @route   POST /api/attendance/generate-code
// @access  Private (Lecturer)
exports.generateCode = async (req, res) => {
  try {
    const { courseId, sessionTopic } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check authorization
    if (
      course.lecturer.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const code = generateAttendanceCode();
    const codeGeneratedAt = new Date();
    const validityDuration =
      course.attendanceCodeSettings.validityDuration || 15;
    const codeExpiresAt = new Date(
      codeGeneratedAt.getTime() + validityDuration * 60000
    );

    // Create attendance records for all enrolled students
    const attendanceRecords = course.enrolledStudents.map((studentId) => ({
      course: courseId,
      student: studentId,
      sessionDate: codeGeneratedAt,
      sessionTopic,
      attendanceCode: code,
      codeGeneratedAt,
      codeExpiresAt,
      verificationStatus: "absent",
    }));

    await Attendance.insertMany(attendanceRecords);

    res.json({
      success: true,
      message: "Attendance code generated",
      code,
      expiresAt: codeExpiresAt,
      validityMinutes: validityDuration,
      studentsCount: course.enrolledStudents.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit attendance
// @route   POST /api/attendance/submit
// @access  Private (Student)
exports.submitAttendance = async (req, res) => {
  try {
    const { courseId, code } = req.body;
    const studentId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = req.headers["user-agent"];

    // Find the attendance record
    const attendance = await Attendance.findOne({
      course: courseId,
      student: studentId,
      attendanceCode: code,
      codeExpiresAt: { $gt: new Date() },
    }).populate("course");

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired attendance code",
      });
    }

    // Check if already submitted
    if (attendance.submissionTime) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Attendance already submitted for this session",
        });
    }

    // Verification checks
    const flagReasons = [];
    const onCampus = isOnCampusNetwork(ipAddress);

    if (!onCampus) {
      flagReasons.push("Submitted from off-campus network");
    }

    // Check for suspiciously fast submission
    const timeSinceCodeGenerated = new Date() - attendance.codeGeneratedAt;
    if (timeSinceCodeGenerated < 5000) {
      // Less than 5 seconds
      flagReasons.push("Unusually fast submission");
    }

    // Check for duplicate submissions from same IP in short time
    const recentSubmissions = await Attendance.countDocuments({
      course: courseId,
      ipAddress,
      submissionTime: { $gte: new Date(Date.now() - 60000) }, // Last minute
    });

    if (recentSubmissions > 5) {
      flagReasons.push("Multiple submissions from same IP");
    }

    // Update attendance
    attendance.submissionTime = new Date();
    attendance.ipAddress = ipAddress;
    attendance.deviceInfo = deviceInfo;
    attendance.flagReasons = flagReasons;
    attendance.verificationStatus =
      flagReasons.length > 0 ? "flagged" : "verified";

    await attendance.save();

    res.json({
      success: true,
      message: "Attendance submitted successfully",
      status: attendance.verificationStatus,
      ...(flagReasons.length > 0 && {
        note: "Your submission has been flagged for review. Your lecturer will verify it.",
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get session attendance (real-time)
// @route   GET /api/attendance/session/:courseId/:date
// @access  Private (Lecturer)
exports.getSessionAttendance = async (req, res) => {
  try {
    const { courseId, date } = req.params;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      course: courseId,
      sessionDate: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("student", "userId firstName lastName profilePhoto")
      .sort({ submissionTime: -1 });

    const stats = {
      total: attendance.length,
      present: attendance.filter((a) =>
        ["verified", "manual-approved"].includes(a.verificationStatus)
      ).length,
      flagged: attendance.filter((a) => a.verificationStatus === "flagged")
        .length,
      absent: attendance.filter((a) => a.verificationStatus === "absent")
        .length,
    };

    res.json({
      success: true,
      attendance,
      stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get flagged attendance records
// @route   GET /api/attendance/flagged/:courseId
// @access  Private (Lecturer)
exports.getFlaggedAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;

    const flagged = await Attendance.find({
      course: courseId,
      verificationStatus: "flagged",
    })
      .populate("student", "userId firstName lastName profilePhoto")
      .populate("course", "courseCode courseTitle")
      .sort({ sessionDate: -1 });

    res.json({
      success: true,
      count: flagged.length,
      flagged,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Review flagged attendance
// @route   PUT /api/attendance/:id/review
// @access  Private (Lecturer)
exports.reviewAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: 'approve' or 'reject'

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    attendance.verificationStatus =
      action === "approve" ? "manual-approved" : "manual-rejected";
    attendance.reviewedBy = req.user.id;
    attendance.reviewNote = note;
    attendance.reviewedAt = new Date();

    await attendance.save();

    res.json({
      success: true,
      message: `Attendance ${action}d successfully`,
      attendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student attendance statistics
// @route   GET /api/attendance/student/:studentId/:courseId
// @access  Private
exports.getStudentAttendanceStats = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    const attendances = await Attendance.find({
      student: studentId,
      course: courseId,
    }).sort({ sessionDate: -1 });

    const totalSessions = attendances.length;
    const presentCount = attendances.filter((a) =>
      ["verified", "manual-approved"].includes(a.verificationStatus)
    ).length;
    const attendancePercentage =
      totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

    res.json({
      success: true,
      statistics: {
        totalSessions,
        presentCount,
        absentCount: totalSessions - presentCount,
        attendancePercentage: attendancePercentage.toFixed(2),
        records: attendances,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk review flagged attendance
// @route   POST /api/attendance/bulk-review
// @access  Private (Lecturer)
exports.bulkReviewAttendance = async (req, res) => {
  try {
    const { attendanceIds, action, note } = req.body;

    const result = await Attendance.updateMany(
      { _id: { $in: attendanceIds } },
      {
        $set: {
          verificationStatus:
            action === "approve" ? "manual-approved" : "manual-rejected",
          reviewedBy: req.user.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} attendance records ${action}d`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

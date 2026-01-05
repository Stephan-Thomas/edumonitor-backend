const RiskAssessment = require("../models/RiskAssessment.model");
const { calculateRiskLevel } = require("../utils/riskCalculator");

// @desc    Calculate and get risk assessment for course
// @route   GET /api/analytics/risk-assessment/:courseId
// @access  Private (Lecturer/Admin)
exports.getRiskAssessment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate("enrolledStudents");
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const riskAssessments = [];

    for (const student of course.enrolledStudents) {
      // Get attendance stats
      const attendances = await Attendance.find({
        course: courseId,
        student: student._id,
      });

      const totalSessions = attendances.length;
      const presentCount = attendances.filter((a) =>
        ["verified", "manual-approved"].includes(a.verificationStatus)
      ).length;
      const attendancePercentage =
        totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

      // Get assessment scores
      const assessments = await Assessment.find({
        course: courseId,
        student: student._id,
      }).sort({ submissionDate: 1 });

      const averageScore =
        assessments.length > 0
          ? assessments.reduce((sum, a) => sum + (a.percentage || 0), 0) /
            assessments.length
          : 0;

      // Calculate risk
      const { riskLevel, factors } = calculateRiskLevel(
        attendancePercentage,
        averageScore,
        assessments
      );

      // Update or create risk assessment
      const riskAssessment = await RiskAssessment.findOneAndUpdate(
        { student: student._id, course: courseId },
        {
          riskLevel,
          attendancePercentage,
          averageScore,
          factors,
          calculatedAt: new Date(),
        },
        { upsert: true, new: true }
      ).populate("student", "userId firstName lastName profilePhoto");

      riskAssessments.push(riskAssessment);
    }

    // Group by risk level
    const summary = {
      low: riskAssessments.filter((r) => r.riskLevel === "low").length,
      medium: riskAssessments.filter((r) => r.riskLevel === "medium").length,
      high: riskAssessments.filter((r) => r.riskLevel === "high").length,
    };

    res.json({
      success: true,
      riskAssessments,
      summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get performance trends for a student
// @route   GET /api/analytics/performance-trends/:studentId
// @access  Private
exports.getPerformanceTrends = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseId } = req.query;

    const query = { student: studentId };
    if (courseId) query.course = courseId;

    const assessments = await Assessment.find(query)
      .populate("course", "courseCode courseTitle")
      .sort({ submissionDate: 1 });

    // Group by course
    const trendsByCourse = {};

    assessments.forEach((assessment) => {
      const courseKey = assessment.course._id.toString();
      if (!trendsByCourse[courseKey]) {
        trendsByCourse[courseKey] = {
          course: assessment.course,
          assessments: [],
        };
      }
      trendsByCourse[courseKey].assessments.push({
        type: assessment.assessmentType,
        score: assessment.score,
        percentage: assessment.percentage,
        date: assessment.submissionDate,
      });
    });

    res.json({
      success: true,
      trends: Object.values(trendsByCourse),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance vs performance correlation
// @route   GET /api/analytics/attendance-vs-performance/:courseId
// @access  Private (Lecturer/Admin)
exports.getAttendancePerformanceCorrelation = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate("enrolledStudents");
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const data = [];

    for (const student of course.enrolledStudents) {
      // Attendance
      const attendances = await Attendance.find({
        course: courseId,
        student: student._id,
      });

      const totalSessions = attendances.length;
      const presentCount = attendances.filter((a) =>
        ["verified", "manual-approved"].includes(a.verificationStatus)
      ).length;
      const attendancePercentage =
        totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

      // Performance
      const assessments = await Assessment.find({
        course: courseId,
        student: student._id,
      });

      const averageScore =
        assessments.length > 0
          ? assessments.reduce((sum, a) => sum + (a.percentage || 0), 0) /
            assessments.length
          : 0;

      data.push({
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
        },
        attendancePercentage: parseFloat(attendancePercentage.toFixed(2)),
        averageScore: parseFloat(averageScore.toFixed(2)),
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get department-wide analytics
// @route   GET /api/analytics/department-summary/:department
// @access  Private (Admin)
exports.getDepartmentSummary = async (req, res) => {
  try {
    const { department } = req.params;

    const courses = await Course.find({ department, isActive: true });
    const students = await User.find({
      department,
      role: "student",
      isActive: true,
    });

    const summary = {
      totalCourses: courses.length,
      totalStudents: students.length,
      atRiskStudents: 0,
      averageAttendance: 0,
    };

    // Get at-risk count
    const atRisk = await RiskAssessment.countDocuments({
      riskLevel: { $in: ["medium", "high"] },
    });

    summary.atRiskStudents = atRisk;

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

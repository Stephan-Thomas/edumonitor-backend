const PDFDocument = require("pdfkit");
const User = require("../models/User.model");
const Course = require("../models/Course.model");
const Attendance = require("../models/Attendance.model");
const Assessment = require("../models/Assessment.model");
const RiskAssessment = require("../models/RiskAssessment.model");

// @desc    Generate student performance report (PDF)
// @route   GET /api/reports/student/:studentId/pdf
// @access  Private
exports.generateStudentReportPDF = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { courseId } = req.query;

    const student = await User.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=student-report-${student.userId}.pdf`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Student Performance Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Name: ${student.fullName}`);
    doc.text(`Student ID: ${student.userId}`);
    doc.text(`Department: ${student.department}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Get courses
    const query = { enrolledStudents: studentId };
    if (courseId) query._id = courseId;

    const courses = await Course.find(query).populate(
      "lecturer",
      "firstName lastName"
    );

    for (const course of courses) {
      doc.fontSize(14).text(`${course.courseCode} - ${course.courseTitle}`, {
        underline: true,
      });
      doc.fontSize(10);

      // Attendance
      const attendances = await Attendance.find({
        course: course._id,
        student: studentId,
      });
      const presentCount = attendances.filter((a) =>
        ["verified", "manual-approved"].includes(a.verificationStatus)
      ).length;
      const attendancePercentage =
        attendances.length > 0 ? (presentCount / attendances.length) * 100 : 0;

      doc.text(
        `Attendance: ${attendancePercentage.toFixed(2)}% (${presentCount}/${
          attendances.length
        })`
      );

      // Assessments
      const assessments = await Assessment.find({
        course: course._id,
        student: studentId,
      });
      doc.text("Assessments:");

      assessments.forEach((assessment) => {
        doc.text(
          `  ${assessment.assessmentType}: ${assessment.score}/${
            assessment.maxScore
          } (${assessment.percentage.toFixed(2)}%)`
        );
      });

      doc.moveDown();
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get course performance report
// @route   GET /api/reports/course/:courseId/performance
// @access  Private (Lecturer/Admin)
exports.getCoursePerformanceReport = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate(
      "enrolledStudents lecturer"
    );
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const studentsData = [];

    for (const student of course.enrolledStudents) {
      // Attendance
      const attendances = await Attendance.find({
        course: courseId,
        student: student._id,
      });
      const presentCount = attendances.filter((a) =>
        ["verified", "manual-approved"].includes(a.verificationStatus)
      ).length;
      const attendancePercentage =
        attendances.length > 0 ? (presentCount / attendances.length) * 100 : 0;

      // Assessments
      const assessments = await Assessment.find({
        course: courseId,
        student: student._id,
      });
      const averageScore =
        assessments.length > 0
          ? assessments.reduce((sum, a) => sum + (a.percentage || 0), 0) /
            assessments.length
          : 0;

      studentsData.push({
        student: {
          userId: student.userId,
          name: `${student.firstName} ${student.lastName}`,
        },
        attendance: attendancePercentage.toFixed(2),
        averageScore: averageScore.toFixed(2),
        assessments: assessments.map((a) => ({
          type: a.assessmentType,
          score: a.score,
          maxScore: a.maxScore,
          percentage: a.percentage.toFixed(2),
        })),
      });
    }

    res.json({
      success: true,
      course: {
        code: course.courseCode,
        title: course.courseTitle,
        lecturer: `${course.lecturer.firstName} ${course.lecturer.lastName}`,
        totalStudents: course.enrolledStudents.length,
      },
      studentsData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get at-risk students list
// @route   GET /api/reports/at-risk-students/:courseId
// @access  Private (Lecturer/Admin)
exports.getAtRiskStudents = async (req, res) => {
  try {
    const { courseId } = req.params;

    const atRiskStudents = await RiskAssessment.find({
      course: courseId,
      riskLevel: { $in: ["medium", "high"] },
    })
      .populate("student", "userId firstName lastName email profilePhoto")
      .sort({ riskLevel: -1, calculatedAt: -1 });

    res.json({
      success: true,
      count: atRiskStudents.length,
      atRiskStudents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance summary report
// @route   GET /api/reports/attendance-summary/:courseId
// @access  Private (Lecturer/Admin)
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { course: courseId };

    if (startDate && endDate) {
      query.sessionDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendances = await Attendance.find(query).populate(
      "student",
      "userId firstName lastName"
    );

    // Group by session date
    const sessionMap = {};

    attendances.forEach((attendance) => {
      const dateKey = attendance.sessionDate.toISOString().split("T")[0];
      if (!sessionMap[dateKey]) {
        sessionMap[dateKey] = {
          date: dateKey,
          topic: attendance.sessionTopic,
          total: 0,
          present: 0,
          flagged: 0,
          absent: 0,
        };
      }

      sessionMap[dateKey].total++;

      if (
        ["verified", "manual-approved"].includes(attendance.verificationStatus)
      ) {
        sessionMap[dateKey].present++;
      } else if (attendance.verificationStatus === "flagged") {
        sessionMap[dateKey].flagged++;
      } else {
        sessionMap[dateKey].absent++;
      }
    });

    res.json({
      success: true,
      sessions: Object.values(sessionMap),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

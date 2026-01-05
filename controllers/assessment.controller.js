const Assessment = require("../models/Assessment.model");
const Course = require("../models/Course.model");
const csv = require("csv-parser");
const fs = require("fs");

// @desc    Create assessment record
// @route   POST /api/assessments
// @access  Private (Lecturer)
exports.createAssessment = async (req, res) => {
  try {
    const { courseId, studentId, assessmentType, score, maxScore, remarks } =
      req.body;

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

    const assessment = await Assessment.create({
      course: courseId,
      student: studentId,
      assessmentType,
      score,
      maxScore,
      remarks,
      enteredBy: req.user.id,
    });

    await assessment.populate("student", "userId firstName lastName");

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      assessment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk upload assessments via CSV
// @route   POST /api/assessments/bulk-upload
// @access  Private (Lecturer)
exports.bulkUploadAssessments = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No CSV file uploaded" });
    }

    const { courseId, assessmentType, maxScore } = req.body;
    const results = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        try {
          const assessments = [];

          for (const row of results) {
            const { userId, score } = row;

            // Find student by userId
            const student = await User.findOne({ userId, role: "student" });

            if (!student) {
              errors.push({ userId, error: "Student not found" });
              continue;
            }

            assessments.push({
              course: courseId,
              student: student._id,
              assessmentType,
              score: parseFloat(score),
              maxScore: parseFloat(maxScore),
              enteredBy: req.user.id,
            });
          }

          if (assessments.length > 0) {
            await Assessment.insertMany(assessments);
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            message: "Bulk upload completed",
            uploaded: assessments.length,
            errors,
          });
        } catch (error) {
          fs.unlinkSync(req.file.path);
          res.status(500).json({ success: false, message: error.message });
        }
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all assessments for a course
// @route   GET /api/assessments/course/:courseId
// @access  Private (Lecturer)
exports.getCourseAssessments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { assessmentType } = req.query;

    const query = { course: courseId };
    if (assessmentType) query.assessmentType = assessmentType;

    const assessments = await Assessment.find(query)
      .populate("student", "userId firstName lastName")
      .sort({ submissionDate: -1 });

    res.json({ success: true, assessments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student assessments for a course
// @route   GET /api/assessments/student/:studentId/:courseId
// @access  Private
exports.getStudentAssessments = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    const assessments = await Assessment.find({
      student: studentId,
      course: courseId,
    })
      .populate("course", "courseCode courseTitle")
      .sort({ submissionDate: -1 });

    // Calculate average
    const totalPercentage = assessments.reduce(
      (sum, a) => sum + (a.percentage || 0),
      0
    );
    const averageScore =
      assessments.length > 0 ? totalPercentage / assessments.length : 0;

    res.json({
      success: true,
      assessments,
      statistics: {
        totalAssessments: assessments.length,
        averageScore: averageScore.toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update assessment
// @route   PUT /api/assessments/:id
// @access  Private (Lecturer)
exports.updateAssessment = async (req, res) => {
  try {
    const { score, maxScore, remarks } = req.body;
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }

    if (score !== undefined) assessment.score = score;
    if (maxScore !== undefined) assessment.maxScore = maxScore;
    if (remarks !== undefined) assessment.remarks = remarks;

    await assessment.save();

    res.json({
      success: true,
      message: "Assessment updated successfully",
      assessment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete assessment
// @route   DELETE /api/assessments/:id
// @access  Private (Lecturer/Admin)
exports.deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndDelete(req.params.id);

    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }

    res.json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

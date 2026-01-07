const Course = require("../models/Course.model");
const User = require("../models/User.model");
const Assessment = require("../models/Assessment.model");
const AcademicSession = require("../models/AcademicSession.model");

// @desc    Create new course
// @route   POST /api/courses
// @access  Private (Admin)
exports.createCourse = async (req, res) => {
  try {
    const {
      courseCode,
      courseTitle,
      department,
      semester,
      academicYear,
      creditUnits,
      lecturer,
    } = req.body;

    // Check if course already exists
    const existingCourse = await Course.findOne({ courseCode, academicYear });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: "Course already exists for this academic year",
      });
    }

    // Verify lecturer exists
    const lecturerUser = await User.findById(lecturer);
    if (!lecturerUser || lecturerUser.role !== "lecturer") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lecturer" });
    }

    const course = await Course.create({
      courseCode,
      courseTitle,
      department,
      semester,
      academicYear,
      creditUnits,
      lecturer,
      attendanceCodeSettings: {
        validityDuration: parseInt(process.env.ATTENDANCE_CODE_VALIDITY) || 15,
        campusIPRanges: process.env.CAMPUS_IP_RANGES?.split(",") || [],
      },
    });

    await course.populate("lecturer", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
exports.getAllCourses = async (req, res) => {
  try {
    const {
      department,
      semester,
      academicYear,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { isActive: true };

    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;

    const courses = await Course.find(query)
      .populate("lecturer", "firstName lastName email")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ courseCode: 1 });

    const count = await Course.countDocuments(query);

    res.json({
      success: true,
      courses,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get course by ID
// @route   GET /api/courses/:id
// @access  Private
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("lecturer", "firstName lastName email department")
      .populate("enrolledStudents", "userId firstName lastName email");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Admin/Lecturer)
exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check authorization
    if (
      req.user.role === "lecturer" &&
      course.lecturer.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const { courseTitle, semester, creditUnits, attendanceCodeSettings } =
      req.body;

    if (courseTitle) course.courseTitle = courseTitle;
    if (semester) course.semester = semester;
    if (creditUnits) course.creditUnits = creditUnits;
    if (attendanceCodeSettings) {
      course.attendanceCodeSettings = {
        ...course.attendanceCodeSettings,
        ...attendanceCodeSettings,
      };
    }

    await course.save();

    res.json({
      success: true,
      message: "Course updated successfully",
      course,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    course.isActive = false;
    await course.save();

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Enroll students in course
// @route   POST /api/courses/:id/enroll
// @access  Private (Admin/Lecturer)
exports.enrollStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Verify all students exist
    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
    });

    if (students.length !== studentIds.length) {
      return res
        .status(400)
        .json({ success: false, message: "Some student IDs are invalid" });
    }

    // Add students who aren't already enrolled
    for (const id of studentIds) {
      if (course.enrolledStudents.includes(id)) continue;

      // Check capacity per student add
      if (
        course.maxStudents &&
        course.enrolledStudents.length >= course.maxStudents
      ) {
        return res.status(400).json({
          success: false,
          message: "Course is full. Maximum capacity reached.",
        });
      }

      // Check prerequisites for each student
      if (course.prerequisites && course.prerequisites.length > 0) {
        const completedCourses = await Assessment.find({
          student: id,
          course: { $in: course.prerequisites },
          percentage: { $gte: 50 },
        }).distinct("course");

        const unmetPrerequisites = course.prerequisites.filter(
          (prereq) => !completedCourses.includes(prereq.toString())
        );

        if (unmetPrerequisites.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Some students have not met prerequisites",
            unmetPrerequisites,
          });
        }
      }

      course.enrolledStudents.push(id);
    }

    await course.save();

    res.json({
      success: true,
      message: "Students enrolled successfully",
      enrolledCount: course.enrolledStudents.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get lecturer's courses
// @route   GET /api/courses/lecturer/:lecturerId
// @access  Private
exports.getLecturerCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      lecturer: req.params.lecturerId,
      isActive: true,
    }).populate("enrolledStudents", "userId firstName lastName");

    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student's enrolled courses
// @route   GET /api/courses/student/:studentId
// @access  Private
exports.getStudentCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      enrolledStudents: req.params.studentId,
      isActive: true,
    }).populate("lecturer", "firstName lastName email");

    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Self-enroll in a course
// @route   POST /api/courses/enroll
// @access  Private (Student)
exports.selfEnrollInCourse = async (req, res) => {
  try {
    const { courseCode } = req.body;
    const studentId = req.user.id;

    const course = await Course.findOne({ courseCode, isActive: true });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check if already enrolled
    if (course.enrolledStudents.includes(studentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Already enrolled in this course" });
    }

    // Check capacity
    if (
      course.maxStudents &&
      course.enrolledStudents.length >= course.maxStudents
    ) {
      return res.status(400).json({
        success: false,
        message: "Course is full. Maximum capacity reached.",
      });
    }

    // Check academic session - only allow enrollment in current session
    const currentSession = await AcademicSession.findOne({ isCurrent: true });
    if (!currentSession) {
      return res
        .status(400)
        .json({ success: false, message: "No active academic session" });
    }

    if (
      course.academicYear !== currentSession.year ||
      course.semester !== currentSession.semester
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll in courses from past/future semesters",
      });
    }

    // Check prerequisites
    if (course.prerequisites && course.prerequisites.length > 0) {
      const completedCourses = await Assessment.find({
        student: studentId,
        course: { $in: course.prerequisites },
        percentage: { $gte: 50 },
      }).distinct("course");

      const unmetPrerequisites = course.prerequisites.filter(
        (prereq) => !completedCourses.includes(prereq.toString())
      );

      if (unmetPrerequisites.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Prerequisites not met",
          unmetPrerequisites,
        });
      }
    }

    course.enrolledStudents.push(studentId);
    await course.save();

    res.json({
      success: true,
      message: "Successfully enrolled in course",
      course,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get available courses for student to enroll
// @route   GET /api/courses/available
// @access  Private (Student)
exports.getAvailableCoursesForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { department, semester, search } = req.query;

    const query = { isActive: true };

    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (search) {
      query.$or = [
        { courseCode: { $regex: search, $options: "i" } },
        { courseTitle: { $regex: search, $options: "i" } },
      ];
    }

    const courses = await Course.find(query)
      .populate("lecturer", "firstName lastName")
      .select(
        "courseCode courseTitle department semester academicYear creditUnits enrolledStudents"
      );

    // Mark which courses student is enrolled in
    const coursesWithEnrollmentStatus = courses.map((course) => ({
      ...course.toObject(),
      isEnrolled: course.enrolledStudents.includes(studentId),
      enrollmentCount: course.enrolledStudents.length,
    }));

    res.json({ success: true, courses: coursesWithEnrollmentStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unenroll from a course
// @route   DELETE /api/courses/:courseId/unenroll
// @access  Private (Student)
exports.unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Check enrollment deadline (add this field to Course model)
    if (course.enrollmentDeadline && new Date() > course.enrollmentDeadline) {
      return res.status(400).json({
        success: false,
        message:
          "Enrollment deadline has passed. Contact lecturer for special permission.",
      });
    }

    course.enrolledStudents = course.enrolledStudents.filter(
      (id) => id.toString() !== studentId
    );
    await course.save();

    res.json({ success: true, message: "Successfully unenrolled from course" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

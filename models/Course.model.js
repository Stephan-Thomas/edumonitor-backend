const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    courseTitle: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    semester: { type: String, enum: ["First", "Second"], required: true },
    academicYear: { type: String, required: true },
    creditUnits: { type: Number, required: true, min: 1, max: 6 },
    lecturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    maxStudents: { type: Number, default: 100 },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    enrollmentDeadline: Date,
    attendanceCodeSettings: {
      validityDuration: { type: Number, default: 15 },
      campusIPRanges: [String],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseSchema.index({ courseCode: 1, academicYear: 1 });
courseSchema.index({ lecturer: 1 });

module.exports = mongoose.model("Course", courseSchema);

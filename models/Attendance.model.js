const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionDate: { type: Date, required: true },
    sessionTopic: { type: String, trim: true },
    attendanceCode: { type: String, required: true },
    codeGeneratedAt: { type: Date, required: true },
    codeExpiresAt: { type: Date, required: true },
    submissionTime: Date,
    verificationStatus: {
      type: String,
      enum: [
        "verified",
        "flagged",
        "absent",
        "manual-approved",
        "manual-rejected",
      ],
      default: "absent",
    },
    ipAddress: String,
    deviceInfo: String,
    flagReasons: [String],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

attendanceSchema.index({ course: 1, sessionDate: 1 });
attendanceSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);

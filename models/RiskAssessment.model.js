const mongoose = require("mongoose");

const riskAssessmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    attendancePercentage: { type: Number, required: true },
    averageScore: { type: Number, required: true },
    factors: [String],
    calculatedAt: { type: Date, default: Date.now },
    notificationSent: { type: Boolean, default: false },
    interventionNotes: String,
  },
  { timestamps: true }
);

riskAssessmentSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model("RiskAssessment", riskAssessmentSchema);

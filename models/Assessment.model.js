const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
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
    assessmentType: {
      type: String,
      enum: ["CA1", "CA2", "midterm", "exam", "assignment", "project"],
      required: true,
    },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true },
    percentage: Number,
    submissionDate: { type: Date, default: Date.now },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    remarks: String,
  },
  { timestamps: true }
);

assessmentSchema.pre("save", function (next) {
  if (this.maxScore > 0) {
    this.percentage = (this.score / this.maxScore) * 100;
  }
  next();
});

assessmentSchema.index({ course: 1, student: 1 });

module.exports = mongoose.model("Assessment", assessmentSchema);

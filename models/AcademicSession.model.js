const mongoose = require("mongoose");

const academicSessionSchema = new mongoose.Schema(
  {
    year: { type: String, required: true }, // e.g., "2024/2025"
    semester: { type: String, enum: ["First", "Second"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    enrollmentStartDate: { type: Date, required: true },
    enrollmentEndDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicSession", academicSessionSchema);

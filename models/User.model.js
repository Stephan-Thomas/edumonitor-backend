const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["admin", "lecturer", "student"],
      default: "student",
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    department: { type: String, required: true },
    profilePhoto: { type: String, default: "default-avatar.png" },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female", "other"] },
    enrollmentDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String, select: false },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual("fullName").get(function () {
  return `${
    this.firstName
  } ${this.middleName ? this.middleName + " " : ""}${this.lastName}`;
});

userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);

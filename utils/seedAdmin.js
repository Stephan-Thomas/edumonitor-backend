// ============================================================================
// FILE: utils/seedAdmin.js
// ============================================================================
// Run this ONCE to create the initial admin account.
// Usage: node utils/seedAdmin.js
// After the first admin exists, this script will refuse to run again.
// ============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.model");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if an admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("⚠️  Admin account already exists.");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log("   Skipping seed. Disconnecting...");
      await mongoose.disconnect();
      return;
    }

    // Create the admin
    const admin = await User.create({
      userId: "ADMIN-001",
      email: process.env.ADMIN_EMAIL || "admin@edumonitor.com",
      password: process.env.ADMIN_PASSWORD || "Admin@12345",
      role: "admin",
      firstName: "System",
      lastName: "Administrator",
      department: "Administration",
      phoneNumber: "0000000000",
      isActive: true,
    });

    console.log("✅ Admin account created successfully!");
    console.log(`   ID:         ${admin._id}`);
    console.log(`   Email:      ${admin.email}`);
    console.log(
      `   Password:   ${process.env.ADMIN_PASSWORD || "Admin@12345"}`,
    );
    console.log("");
    console.log("⚡ Change the password after your first login!");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();

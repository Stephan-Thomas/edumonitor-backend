const crypto = require("crypto");

exports.generateAttendanceCode = () => {
  // Generate cryptographically secure 6-digit code
  const code = crypto.randomInt(100000, 1000000).toString();
  return code;
};

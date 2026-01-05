exports.isOnCampusNetwork = (ipAddress) => {
  if (!ipAddress) return false;

  const campusRanges = process.env.CAMPUS_IP_RANGES?.split(",") || [];

  return campusRanges.some((range) => {
    const [baseIP] = range.split("/");
    const baseSegments = baseIP.split(".").slice(0, 2).join(".");
    return ipAddress.startsWith(baseSegments);
  });
};

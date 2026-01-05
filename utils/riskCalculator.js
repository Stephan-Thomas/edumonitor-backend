exports.calculateRiskLevel = (
  attendancePercentage,
  averageScore,
  assessments = []
) => {
  const factors = [];
  let riskLevel = "low";

  // High risk conditions
  if (attendancePercentage < 60 && averageScore < 50) {
    riskLevel = "high";
    factors.push("Low attendance with poor performance");
  } else if (attendancePercentage < 40) {
    riskLevel = "high";
    factors.push("Critically low attendance");
  }

  // Check consecutive failures
  if (assessments.length >= 2) {
    const recentScores = assessments.slice(-2).map((a) => a.percentage);
    if (recentScores.every((score) => score < 50)) {
      riskLevel = "high";
      factors.push("Multiple consecutive failures");
    }
  }

  // Medium risk
  if (riskLevel !== "high") {
    if (
      attendancePercentage >= 60 &&
      attendancePercentage < 75 &&
      averageScore < 60
    ) {
      riskLevel = "medium";
      factors.push("Moderate attendance with declining performance");
    }
  }

  // Low risk default
  if (riskLevel === "low") {
    factors.push("Good attendance and performance");
  }

  return { riskLevel, factors };
};

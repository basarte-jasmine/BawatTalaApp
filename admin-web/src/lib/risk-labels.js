export const RISK_LEVEL_LABELS = {
  NONE: "Balanced / Stable",
  LOW: "Distressed / Needs Support",
  HIGH: "Crisis / Critical Need",
  CRITICAL: "Crisis / Critical Need",
  MEDIUM: "Distressed / Needs Support",
  MODERATE: "Distressed / Needs Support",
};

export function normalizeRiskLevel(value) {
  return String(value || "NONE").trim().toUpperCase();
}

export function getRiskLevelLabel(value) {
  return RISK_LEVEL_LABELS[normalizeRiskLevel(value)] || RISK_LEVEL_LABELS.NONE;
}

export function getRiskBadgeClasses(value) {
  const riskLevel = normalizeRiskLevel(value);
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (riskLevel === "MEDIUM" || riskLevel === "MODERATE" || riskLevel === "LOW") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

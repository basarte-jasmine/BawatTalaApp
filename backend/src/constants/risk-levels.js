const RISK_LEVEL_LABELS = {
  NONE: "Balanced / Stable",
  LOW: "Distressed / Needs Support",
  HIGH: "Crisis / Critical Need",
};

function normalizeRiskTriggerPhrase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeRiskTriggerLevel(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized === "HIGH" || normalized === "LOW" ? normalized : "";
}

function getRiskLevelLabel(value) {
  return RISK_LEVEL_LABELS[String(value || "NONE").trim().toUpperCase()] || RISK_LEVEL_LABELS.NONE;
}

module.exports = {
  RISK_LEVEL_LABELS,
  getRiskLevelLabel,
  normalizeRiskTriggerLevel,
  normalizeRiskTriggerPhrase,
};

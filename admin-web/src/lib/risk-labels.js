export const RISK_LEVEL_LABELS = {
  NONE: "Balanced / Stable",
  LOW: "Emotional Distress",
  HIGH: "Well-being Risk Indicator",
  CRITICAL: "Well-being Risk Indicator",
  MEDIUM: "Emotional Distress",
  MODERATE: "Emotional Distress",
  DISTRESSED: "Emotional Distress",
  DISTRESS: "Emotional Distress",
};

/** Shared two-phase signal (Mobile / Full-Stack / Admin). */
export const RISK_SIGNAL = {
  NONE: "NONE",
  DISTRESS: "DISTRESS",
  CRITICAL: "CRITICAL",
};

/** Shared safetyStatus enum. */
export const SAFETY_STATUS = {
  NOT_NEEDED: "NOT_NEEDED",
  CLARIFICATION_NEEDED: "CLARIFICATION_NEEDED",
  CONFIRMED_CRITICAL: "CONFIRMED_CRITICAL",
  CLEARED: "CLEARED",
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
  if (
    riskLevel === "MEDIUM" ||
    riskLevel === "MODERATE" ||
    riskLevel === "LOW" ||
    riskLevel === "DISTRESSED" ||
    riskLevel === "DISTRESS"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function normalizeSignal(entryOrValue) {
  const raw =
    typeof entryOrValue === "string" || entryOrValue == null
      ? entryOrValue
      : entryOrValue?.emotionalDistressSignal ??
        entryOrValue?.emotional_distress_signal ??
        entryOrValue?.signal;
  const value = String(raw || "").trim().toUpperCase();
  if (!value) return "";
  if (value === "DISTRESSED") return RISK_SIGNAL.DISTRESS;
  if (value === "HIGH" || value === "CRISIS") return RISK_SIGNAL.CRITICAL;
  return value;
}

export function normalizeSafetyStatus(entryOrValue) {
  const raw =
    typeof entryOrValue === "string" || entryOrValue == null
      ? entryOrValue
      : entryOrValue?.safetyStatus ?? entryOrValue?.safety_status;
  const value = String(raw || "").trim().toUpperCase();
  if (!value) return "";
  if (value === "CLARIFICATION" || value === "NEEDS_CLARIFICATION") {
    return SAFETY_STATUS.CLARIFICATION_NEEDED;
  }
  // Locked enum only: NOT_NEEDED | CLARIFICATION_NEEDED | CONFIRMED_CRITICAL | CLEARED
  return value;
}

export function isClarificationSafetyStatus(entryOrValue) {
  return normalizeSafetyStatus(entryOrValue) === SAFETY_STATUS.CLARIFICATION_NEEDED;
}

export function isConfirmedCriticalSafetyStatus(entryOrValue) {
  return normalizeSafetyStatus(entryOrValue) === SAFETY_STATUS.CONFIRMED_CRITICAL;
}

/** @deprecated use isConfirmedCriticalSafetyStatus */
export function isConfirmedSafetyStatus(entryOrValue) {
  return isConfirmedCriticalSafetyStatus(entryOrValue);
}

export function getSafetyStatusLabel(entryOrValue) {
  const status = normalizeSafetyStatus(entryOrValue);
  // Locked enum badges only — NOT_NEEDED / missing → no badge.
  if (status === SAFETY_STATUS.CLARIFICATION_NEEDED) return "Needs clarification";
  if (status === SAFETY_STATUS.CONFIRMED_CRITICAL) return "Confirmed risk";
  if (status === SAFETY_STATUS.CLEARED) {
    // No crisis badge; soft Emotional Distress only when signal is DISTRESS.
    return normalizeSignal(entryOrValue) === RISK_SIGNAL.DISTRESS ? "Emotional Distress" : "";
  }
  if (status === SAFETY_STATUS.NOT_NEEDED) return "";
  return "";
}

/** Longer copy for Flag Details (CLEARED still named when no DISTRESS soft badge). */
export function getSafetyStatusDetailLabel(entryOrValue) {
  const status = normalizeSafetyStatus(entryOrValue);
  if (status === SAFETY_STATUS.CLARIFICATION_NEEDED) return "Needs clarification";
  if (status === SAFETY_STATUS.CONFIRMED_CRITICAL) return "Confirmed risk (Critical Case)";
  if (status === SAFETY_STATUS.CLEARED) {
    return normalizeSignal(entryOrValue) === RISK_SIGNAL.DISTRESS
      ? "Cleared — Emotional Distress"
      : "Cleared";
  }
  if (status === SAFETY_STATUS.NOT_NEEDED) return "Not needed";
  return "";
}

export function getSignalLabel(entryOrValue) {
  const signal = normalizeSignal(entryOrValue);
  if (signal === RISK_SIGNAL.CRITICAL) return "Well-being Risk Indicator";
  if (signal === RISK_SIGNAL.DISTRESS) return "Emotional Distress";
  return "";
}

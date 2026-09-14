export const RISK_LEVEL_LABELS = {
  NONE: "Balanced / Stable",
  LOW: "Emotional Distress",
  HIGH: "Urgent",
  CRITICAL: "Urgent",
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
  if (status === SAFETY_STATUS.CLARIFICATION_NEEDED) return "Needs clarification";
  if (status === SAFETY_STATUS.CONFIRMED_CRITICAL) return "Confirmed risk";
  if (status === SAFETY_STATUS.CLEARED) {
    return normalizeSignal(entryOrValue) === RISK_SIGNAL.DISTRESS ? "Emotional Distress" : "";
  }
  if (status === SAFETY_STATUS.NOT_NEEDED) return "";
  return "";
}

/** Longer copy for Flag Details (CLEARED still named when no DISTRESS soft badge). */
export function getSafetyStatusDetailLabel(entryOrValue) {
  const status = normalizeSafetyStatus(entryOrValue);
  if (status === SAFETY_STATUS.CLARIFICATION_NEEDED) return "Needs clarification";
  if (status === SAFETY_STATUS.CONFIRMED_CRITICAL) return "Confirmed risk";
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
  if (signal === RISK_SIGNAL.CRITICAL) return "Urgent";
  if (signal === RISK_SIGNAL.DISTRESS) return "Emotional Distress";
  return "";
}

export const SAFETY_INDICATOR_CATEGORIES = {
  SELF_HARM: "SELF_HARM",
  ABUSE: "ABUSE",
  GROOMING: "GROOMING",
  COERCION_BLACKMAIL: "COERCION_BLACKMAIL",
  BULLYING_HARASSMENT: "BULLYING_HARASSMENT",
  THREAT_VIOLENCE: "THREAT_VIOLENCE",
  UNSAFE_ENVIRONMENT: "UNSAFE_ENVIRONMENT",
  SUBSTANCE: "SUBSTANCE",
  EMOTIONAL_DISTRESS: "EMOTIONAL_DISTRESS",
  EXPRESSION_HYPERBOLE: "EXPRESSION_HYPERBOLE",
  CONFIRMATION_SIGNAL: "CONFIRMATION_SIGNAL",
  OTHER: "OTHER",

  // Legacy mappings:
  CRITICAL_LITERAL: "CRITICAL_LITERAL",
  CRITICAL_AMBIGUOUS: "CRITICAL_AMBIGUOUS",
  DISTRESS: "DISTRESS",
  DENY_HYPERBOLE: "DENY_HYPERBOLE",
  CONFIRM_LITERAL: "CONFIRM_LITERAL",
};

export const SAFETY_INDICATOR_CATEGORY_LABELS = {
  SELF_HARM: "Self-Harm / Suicide Concern",
  ABUSE: "Abuse / Domestic Harm",
  GROOMING: "Grooming & Child Exploitation",
  COERCION_BLACKMAIL: "Coercion, Blackmail & Extortion",
  BULLYING_HARASSMENT: "Bullying & Harassment",
  THREAT_VIOLENCE: "Threats & Violence",
  UNSAFE_ENVIRONMENT: "Unsafe Environment & Neglect",
  SUBSTANCE: "Substance & Addiction Concern",
  EMOTIONAL_DISTRESS: "Emotional Distress & Overwhelm",
  EXPRESSION_HYPERBOLE: "Expression & Hyperbole Filter",
  CONFIRMATION_SIGNAL: "Confirmation Signal",
  OTHER: "General Safeguarding Indicator",

  // Legacy mappings:
  CRITICAL_LITERAL: "Urgent Intent (Critical)",
  CRITICAL_AMBIGUOUS: "Ambiguous Concern",
  DISTRESS: "Emotional Distress",
  DENY_HYPERBOLE: "Hyperbole & Expression Filter",
  CONFIRM_LITERAL: "Confirmation Signal",
};

export const SAFETY_INDICATOR_CATEGORY_DESCRIPTIONS = {
  SELF_HARM: "Direct or ambiguous statements indicating thoughts of self-harm or suicide. Evaluated via Two-Phase clarification.",
  ABUSE: "Statements describing physical, emotional, or domestic abuse at home, school, or relationships.",
  GROOMING: "Suspicious adult-student boundaries, secrecy demands ('keep our chat secret'), inappropriate gifts, or requests to meet alone.",
  COERCION_BLACKMAIL: "Extortion, blackmail, coercion ('threatening to leak my photos', forcing payments/favors).",
  BULLYING_HARASSMENT: "Repeated humiliation, malicious exclusion, targeted online harassment, or severe peer pressure.",
  THREAT_VIOLENCE: "Direct threats of violence or harm from or toward another individual.",
  UNSAFE_ENVIRONMENT: "Unsafe living conditions, domestic hostility, homelessness, or severe neglect.",
  SUBSTANCE: "Concerns regarding substance misuse, forced intoxication, or dependency.",
  EMOTIONAL_DISTRESS: "Severe emotional overwhelm, burnout, chronic stress, or feeling unable to cope.",
  EXPRESSION_HYPERBOLE: "Idiomatic venting, academic stress expressions ('thesis is killing me'), jokes, or hyperbole that de-escalate flags.",
  CONFIRMATION_SIGNAL: "Explicit confirmations indicating literal intent during Phase 2 clarification ('I mean it literally', 'I have a plan').",
  OTHER: "Custom counselor-defined well-being or safeguarding indicators.",

  // Legacy mappings:
  CRITICAL_LITERAL: "Direct, explicit statements of intent or crisis. Prompts Muni to gently clarify in Phase 1 without triggering false emergency modals.",
  CRITICAL_AMBIGUOUS: "Passive ideation or ambiguous expressions of despair. Monitored for escalation across conversation history.",
  DISTRESS: "Language indicating severe emotional overwhelm, stress, or burnout without immediate self-harm intent.",
  DENY_HYPERBOLE: "Idiomatic expressions, humor, or venting phrases that clear critical flags when used in context.",
  CONFIRM_LITERAL: "Phrases indicating the student's statement was literal during Phase 2 clarification.",
};

export function getIndicatorCategoryLabel(category) {
  return SAFETY_INDICATOR_CATEGORY_LABELS[category] || "Safeguarding Indicator";
}

export function getIndicatorCategoryBadgeClasses(category) {
  switch (category) {
    case "SELF_HARM":
    case "CRITICAL_LITERAL":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "COERCION_BLACKMAIL":
      return "border-red-200 bg-red-50 text-red-700";
    case "ABUSE":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "GROOMING":
      return "border-purple-200 bg-purple-50 text-purple-800";
    case "THREAT_VIOLENCE":
      return "border-rose-300 bg-rose-100 text-rose-900";
    case "BULLYING_HARASSMENT":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "UNSAFE_ENVIRONMENT":
    case "CRITICAL_AMBIGUOUS":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "SUBSTANCE":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "EMOTIONAL_DISTRESS":
    case "DISTRESS":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "EXPRESSION_HYPERBOLE":
    case "DENY_HYPERBOLE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CONFIRMATION_SIGNAL":
    case "CONFIRM_LITERAL":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}


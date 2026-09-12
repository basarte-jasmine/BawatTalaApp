/** Shared journal risk helpers.
 * Product rule: CRITICAL == HIGH (crisis support prompts).
 * Distressed == LOW (admin analytics / low flag).
 *
 * Resource actions (hotline / counseling / wellness) count as "chose support".
 * DISMISSED is soft-dismiss only - not a resource choice - so Finish Journal
 * can still re-prompt when crisis risk remains.
 */
export type NormalizedRiskLevel = "CRITICAL" | "HIGH" | "LOW" | "NONE";

export type RawRiskLevel = string | null | undefined;

export type StudentSupportAction =
  | "CLICKED_HOTLINE"
  | "SCHEDULED_COUNSELING"
  | "VIEWED_WELLNESS"
  | "DISMISSED";

/** Actions that mean the student opened a real support resource. */
export const RESOURCE_SUPPORT_ACTIONS = [
  "CLICKED_HOTLINE",
  "SCHEDULED_COUNSELING",
  "VIEWED_WELLNESS",
] as const;

export type ResourceSupportAction = (typeof RESOURCE_SUPPORT_ACTIONS)[number];

export function normalizeRiskLevel(riskLevel: RawRiskLevel): NormalizedRiskLevel {
  const upper = String(riskLevel || "NONE").trim().toUpperCase();
  if (upper === "CRITICAL" || upper === "CRISIS") {
    return "CRITICAL";
  }
  if (upper === "HIGH") {
    return "HIGH";
  }
  // Distressed / legacy MEDIUM map to LOW.
  if (upper === "LOW" || upper === "DISTRESSED" || upper === "MEDIUM") {
    return "LOW";
  }
  return "NONE";
}

/** Crisis support prompts (hotline / counseling / wellness). */
export function isCrisisRisk(riskLevel: RawRiskLevel): boolean {
  const normalized = normalizeRiskLevel(riskLevel);
  return normalized === "HIGH" || normalized === "CRITICAL";
}

/** Distressed / needs-support band (LOW flag). */
export function isDistressedRisk(riskLevel: RawRiskLevel): boolean {
  return normalizeRiskLevel(riskLevel) === "LOW";
}

/** Any persisted studentAction, including soft DISMISSED. */
export function hasStudentSupportAction(
  entry?: { studentAction?: string | null } | null,
): boolean {
  return Boolean(entry?.studentAction);
}

/** True only for hotline / counseling / wellness - not DISMISSED. */
export function hasResourceSupportAction(
  entry?: { studentAction?: string | null } | null,
): boolean {
  const action = String(entry?.studentAction || "").trim().toUpperCase();
  return (RESOURCE_SUPPORT_ACTIONS as readonly string[]).includes(action);
}

/**
 * Crisis risk and no resource support action yet.
 * DISMISSED does not count - finish can still re-prompt.
 * Mid-chat UIs should also gate with a session soft-dismiss / shown flag
 * so the trio is not reopened on every reply after the first show.
 */
export function needsSupportPrompt(
  entry?: { riskLevel?: RawRiskLevel; studentAction?: string | null } | null,
): boolean {
  if (!entry) return false;
  if (!isCrisisRisk(entry.riskLevel)) return false;
  return !hasResourceSupportAction(entry);
}

/** Alias for Finish Journal / post-finish re-prompt (ignores DISMISSED). */
export function needsFinishSupportPrompt(
  entry?: { riskLevel?: RawRiskLevel; studentAction?: string | null } | null,
): boolean {
  return needsSupportPrompt(entry);
}

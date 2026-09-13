/** Shared journal risk helpers.
 * Product rule: CRITICAL == HIGH (crisis support prompts) for legacy riskLevel.
 * Distressed == LOW (admin analytics / low flag).
 *
 * Two-phase safety (safetyStatus + emotionalDistressSignal):
 * - CLARIFICATION_NEEDED: keep drafting; Muni clarify reply stays in chat; NO crisis trio
 * - CONFIRMED_CRITICAL: show crisis 3-button modal (hotline / consult / wellness)
 * - Missing safetyStatus: NO crisis trio (legacy HIGH fallback removed).
 *
 * Resource actions (hotline / counseling / wellness) count as "chose support".
 * DISMISSED is soft-dismiss only - not a resource choice - so Finish Journal
 * can still re-prompt when confirmed crisis remains.
 */

export type NormalizedRiskLevel = "CRITICAL" | "HIGH" | "LOW" | "NONE";

export type RawRiskLevel = string | null | undefined;

/** Backend safetyStatus (optional until Full-Stack lands). */
export type SafetyStatus =
  | "NOT_NEEDED"
  | "CLARIFICATION_NEEDED"
  | "CONFIRMED_CRITICAL"
  | "CLEARED";

export type RawSafetyStatus = string | null | undefined;

/** Backend emotionalDistressSignal (optional). DISTRESS displays as LOW; CRITICAL alone does not open trio. */
export type EmotionalDistressSignal = "NONE" | "DISTRESS" | "CRITICAL";

export type RawEmotionalDistressSignal = string | null | undefined;

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

export type RiskPromptEntry = {
  riskLevel?: RawRiskLevel;
  safetyStatus?: RawSafetyStatus;
  emotionalDistressSignal?: RawEmotionalDistressSignal;
  studentAction?: string | null;
} | null | undefined;

export type SafetyMessageHint = {
  role?: string;
  safetyStatus?: RawSafetyStatus;
  emotionalDistressSignal?: RawEmotionalDistressSignal;
  metadata?: Record<string, unknown> | null;
  /** Defensive: allow reading snake_case / legacy keys from raw payloads. */
  [key: string]: unknown;
};

export function normalizeRiskLevel(riskLevel: RawRiskLevel): NormalizedRiskLevel {
  const upper = String(riskLevel || "NONE").trim().toUpperCase();
  if (upper === "CRITICAL" || upper === "CRISIS") {
    return "CRITICAL";
  }
  if (upper === "HIGH") {
    return "HIGH";
  }
  // Distressed / legacy MEDIUM map to LOW.
  if (upper === "LOW" || upper === "DISTRESSED" || upper === "MEDIUM" || upper === "DISTRESS") {
    return "LOW";
  }
  return "NONE";
}

export function normalizeSafetyStatus(status: RawSafetyStatus): SafetyStatus | null {
  if (status === undefined || status === null) return null;
  const upper = String(status).trim().toUpperCase();
  if (!upper) return null;
  if (upper === "NOT_NEEDED" || upper === "NOT-NEEDED") return "NOT_NEEDED";
  if (upper === "CLARIFICATION_NEEDED" || upper === "CLARIFICATION-NEEDED" || upper === "NEEDS_CLARIFICATION") {
    return "CLARIFICATION_NEEDED";
  }
  if (upper === "CONFIRMED_CRITICAL" || upper === "CONFIRMED-CRITICAL" || upper === "CONFIRMED_CRISIS") {
    return "CONFIRMED_CRITICAL";
  }
  if (upper === "CLEARED" || upper === "CLEAR") return "CLEARED";
  // Unknown but present — treat as "present" non-confirmed so we do not false-trigger trio.
  return upper as SafetyStatus;
}

export function normalizeEmotionalDistressSignal(
  value: RawEmotionalDistressSignal,
): EmotionalDistressSignal | null {
  if (value === undefined || value === null) return null;
  const upper = String(value).trim().toUpperCase();
  if (!upper) return null;
  if (upper === "NONE" || upper === "OK" || upper === "CLEAR") return "NONE";
  if (upper === "DISTRESS" || upper === "DISTRESSED" || upper === "LOW") return "DISTRESS";
  if (upper === "CRITICAL" || upper === "CRISIS" || upper === "HIGH") return "CRITICAL";
  return null;
}

/** DISTRESS → LOW for display/prompts; CRITICAL signal alone does not open trio. */
export function emotionalDistressSignalToDisplayRisk(
  value: RawEmotionalDistressSignal,
): NormalizedRiskLevel {
  const normalized = normalizeEmotionalDistressSignal(value);
  if (normalized === "DISTRESS") return "LOW";
  if (normalized === "CRITICAL") return "CRITICAL";
  return "NONE";
}

/** Crisis support prompts (hotline / counseling / wellness) on legacy riskLevel. */
export function isCrisisRisk(riskLevel: RawRiskLevel): boolean {
  const normalized = normalizeRiskLevel(riskLevel);
  return normalized === "HIGH" || normalized === "CRITICAL";
}

/** Distressed / needs-support band (LOW flag). */
export function isDistressedRisk(riskLevel: RawRiskLevel): boolean {
  return normalizeRiskLevel(riskLevel) === "LOW";
}

export function isConfirmedCritical(entryOrStatus?: RiskPromptEntry | RawSafetyStatus): boolean {
  if (entryOrStatus && typeof entryOrStatus === "object") {
    return normalizeSafetyStatus(entryOrStatus.safetyStatus) === "CONFIRMED_CRITICAL";
  }
  return normalizeSafetyStatus(entryOrStatus as RawSafetyStatus) === "CONFIRMED_CRITICAL";
}

export function isClarificationNeeded(entryOrStatus?: RiskPromptEntry | RawSafetyStatus): boolean {
  if (entryOrStatus && typeof entryOrStatus === "object") {
    return normalizeSafetyStatus(entryOrStatus.safetyStatus) === "CLARIFICATION_NEEDED";
  }
  return normalizeSafetyStatus(entryOrStatus as RawSafetyStatus) === "CLARIFICATION_NEEDED";
}

/**
 * Whether safetyStatus was included on the payload (including empty string → treated as absent).
 * null/undefined/"" = missing (no trio; status required).
 */
export function hasSafetyStatusField(entry?: RiskPromptEntry): boolean {
  if (!entry) return false;
  if (!Object.prototype.hasOwnProperty.call(entry, "safetyStatus")) return false;
  const value = entry.safetyStatus;
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
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

function pickFirstNonEmpty(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const text = String(candidate).trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * Prefer entry.safetyStatus; if absent, read latest message field/metadata.
 * Missing everywhere = undefined (no trio without safetyStatus).
 */
export function resolveSafetyStatus(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): RawSafetyStatus {
  if (hasSafetyStatusField(entry)) {
    return entry!.safetyStatus;
  }
  if (!messages?.length) return undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const meta = message?.metadata;
    const found = pickFirstNonEmpty(
      message?.safetyStatus,
      message?.safety_status,
      meta?.safetyStatus,
      meta?.safety_status,
    );
    if (found !== undefined) return found;
  }
  return undefined;
}

export function resolveEmotionalDistressSignal(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): RawEmotionalDistressSignal {
  const fromEntry = pickFirstNonEmpty(
    entry?.emotionalDistressSignal,
    (entry as { emotional_distress_signal?: unknown } | null | undefined)?.emotional_distress_signal,
  );
  if (fromEntry !== undefined) return fromEntry;

  if (!messages?.length) return undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const meta = message?.metadata;
    const found = pickFirstNonEmpty(
      message?.emotionalDistressSignal,
      message?.emotional_distress_signal,
      meta?.emotionalDistressSignal,
      meta?.emotional_distress_signal,
    );
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Merge entry + optional message metadata for prompt gating without mutating entry. */
export function entryForSafetyPrompt(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): RiskPromptEntry {
  if (!entry) return entry;
  const safetyStatus = resolveSafetyStatus(entry, messages);
  const emotionalDistressSignal = resolveEmotionalDistressSignal(entry, messages);
  if (
    safetyStatus === entry.safetyStatus &&
    emotionalDistressSignal === entry.emotionalDistressSignal
  ) {
    return entry;
  }
  return {
    ...entry,
    safetyStatus: safetyStatus ?? entry.safetyStatus,
    emotionalDistressSignal: emotionalDistressSignal ?? entry.emotionalDistressSignal,
  };
}

/**
 * Primary gate for the crisis 3-button modal.
 * ONLY CONFIRMED_CRITICAL opens the trio (no legacy HIGH fallback when status is missing).
 * Missing / null / CLARIFICATION_NEEDED / NOT_NEEDED / CLEARED -> no trio.
 * DISMISSED does not count as a resource; finish can still re-prompt.
 */
export function needsCrisisTrioPrompt(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): boolean {
  const gated = entryForSafetyPrompt(entry, messages);
  if (!gated) return false;
  if (hasResourceSupportAction(gated)) return false;
  return normalizeSafetyStatus(gated.safetyStatus) === "CONFIRMED_CRITICAL";
}

/**
 * Crisis risk and no resource support action yet.
 * Prefer needsCrisisTrioPrompt for modal open sites (two-phase safety).
 * Kept as alias so older call sites stay correct during the pack.
 */
export function needsSupportPrompt(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): boolean {
  return needsCrisisTrioPrompt(entry, messages);
}

/** Alias for Finish Journal / post-finish re-prompt (ignores DISMISSED). */
export function needsFinishSupportPrompt(
  entry?: RiskPromptEntry,
  messages?: SafetyMessageHint[] | null,
): boolean {
  return needsCrisisTrioPrompt(entry, messages);
}
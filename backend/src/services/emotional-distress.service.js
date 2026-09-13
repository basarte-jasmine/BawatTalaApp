/**
 * Two-phase emotional distress assessment.
 * Trigger phrases are attention flags, not automatic confirmed crisis.
 * signal: NONE | DISTRESS | CRITICAL
 * safety_status: NOT_NEEDED | CLARIFICATION_NEEDED | CONFIRMED_CRITICAL | CLEARED
 * Compat risk_level for existing Flagged/mobile:
 *   NONE → NONE
 *   DISTRESS / CLEARED clarification → LOW
 *   CONFIRMED_CRITICAL → HIGH
 *   CLARIFICATION_NEEDED → LOW (no crisis modal yet; Muni asks safety check)
 *
 * Engine returns only: distress_signal, safety_status, risk_level,
 * admin_flag_reason, persona. No forced reply text.
 */

const LITERAL_CRITICAL_PHRASES = [
  // Clear intent/plan language — first hit still needs clarification (never auto CONFIRMED).
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "going to hurt myself",
  "going to kill myself",
  "i will kill myself",
  "i will hurt myself",
  "i'm going to kill myself",
  "im going to kill myself",
  "i've decided to kill myself",
  "ive decided to kill myself",
  "don't want to be alive anymore",
  "do not want to be alive anymore",
  "i don't want to be alive",
  "i dont want to be alive",
];

const AMBIGUOUS_CRITICAL_PHRASES = [
  "i want to die",
  "want to die",
  "want to be dead",
  "hurt myself",
  "hurting myself",
  "self harm",
  "self-harm",
  "suicide",
  "suicidal",
  "rest for life",
  "rest like for life",
  "nothing else matter",
  "nothing else matters",
  "nothing matters",
  "i want to quit everything",
  "quit everything",
  "don't want to do this anymore",
  "dont want to do this anymore",
  "i don't want to live",
  "i dont want to live",
];

const DISTRESS_PHRASES = [
  // Emotional distress only — do NOT list thesis/homework/deadline (false-alarms admin Flagged).
  "overwhelmed",
  "burned out",
  "burnt out",
  "so stressed",
  "exhausted",
  "hopeless",
  "i can't cope",
  "i cant cope",
  "giving up",
  "want to give up",
];

const CONFIRM_LITERAL = [
  // Keep these specific — bare "for real" / "yes i do" / "yes i want" false-confirm vague replies.
  "i mean it",
  "i actually mean it",
  "i actually mean",
  "i mean that literally",
  "i literally mean it",
  "i literally mean",
  "for real i mean",
  "yes i mean it",
  "yes i really mean",
  "i really want to die",
  "i actually want to die",
  "i don't want to be alive",
  "i dont want to be alive",
  "i have a plan",
  "i've got a plan",
  "ive got a plan",
  "i have a plan to",
];

const DENY_HYPERBOLE = [
  "just kidding",
  "just joking",
  "exaggerating",
  "i'm joking",
  "im joking",
  "haha",
  "hahaha",
  "lol",
  "lmao",
  "figuratively",
  "just stressed",
  "just super stressed",
  "super stressed",
  "just exhausted",
  "just frustrated",
  "just tired",
  "not literally",
  "not seriously",
  "not for real",
  "don't mean it",
  "dont mean it",
  "not serious",
  "not thinking of",
  "not thinking about",
  "thesis is killing me",
  "killing me",
  "dying of",
  "dying from",
  "so hard i want to die",
  "for my thesis",
  "about suicide",
  "studying suicide",
  "research on suicide",
  // Expression / venting denies — latest-message deny wins even if history has "kill myself"
  "just an expression",
  "its just an expression",
  "it's just an expression",
  "just an expression bro",
  "expression bro",
  "an expression",
  "expression",
  "just venting",
  "only venting",
  "just venting bro",
  "im just venting",
  "i'm just venting",
  "it was just an expression",
  "was just an expression",
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function hasNegatedConfirm(text) {
  return /\bnot\s+(?:literally|serious(?:ly)?|for real)\b|\bdon'?t\s+mean\s+it\b|\bdont\s+mean\s+it\b/i.test(
    String(text || ""),
  );
}

/** True when a critical phrase appears under negation (not / don't / never ... phrase). */
function isPhraseNegated(text, phrase) {
  const value = String(text || "");
  const target = String(phrase || "").toLowerCase();
  if (!value || !target) return false;
  let from = 0;
  while (from <= value.length) {
    const idx = value.indexOf(target, from);
    if (idx < 0) break;
    const window = value.slice(Math.max(0, idx - 48), idx);
    if (
      /\b(?:not|never|no)\b[\s\w']{0,40}$/i.test(window) ||
      /\b(?:don'?t|dont|do not|not)\s+(?:thinking\s+(?:of|about)\s+|gonna\s+|going\s+to\s+|want(?:ing)?\s+to\s+)?$/i.test(
        window,
      )
    ) {
      return true;
    }
    from = idx + target.length;
  }
  return false;
}

function includesAnyUnnegated(text, phrases) {
  return (Array.isArray(phrases) ? phrases : []).some(
    (phrase) => text.includes(phrase) && !isPhraseNegated(text, phrase),
  );
}

function countUnnegatedMatches(text, phrases) {
  return (Array.isArray(phrases) ? phrases : []).filter(
    (phrase) => text.includes(phrase) && !isPhraseNegated(text, phrase),
  ).length;
}

function looksLikeDenyReply(text) {
  const value = String(text || "");
  return (
    hasNegatedConfirm(value) ||
    includesAny(value, DENY_HYPERBOLE) ||
    /\b(?:no+|nope|nah|hindi|joke|joking|kidding|exaggerat)\b/i.test(value) ||
    /\bnot\s+thinking\s+(?:of|about)\b/i.test(value) ||
    /\bjust\s+(?:super\s+)?(?:stressed|exhausted|tired|frustrated|overwhelmed|venting)\b/i.test(
      value,
    ) ||
    /\b(?:just\s+)?(?:an\s+)?expression\b/i.test(value)
  );
}

function countMatches(text, phrases) {
  return phrases.filter((phrase) => text.includes(phrase)).length;
}

function normalizeDistressSignal(value) {
  const v = String(value || "NONE").trim().toUpperCase();
  if (v === "DISTRESS" || v === "LOW" || v === "MEDIUM" || v === "MODERATE") return "DISTRESS";
  if (v === "CRITICAL" || v === "HIGH" || v === "CRISIS") return "CRITICAL";
  return "NONE";
}

function normalizeSafetyStatus(value) {
  const v = String(value || "NOT_NEEDED").trim().toUpperCase();
  if (["CLARIFICATION_NEEDED", "CONFIRMED_CRITICAL", "CLEARED", "NOT_NEEDED"].includes(v)) {
    return v;
  }
  return "NOT_NEEDED";
}

function toCompatRiskLevel(signal, safetyStatus) {
  if (safetyStatus === "CONFIRMED_CRITICAL" || (signal === "CRITICAL" && safetyStatus === "CONFIRMED_CRITICAL")) {
    return "HIGH";
  }
  if (signal === "DISTRESS" || safetyStatus === "CLEARED" || safetyStatus === "CLARIFICATION_NEEDED") {
    return "LOW";
  }
  if (signal === "CRITICAL" && safetyStatus === "CLARIFICATION_NEEDED") {
    return "LOW";
  }
  return "NONE";
}

function buildResult({
  distress_signal,
  safety_status,
  risk_level,
  admin_flag_reason,
  persona,
}) {
  return {
    distress_signal,
    safety_status,
    risk_level,
    admin_flag_reason,
    persona,
  };
}

/**
 * @param {{
 *   latestUserMessage: string,
 *   history?: Array<{role?: string, text?: string}>,
 *   previousDistressSignal?: string,
 *   previousSafetyStatus?: string,
 * }} input
 */
function assessEmotionalDistress(input = {}) {
  const latest = normalizeText(input.latestUserMessage);
  const history = Array.isArray(input.history) ? input.history : [];
  const priorSignal = normalizeDistressSignal(input.previousDistressSignal);
  const priorSafety = normalizeSafetyStatus(input.previousSafetyStatus);

  const studentHistoryText = history
    .filter((item) => String(item.role || "").toLowerCase() === "user")
    .map((item) => normalizeText(item.text))
    .join(" ");
  // History is for escalation context only — never re-force CONFIRMED from combined
  // when the latest message is a deny/clarify reply.
  const combined = `${studentHistoryText} ${latest}`.trim();

  // Already confirmed: stay HIGH only if student keeps confirming; latest deny clears.
  if (priorSafety === "CONFIRMED_CRITICAL") {
    if (looksLikeDenyReply(latest)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason:
          "Previously confirmed concern cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
      });
    }
    if (
      includesAnyUnnegated(latest, CONFIRM_LITERAL) ||
      includesAnyUnnegated(latest, LITERAL_CRITICAL_PHRASES) ||
      includesAnyUnnegated(latest, AMBIGUOUS_CRITICAL_PHRASES)
    ) {
      return buildResult({
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        admin_flag_reason: "Student continued confirming literal safety concern.",
        persona: "CRITICAL_SAFETY",
      });
    }
    // Soft continuation without deny — keep confirmed safety stance.
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      admin_flag_reason: "Ongoing confirmed critical safety concern.",
      persona: "CRITICAL_SAFETY",
    });
  }

  // Phase 2: respond to an open clarification
  if (priorSafety === "CLARIFICATION_NEEDED") {
    // DENY first — latest-message deny wins even if history still contains "kill myself".
    // Do NOT re-scan combined history to re-force CONFIRMED after a deny.
    if (looksLikeDenyReply(latest)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason:
          "Critical-language trigger cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
      });
    }
    if (
      includesAnyUnnegated(latest, CONFIRM_LITERAL) ||
      includesAnyUnnegated(latest, LITERAL_CRITICAL_PHRASES)
    ) {
      return buildResult({
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        admin_flag_reason: "Student confirmed literal safety concern after clarification.",
        persona: "CRITICAL_SAFETY",
      });
    }
    // Still ambiguous — stay in clarification
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Awaiting safety clarification for critical-language signals.",
      persona: "CRITICAL_CLARIFY",
    });
  }

  // Prefer latest-message deny over any history literal re-scan.
  if (looksLikeDenyReply(latest)) {
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: "CLEARED",
      risk_level: "LOW",
      admin_flag_reason:
        "Critical-sounding language cleared by negation or hyperbole in the latest reply.",
      persona: "DISTRESS_SUPPORT",
    });
  }

  // Score critical language primarily from the LATEST message.
  // History may support escalation into clarification, but never auto-CONFIRMED.
  const literalHitsLatest = countUnnegatedMatches(latest, LITERAL_CRITICAL_PHRASES);
  const ambiguousHitsLatest = countMatches(latest, AMBIGUOUS_CRITICAL_PHRASES);
  const ambiguousHitsHistory = countMatches(studentHistoryText, AMBIGUOUS_CRITICAL_PHRASES);
  const distressHits = countMatches(combined, DISTRESS_PHRASES);
  const escalating =
    ambiguousHitsHistory + ambiguousHitsLatest >= 2 ||
    (ambiguousHitsLatest >= 1 && distressHits >= 1) ||
    (priorSignal === "DISTRESS" && ambiguousHitsLatest >= 1);

  // First hit / ambiguous / literal-sounding without prior CLARIFICATION_NEEDED
  // + clear confirm → ALWAYS CLARIFICATION_NEEDED + risk LOW. Never auto CONFIRMED.
  if (literalHitsLatest >= 1 || ambiguousHitsLatest >= 1 || escalating) {
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason:
        "Critical-language trigger requires safety clarification before confirmed crisis.",
      persona: "CRITICAL_CLARIFY",
    });
  }

  if (distressHits >= 1 || priorSignal === "DISTRESS") {
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: priorSafety === "CLEARED" ? "CLEARED" : "NOT_NEEDED",
      risk_level: "LOW",
      admin_flag_reason:
        distressHits >= 1 ? "Emotional distress language detected (not confirmed crisis)." : null,
      persona: "DISTRESS_SUPPORT",
    });
  }

  return buildResult({
    distress_signal: "NONE",
    safety_status: "NOT_NEEDED",
    risk_level: "NONE",
    admin_flag_reason: null,
    persona: "COMPANION",
  });
}

module.exports = {
  assessEmotionalDistress,
  normalizeDistressSignal,
  normalizeSafetyStatus,
  toCompatRiskLevel,
};

/**
 * Two-phase emotional distress & safeguarding assessment.
 * Safeguarding indicators are attention flags, not automatic confirmed crisis.
 * signal: NONE | DISTRESS | CRITICAL
 * safety_status: NOT_NEEDED | CLARIFICATION_NEEDED | CONFIRMED_CRITICAL | CLEARED
 * Compat risk_level for existing Flagged/mobile:
 *   NONE -> NONE
 *   DISTRESS / CLEARED clarification -> LOW
 *   CONFIRMED_CRITICAL -> HIGH
 *   CLARIFICATION_NEEDED -> LOW (no crisis modal yet; Muni asks safety check)
 */

const {
  DEFAULT_INDICATORS_BY_CATEGORY,
  SAFETY_INDICATOR_CATEGORIES,
  SAFETY_INDICATOR_CATEGORY_LABELS,
  getIndicatorCategoryLabel,
  normalizeIndicatorCategory,
} = require("../constants/safety-risk-indicators");
const {
  getSafetyRiskIndicatorDictionarySync,
} = require("./safety-risk-indicators.service");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, phrases) {
  return (Array.isArray(phrases) ? phrases : []).some((phrase) => text.includes(phrase));
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

function getUnnegatedMatches(text, phrases) {
  return (Array.isArray(phrases) ? phrases : []).filter(
    (phrase) => text.includes(phrase) && !isPhraseNegated(text, phrase),
  );
}

function looksLikeDenyReply(text, denyPhrases = []) {
  const value = String(text || "");
  const list = Array.isArray(denyPhrases) && denyPhrases.length ? denyPhrases : (DEFAULT_INDICATORS_BY_CATEGORY.EXPRESSION_HYPERBOLE || DEFAULT_INDICATORS_BY_CATEGORY.DENY_HYPERBOLE);
  return (
    hasNegatedConfirm(value) ||
    includesAny(value, list) ||
    /\b(?:no+|nope|nah|hindi|joke|joking|kidding|exaggerat)\b/i.test(value) ||
    /\bnot\s+thinking\s+(?:of|about)\b/i.test(value) ||
    /\bjust\s+(?:super\s+)?(?:stressed|exhausted|tired|frustrated|overwhelmed|venting)\b/i.test(
      value,
    ) ||
    /\b(?:just\s+)?(?:an\s+)?expression\b/i.test(value)
  );
}

const CONFIRM_AFFIRMATION_REGEX =
  /\b(?:yes+|yea+h?|yep|yup|oo+|opo|true|totoo|talaga|literal(?:ly)?|i\s+do|i\s+want\s+to|gusto\s+ko\s+na)\b/i;

const CONFIRM_INTENT_PATTERNS = [
  /\b(?:want|wanna)\s+to\s+(?:die|give\s+up|end\s+it|disappear)\b/i,
  /\b(?:gusto|nais)\s+(?:ko\s+)?(?:na\s+)?(?:mamatay|sumuko|tapusin|mawala|matapos)\b/i,
  /\bayoko\s+na(?:\s+talaga)?\b/i,
  /\b(?:end|finish)\s+(?:it\s+all|everything|my\s+life)\b/i,
  /\bi\s+mean\s+it\b/i,
  /\bfor\s+real\b/i,
];

function looksLikeConfirmationReply(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;
  if (hasNegatedConfirm(value)) return false;

  const hasAffirmation = CONFIRM_AFFIRMATION_REGEX.test(value);
  const hasIntent = CONFIRM_INTENT_PATTERNS.some((pattern) => pattern.test(value));

  if (hasAffirmation && hasIntent) return true;
  if (/^(?:yes+|yea+h?|yep|yup|oo+|opo|totoo(?:\s+po)?|talaga(?:\s+po)?|literal(?:ly)?(?:\s+po)?|yes\s+(?:po|i\s+do|i\s+mean\s+it|i\s+am)|oo\s+(?:po|nga|talaga|sobra))\b/i.test(value)) {
    return true;
  }
  if (hasIntent) return true;
  return false;
}

function countMatches(text, phrases) {
  return (Array.isArray(phrases) ? phrases : []).filter((phrase) => text.includes(phrase)).length;
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
  detected_categories = [],
  matched_indicators = [],
}) {
  return {
    distress_signal,
    safety_status,
    risk_level,
    admin_flag_reason,
    persona,
    detected_categories,
    matched_indicators,
  };
}

const CRITICAL_CATEGORIES = new Set([
  "SELF_HARM",
  "ABUSE",
  "GROOMING",
  "COERCION_BLACKMAIL",
  "THREAT_VIOLENCE",
  "CRITICAL_LITERAL",
  "CRITICAL_AMBIGUOUS",
]);

const DISTRESS_CATEGORIES = new Set([
  "EMOTIONAL_DISTRESS",
  "BULLYING_HARASSMENT",
  "UNSAFE_ENVIRONMENT",
  "SUBSTANCE",
  "DISTRESS",
]);

function scanCategoryMatches(text, activeDict, categoryFilterSet) {
  const matches = [];
  const categoriesSet = new Set();

  for (const [cat, phrases] of Object.entries(activeDict)) {
    if (!categoryFilterSet.has(cat)) continue;
    if (!Array.isArray(phrases) || phrases.length === 0) continue;
    for (const phrase of phrases) {
      if (text.includes(phrase) && !isPhraseNegated(text, phrase)) {
        matches.push(phrase);
        categoriesSet.add(cat);
      }
    }
  }

  return {
    matchedPhrases: Array.from(new Set(matches)),
    categories: Array.from(categoriesSet),
  };
}

/**
 * @param {{
 *   latestUserMessage: string,
 *   history?: Array<{role?: string, text?: string}>,
 *   dictionary?: Record<string, string[]>,
 *   previousDistressSignal?: string,
 *   previousSafetyStatus?: string,
 * }} input
 */
function assessEmotionalDistress(input = {}) {
  const activeDict = input.dictionary || getSafetyRiskIndicatorDictionarySync() || DEFAULT_INDICATORS_BY_CATEGORY;

  // Aggregate critical phrases
  const criticalPhrases = [
    ...(activeDict.SELF_HARM || []),
    ...(activeDict.ABUSE || []),
    ...(activeDict.GROOMING || []),
    ...(activeDict.COERCION_BLACKMAIL || []),
    ...(activeDict.THREAT_VIOLENCE || []),
    ...(activeDict.CRITICAL_LITERAL || []),
  ];

  // Aggregate ambiguous phrases
  const ambiguousPhrases = [
    ...(activeDict.CRITICAL_AMBIGUOUS || []),
  ];

  // Aggregate distress phrases
  const distressPhrases = [
    ...(activeDict.EMOTIONAL_DISTRESS || []),
    ...(activeDict.BULLYING_HARASSMENT || []),
    ...(activeDict.UNSAFE_ENVIRONMENT || []),
    ...(activeDict.SUBSTANCE || []),
    ...(activeDict.DISTRESS || []),
  ];

  // Deny and confirm phrases
  const denyPhrases = [
    ...(activeDict.EXPRESSION_HYPERBOLE || []),
    ...(activeDict.DENY_HYPERBOLE || []),
  ];
  const confirmPhrases = [
    ...(activeDict.CONFIRMATION_SIGNAL || []),
    ...(activeDict.CONFIRM_LITERAL || []),
  ];

  const latest = normalizeText(input.latestUserMessage);
  const history = Array.isArray(input.history) ? input.history : [];
  const priorSignal = normalizeDistressSignal(input.previousDistressSignal);
  const priorSafety = normalizeSafetyStatus(input.previousSafetyStatus);

  const studentHistoryText = history
    .filter((item) => String(item.role || "").toLowerCase() === "user")
    .map((item) => normalizeText(item.text))
    .join(" ");

  const combined = (studentHistoryText + " " + latest).trim();

  // Scan critical matches specifically
  const latestCritical = scanCategoryMatches(latest, activeDict, CRITICAL_CATEGORIES);
  const combinedCritical = scanCategoryMatches(combined, activeDict, CRITICAL_CATEGORIES);

  // Scan distress matches specifically
  const latestDistress = scanCategoryMatches(latest, activeDict, DISTRESS_CATEGORIES);
  const combinedDistress = scanCategoryMatches(combined, activeDict, DISTRESS_CATEGORIES);

  const primaryCriticalLabel = latestCritical.categories.length > 0
    ? getIndicatorCategoryLabel(latestCritical.categories[0])
    : (combinedCritical.categories.length > 0 ? getIndicatorCategoryLabel(combinedCritical.categories[0]) : "Safeguarding Indicator");

  // Already confirmed: stay HIGH only if student keeps confirming; latest deny clears.
  if (priorSafety === "CONFIRMED_CRITICAL") {
    if (looksLikeDenyReply(latest, denyPhrases)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason:
          "Previously confirmed concern cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
        detected_categories: combinedCritical.categories,
        matched_indicators: combinedCritical.matchedPhrases,
      });
    }
    if (
      includesAnyUnnegated(latest, confirmPhrases) ||
      includesAnyUnnegated(latest, criticalPhrases) ||
      includesAnyUnnegated(latest, ambiguousPhrases) ||
      looksLikeConfirmationReply(latest)
    ) {
      return buildResult({
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        admin_flag_reason: "Student continued confirming literal safety concern [" + primaryCriticalLabel + "].",
        persona: "CRITICAL_SAFETY",
        detected_categories: combinedCritical.categories,
        matched_indicators: combinedCritical.matchedPhrases,
      });
    }
    // Soft continuation without deny - keep confirmed safety stance.
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      admin_flag_reason: "Ongoing confirmed critical safety concern [" + primaryCriticalLabel + "].",
      persona: "CRITICAL_SAFETY",
      detected_categories: combinedCritical.categories,
      matched_indicators: combinedCritical.matchedPhrases,
    });
  }

  // Phase 2: respond to an open clarification
  if (priorSafety === "CLARIFICATION_NEEDED") {
    if (looksLikeDenyReply(latest, denyPhrases)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason:
          "Safeguarding indicator [" + primaryCriticalLabel + "] cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
        detected_categories: combinedCritical.categories,
        matched_indicators: combinedCritical.matchedPhrases,
      });
    }
    if (
      includesAnyUnnegated(latest, confirmPhrases) ||
      includesAnyUnnegated(latest, criticalPhrases) ||
      includesAnyUnnegated(latest, ambiguousPhrases) ||
      looksLikeConfirmationReply(latest)
    ) {
      return buildResult({
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        admin_flag_reason: "Student confirmed literal safety concern [" + primaryCriticalLabel + "] after clarification.",
        persona: "CRITICAL_SAFETY",
        detected_categories: combinedCritical.categories,
        matched_indicators: combinedCritical.matchedPhrases,
      });
    }
    // Still ambiguous - stay in clarification
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Awaiting safety clarification for indicator signals [" + primaryCriticalLabel + "].",
      persona: "CRITICAL_CLARIFY",
      detected_categories: combinedCritical.categories,
      matched_indicators: combinedCritical.matchedPhrases,
    });
  }

  // Prefer latest-message deny over any history literal re-scan.
  if (looksLikeDenyReply(latest, denyPhrases)) {
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: "CLEARED",
      risk_level: "LOW",
      admin_flag_reason:
        "Critical-sounding language cleared by negation or hyperbole in the latest reply.",
      persona: "DISTRESS_SUPPORT",
      detected_categories: combinedCritical.categories,
      matched_indicators: combinedCritical.matchedPhrases,
    });
  }

  // Score critical and ambiguous language primarily from the LATEST message.
  const criticalHitsLatest = countUnnegatedMatches(latest, criticalPhrases);
  const ambiguousHitsLatest = countMatches(latest, ambiguousPhrases);
  const ambiguousHitsHistory = countMatches(studentHistoryText, ambiguousPhrases);
  const distressHits = countMatches(combined, distressPhrases);
  const escalating =
    ambiguousHitsHistory + ambiguousHitsLatest >= 2 ||
    (ambiguousHitsLatest >= 1 && distressHits >= 1) ||
    (priorSignal === "DISTRESS" && ambiguousHitsLatest >= 1);

  // First hit / ambiguous / literal-sounding without prior CLARIFICATION_NEEDED
  // ALWAYS CLARIFICATION_NEEDED + risk LOW. Never auto CONFIRMED.
  if (criticalHitsLatest >= 1 || ambiguousHitsLatest >= 1 || escalating || latestCritical.matchedPhrases.length > 0) {
    const matchedList = latestCritical.matchedPhrases.length > 0
      ? latestCritical.matchedPhrases
      : getUnnegatedMatches(latest, criticalPhrases);
    const samplePhrase = matchedList[0] || "concerning statement";
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason:
        "Potential safeguarding concern detected [" + primaryCriticalLabel + "]: '" + samplePhrase + "' (Requires clarification).",
      persona: "CRITICAL_CLARIFY",
      detected_categories: latestCritical.categories.length > 0 ? latestCritical.categories : combinedCritical.categories,
      matched_indicators: matchedList,
    });
  }

  if (distressHits >= 1 || latestDistress.matchedPhrases.length > 0 || priorSignal === "DISTRESS") {
    const distressList = latestDistress.matchedPhrases.length > 0 ? latestDistress.matchedPhrases : combinedDistress.matchedPhrases;
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: priorSafety === "CLEARED" ? "CLEARED" : "NOT_NEEDED",
      risk_level: "LOW",
      admin_flag_reason:
        (distressHits >= 1 || distressList.length > 0) ? "Emotional distress language detected (not confirmed crisis)." : null,
      persona: "DISTRESS_SUPPORT",
      detected_categories: latestDistress.categories.length > 0 ? latestDistress.categories : combinedDistress.categories,
      matched_indicators: distressList,
    });
  }

  return buildResult({
    distress_signal: "NONE",
    safety_status: "NOT_NEEDED",
    risk_level: "NONE",
    admin_flag_reason: null,
    persona: "COMPANION",
    detected_categories: [],
    matched_indicators: [],
  });
}

module.exports = {
  assessEmotionalDistress,
  normalizeDistressSignal,
  normalizeSafetyStatus,
  toCompatRiskLevel,
};


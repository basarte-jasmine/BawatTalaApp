/**
 * Two-phase emotional distress & safeguarding assessment.
 * Safeguarding indicators are attention flags, not automatic confirmed crisis.
 * signal: NONE | DISTRESS | CRITICAL
 * safety_status: NOT_NEEDED | CLARIFICATION_NEEDED | CONFIRMED_CRITICAL | CLEARED
 * concern_type: Independent of risk_level (BULLYING_HARASSMENT, ABUSE, GROOMING, POWER_IMBALANCE, COERCION_BLACKMAIL, THREAT_VIOLENCE, UNSAFE_ENVIRONMENT, AI_ATTACHMENT, SELF_HARM, EMOTIONAL_DISTRESS, NONE)
 *
 * Requirements:
 * 1. Explicit Suicidal Plans, Means, Timeframes, and Actions:
 *    - ACTION_TAKEN (attempt / harmful action already taken) -> Immediate CONFIRMED_CRITICAL (No clarification needed)
 *    - PLAN_MEANS_TIMEFRAME (explicit plan + means/timeframe) -> Immediate CONFIRMED_CRITICAL (No clarification needed)
 *    - Ambiguous statements continue using CLARIFICATION_NEEDED.
 * 2. Tagalog Negation & Context:
 *    - "hindi na" and "hindi ko na kaya" / "hindi ko na kakayanin" communicate worsening distress, NOT reassurance/denial.
 *    - "okay na, kaya ko pa" communicates genuine de-escalation reassurance.
 *    - Bare "hindi" does not wipe distress.
 * 3. Separate Concern Type from Risk Level:
 *    - Bullying, abuse, grooming, coercion, threats, unsafe environment, and AI attachment are tracked as distinct concern_types.
 *    - For non-suicidal safeguarding concerns that require safety support without crisis triage, return persona SAFETY_SUPPORT.
 * 4. Fix Sticky Distress:
 *    - Only evaluate user messages within a recent conversation window (e.g. last 3 user messages).
 *    - If recent user messages indicate genuine de-escalation ("okay na, kaya ko pa"), transition signal from DISTRESS to NONE.
 *    - Prior confirmed critical cannot be cleared without explicit denial or reassessment.
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

/**
 * Checks whether a phrase in text is explicitly negated by a preceding negation marker
 * (e.g. "not thinking of dying", "never going to kill myself", "don't want to hurt myself").
 * Does NOT negate worsening distress expressions like "hindi ko na kaya" or "hindi na".
 */
function isPhraseNegated(text, phrase) {
  const value = String(text || "");
  const target = String(phrase || "").toLowerCase();
  if (!value || !target) return false;

  // Do not treat Tagalog worsening distress as negated phrases
  if (target.startsWith("hindi ko na") || target.startsWith("di ko na") || target.startsWith("hindi na") || target.startsWith("di na")) {
    return false;
  }

  let from = 0;
  while (from <= value.length) {
    const idx = value.indexOf(target, from);
    if (idx < 0) break;
    const window = value.slice(Math.max(0, idx - 48), idx);
    if (
      /\b(?:not|never)\b[\s\w']{0,40}$/i.test(window) ||
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

/**
 * Checks if the reply is an explicit de-escalation, clarification of hyperbole, or denial of suicidal intent.
 * CRUCIAL: "hindi ko na kaya" or "hindi na" is NOT a deny/reassurance reply.
 */
function looksLikeDenyReply(text, denyPhrases = [], reassurancePhrases = []) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;

  // Worsening distress guard: statements like "hindi ko na kaya", "hindi na", "di ko na kaya" are NOT denials
  if (
    /\b(?:hindi|di)\s+(?:ko\s+)?na\s+(?:kaya|kakayanin)\b/i.test(value) ||
    /\b(?:hindi|di)\s+na\s+talaga\b/i.test(value) ||
    /\bcan'?t\s+take\s+it\s+anymore\b/i.test(value)
  ) {
    return false;
  }

  const list = Array.isArray(denyPhrases) && denyPhrases.length
    ? denyPhrases
    : (DEFAULT_INDICATORS_BY_CATEGORY.EXPRESSION_HYPERBOLE || DEFAULT_INDICATORS_BY_CATEGORY.DENY_HYPERBOLE);

  const reassurances = Array.isArray(reassurancePhrases) && reassurancePhrases.length
    ? reassurancePhrases
    : (getSafetyRiskIndicatorDictionarySync()?.DEESCALATION_REASSURANCE || DEFAULT_INDICATORS_BY_CATEGORY.DEESCALATION_REASSURANCE || []);

  if (hasNegatedConfirm(value)) return true;
  if (includesAny(value, list)) return true;
  if (includesAny(value, reassurances)) return true;

  // Strict standalone denials or hyperbole
  if (/^(?:no+|nope|nah|hindi\s+po|hindi\s+naman|hindi\s+literal|joke\s+lang|biro\s+lang|venting\s+lang)\b/i.test(value)) {
    return true;
  }

  if (
    /\bnot\s+thinking\s+(?:of|about)\b/i.test(value) ||
    /\bjust\s+(?:super\s+)?(?:stressed|exhausted|tired|frustrated|overwhelmed|venting)\b/i.test(value) ||
    /\b(?:just\s+)?(?:an\s+)?expression\b/i.test(value)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if student expression indicates genuine de-escalation or reassurance.
 */
function looksLikeDeescalation(text, reassurancePhrases = []) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return false;

  // If worsening distress appears, it is not de-escalation
  if (
    /\b(?:hindi|di)\s+(?:ko\s+)?na\s+(?:kaya|kakayanin)\b/i.test(value) ||
    /\bcan'?t\s+take\s+it\s+anymore\b/i.test(value)
  ) {
    return false;
  }

  const list = Array.isArray(reassurancePhrases) && reassurancePhrases.length
    ? reassurancePhrases
    : (getSafetyRiskIndicatorDictionarySync()?.DEESCALATION_REASSURANCE || DEFAULT_INDICATORS_BY_CATEGORY.DEESCALATION_REASSURANCE || []);

  if (includesAny(value, list)) return true;

  return /\b(?:okay|ok|maayos)\s+na\s+(?:po\s+)?(?:ako|kaya\s+ko\s+pa)\b/i.test(value) ||
         /\bi'?m\s+(?:feeling\s+)?(?:much\s+)?better\s+now\b/i.test(value) ||
         /\bi\s+can\s+(?:handle|manage)\s+it\s+now\b/i.test(value);
}

const CONFIRM_AFFIRMATION_REGEX =
  /\b(?:yes+|yea+h?|yep|yup|oo+|opo|true|totoo|talaga|literal(?:ly)?|i\s+do|i\s+want\s+to|gusto\s+ko\s+na)\b/i;

const CONFIRM_INTENT_PATTERNS = [
  /\b(?:want|wanna)\s+to\s+(?:die|give\s+up|end\s+it|disappear)\b/i,
  /\b(?:gusto|nais)\s+(?:ko\s+)?(?:na\s+)?(?:mamatay|sumuko|tapusin|mawala|matapos)\b/i,
  /\bayoko\s+na(?:\s+talaga)?\b/i,
  /\b(?:end|finish)\s+(?:it\s+all|everything|my\s+life)\b/i,
  /\bi\s+mean\s+it\b/i,
  /\b(?:i'?m|i am|i'm)\s+(?:really\s+)?(?:going|gonna)\s+to\s+(?:do\s+it|act\s+on\s+it|end\s+it|kill\s+myself|hurt\s+myself)\b/i,
  /\b(?:i\s+will|i'll)\s+(?:do\s+it|act\s+on\s+it|end\s+it|kill\s+myself|hurt\s+myself)\b/i,
  /\b(?:it'?s|it is)\s+(?:true|real|literal|serious)\b/i,
  /\b(?:i'?m|i am|i'm)\s+serious\b/i,
  /\b(?:i'?m|i am|i'm)\s+not\s+(?:joking|kidding|playing)\b/i,
  /\bwhat\s+i\s+said\s+is\s+(?:true|real|serious)\b/i,
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
  concern_type = "NONE",
  admin_flag_reason,
  persona,
  detected_categories = [],
  matched_indicators = [],
}) {
  return {
    distress_signal,
    safety_status,
    risk_level,
    concern_type,
    admin_flag_reason,
    persona,
    detected_categories,
    matched_indicators,
  };
}

const ACTION_CATEGORIES = new Set(["ACTION_TAKEN"]);
const PLAN_CATEGORIES = new Set(["PLAN_MEANS_TIMEFRAME"]);

const CRITICAL_SELF_HARM_CATEGORIES = new Set([
  "ACTION_TAKEN",
  "PLAN_MEANS_TIMEFRAME",
  "SELF_HARM",
  "CRITICAL_LITERAL",
  "CRITICAL_AMBIGUOUS",
]);

const SAFEGUARDING_CONCERN_CATEGORIES = new Set([
  "BULLYING_HARASSMENT",
  "ABUSE",
  "GROOMING",
  "POWER_IMBALANCE",
  "COERCION_BLACKMAIL",
  "THREAT_VIOLENCE",
  "UNSAFE_ENVIRONMENT",
  "AI_ATTACHMENT",
]);

const DISTRESS_CATEGORIES = new Set([
  "EMOTIONAL_DISTRESS",
  "WORSENING_DISTRESS",
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
 * Derives the primary concern_type independent of risk level.
 */
function resolveConcernType(detectedCategories = []) {
  const priority = [
    "ACTION_TAKEN",
    "PLAN_MEANS_TIMEFRAME",
    "SELF_HARM",
    "CRITICAL_LITERAL",
    "CRITICAL_AMBIGUOUS",
    "ABUSE",
    "COERCION_BLACKMAIL",
    "GROOMING",
    "POWER_IMBALANCE",
    "THREAT_VIOLENCE",
    "BULLYING_HARASSMENT",
    "UNSAFE_ENVIRONMENT",
    "AI_ATTACHMENT",
    "WORSENING_DISTRESS",
    "EMOTIONAL_DISTRESS",
    "SUBSTANCE",
  ];

  for (const p of priority) {
    if (detectedCategories.includes(p)) {
      if (p === "ACTION_TAKEN" || p === "PLAN_MEANS_TIMEFRAME" || p === "CRITICAL_LITERAL" || p === "CRITICAL_AMBIGUOUS") {
        return "SELF_HARM";
      }
      if (p === "WORSENING_DISTRESS") {
        return "EMOTIONAL_DISTRESS";
      }
      return p;
    }
  }
  return "NONE";
}

/**
 * @param {{
 *   latestUserMessage: string,
 *   history?: Array<{role?: string, text?: string}>,
 *   dictionary?: Record<string, string[]>,
 *   previousDistressSignal?: string,
 *   previousSafetyStatus?: string,
 *   previousConcernType?: string,
 * }} input
 */
function assessEmotionalDistress(input = {}) {
  const activeDict = input.dictionary || getSafetyRiskIndicatorDictionarySync() || DEFAULT_INDICATORS_BY_CATEGORY;

  // Critical explicit action / plan phrases
  const actionPhrases = [...(activeDict.ACTION_TAKEN || [])];
  const planPhrases = [...(activeDict.PLAN_MEANS_TIMEFRAME || [])];

  // Self-harm literal and ambiguous phrases
  const selfHarmLiteral = [
    ...(activeDict.SELF_HARM || []),
    ...(activeDict.CRITICAL_LITERAL || []),
  ];
  const selfHarmAmbiguous = [
    ...(activeDict.CRITICAL_AMBIGUOUS || []),
  ];

  // Safeguarding interpersonal concerns
  const safeguardingPhrases = [
    ...(activeDict.ABUSE || []),
    ...(activeDict.GROOMING || []),
    ...(activeDict.COERCION_BLACKMAIL || []),
    ...(activeDict.BULLYING_HARASSMENT || []),
    ...(activeDict.THREAT_VIOLENCE || []),
    ...(activeDict.POWER_IMBALANCE || []),
    ...(activeDict.SECRECY || []),
    ...(activeDict.BOUNDARY_CROSSING || []),
    ...(activeDict.AI_ATTACHMENT || []),
    ...(activeDict.UNSAFE_ENVIRONMENT || []),
  ];

  // Distress and worsening phrases
  const distressPhrases = [
    ...(activeDict.EMOTIONAL_DISTRESS || []),
    ...(activeDict.WORSENING_DISTRESS || []),
    ...(activeDict.SUBSTANCE || []),
    ...(activeDict.DISTRESS || []),
  ];

  // Deny, hyperbole, and reassurance phrases
  const denyPhrases = [
    ...(activeDict.EXPRESSION_HYPERBOLE || []),
    ...(activeDict.DENY_HYPERBOLE || []),
  ];
  const reassurancePhrases = [
    ...(activeDict.DEESCALATION_REASSURANCE || []),
  ];
  const confirmPhrases = [
    ...(activeDict.CONFIRMATION_SIGNAL || []),
    ...(activeDict.CONFIRM_LITERAL || []),
  ];

  const latest = normalizeText(input.latestUserMessage);
  const history = Array.isArray(input.history) ? input.history : [];
  const priorSignal = normalizeDistressSignal(input.previousDistressSignal);
  const priorSafety = normalizeSafetyStatus(input.previousSafetyStatus);

  // Use a recent conversation window (last 3 user messages) to avoid sticky distress from distant turns
  const userMessages = history
    .filter((item) => String(item.role || "").toLowerCase() === "user")
    .map((item) => normalizeText(item.text));

  const recentUserWindow = userMessages.slice(-3);
  const recentWindowText = [...recentUserWindow, latest].join(" ");

  // Full transcript for historical reference
  const fullUserText = [...userMessages, latest].join(" ");

  // 1. Scan for Action Taken and Explicit Plans in latest and recent window
  const latestActionHits = getUnnegatedMatches(latest, actionPhrases);
  const latestPlanHits = getUnnegatedMatches(latest, planPhrases);
  const latestCriticalSelfHarm = scanCategoryMatches(latest, activeDict, CRITICAL_SELF_HARM_CATEGORIES);
  const latestSafeguarding = scanCategoryMatches(latest, activeDict, SAFEGUARDING_CONCERN_CATEGORIES);
  const latestDistress = scanCategoryMatches(latest, activeDict, DISTRESS_CATEGORIES);

  // Also scan recent window
  const windowCriticalSelfHarm = scanCategoryMatches(recentWindowText, activeDict, CRITICAL_SELF_HARM_CATEGORIES);
  const windowSafeguarding = scanCategoryMatches(recentWindowText, activeDict, SAFEGUARDING_CONCERN_CATEGORIES);
  const windowDistress = scanCategoryMatches(recentWindowText, activeDict, DISTRESS_CATEGORIES);

  const allDetectedCategories = Array.from(new Set([
    ...latestCriticalSelfHarm.categories,
    ...latestSafeguarding.categories,
    ...latestDistress.categories,
    ...windowCriticalSelfHarm.categories,
    ...windowSafeguarding.categories,
    ...windowDistress.categories,
  ]));

  const concernType = resolveConcernType(allDetectedCategories);

  // =========================================================================
  // REQUIREMENT 1: ACTION TAKEN OR EXPLICIT PLAN/MEANS/TIMEFRAME
  // Explicit statement of attempt/action or near-term plan with means MUST
  // trigger immediate CONFIRMED_CRITICAL WITHOUT clarification questions.
  // =========================================================================
  if (latestActionHits.length > 0) {
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      concern_type: "SELF_HARM",
      admin_flag_reason: "Immediate critical action taken detected: '" + latestActionHits[0] + "'.",
      persona: "CRITICAL_SAFETY",
      detected_categories: ["ACTION_TAKEN"],
      matched_indicators: latestActionHits,
    });
  }

  if (latestPlanHits.length > 0) {
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      concern_type: "SELF_HARM",
      admin_flag_reason: "Explicit near-term suicide plan / means detected: '" + latestPlanHits[0] + "'.",
      persona: "CRITICAL_SAFETY",
      detected_categories: ["PLAN_MEANS_TIMEFRAME"],
      matched_indicators: latestPlanHits,
    });
  }

  // Check if prior status was already CONFIRMED_CRITICAL
  if (priorSafety === "CONFIRMED_CRITICAL") {
    // A de-escalation must NOT erase a confirmed critical safety situation without appropriate reassessment
    if (looksLikeDenyReply(latest, denyPhrases, reassurancePhrases)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        concern_type: concernType !== "NONE" ? concernType : "SELF_HARM",
        admin_flag_reason: "Previously confirmed concern cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
        detected_categories: allDetectedCategories,
        matched_indicators: windowCriticalSelfHarm.matchedPhrases,
      });
    }
    // Student remains in CONFIRMED_CRITICAL
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      concern_type: concernType !== "NONE" ? concernType : "SELF_HARM",
      admin_flag_reason: "Ongoing confirmed critical safety situation.",
      persona: "CRITICAL_SAFETY",
      detected_categories: allDetectedCategories,
      matched_indicators: windowCriticalSelfHarm.matchedPhrases,
    });
  }

  // Respond to an open CLARIFICATION_NEEDED turn
  if (priorSafety === "CLARIFICATION_NEEDED") {
    if (looksLikeDenyReply(latest, denyPhrases, reassurancePhrases)) {
      return buildResult({
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        concern_type: concernType !== "NONE" ? concernType : "EMOTIONAL_DISTRESS",
        admin_flag_reason: "Safeguarding indicator cleared after student clarified hyperbole/frustration.",
        persona: "DISTRESS_SUPPORT",
        detected_categories: allDetectedCategories,
        matched_indicators: windowCriticalSelfHarm.matchedPhrases,
      });
    }

    if (
      includesAnyUnnegated(latest, confirmPhrases) ||
      includesAnyUnnegated(latest, selfHarmLiteral) ||
      includesAnyUnnegated(latest, selfHarmAmbiguous) ||
      looksLikeConfirmationReply(latest)
    ) {
      return buildResult({
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        concern_type: concernType !== "NONE" ? concernType : "SELF_HARM",
        admin_flag_reason: "Student confirmed literal safety concern after clarification.",
        persona: "CRITICAL_SAFETY",
        detected_categories: allDetectedCategories,
        matched_indicators: latestCriticalSelfHarm.matchedPhrases,
      });
    }

    // Still ambiguous - stay in clarification
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      concern_type: concernType !== "NONE" ? concernType : "SELF_HARM",
      admin_flag_reason: "Awaiting safety clarification for indicator signals.",
      persona: "CRITICAL_CLARIFY",
      detected_categories: allDetectedCategories,
      matched_indicators: windowCriticalSelfHarm.matchedPhrases,
    });
  }

  // Check if latest message is a denial/hyperbole filter
  if (looksLikeDenyReply(latest, denyPhrases, reassurancePhrases)) {
    return buildResult({
      distress_signal: "NONE",
      safety_status: "NOT_NEEDED",
      risk_level: "NONE",
      concern_type: "NONE",
      admin_flag_reason: null,
      persona: "COMPANION",
      detected_categories: [],
      matched_indicators: [],
    });
  }

  // =========================================================================
  // REQUIREMENT 1 (Ambiguous Self-Harm) -> CLARIFICATION_NEEDED
  // =========================================================================
  const selfHarmLiteralHits = getUnnegatedMatches(latest, selfHarmLiteral);
  const selfHarmAmbiguousHits = getUnnegatedMatches(latest, selfHarmAmbiguous);
  if (selfHarmLiteralHits.length > 0 || selfHarmAmbiguousHits.length > 0) {
    const sample = selfHarmLiteralHits[0] || selfHarmAmbiguousHits[0];
    return buildResult({
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      concern_type: "SELF_HARM",
      admin_flag_reason: "Potential self-harm concern detected: '" + sample + "' (Requires clarification).",
      persona: "CRITICAL_CLARIFY",
      detected_categories: latestCriticalSelfHarm.categories,
      matched_indicators: [...selfHarmLiteralHits, ...selfHarmAmbiguousHits],
    });
  }

  // =========================================================================
  // REQUIREMENT 3: SEPARATE CONCERN TYPE (SAFETY_SUPPORT PATHWAY)
  // Bullying, Abuse, Grooming, Coercion, Threats, Unsafe Environment, AI Attachment
  // Must NOT be treated as ordinary emotional distress or trigger wellness tools.
  // =========================================================================
  if (latestSafeguarding.matchedPhrases.length > 0) {
    const isImminentThreat = latestSafeguarding.categories.includes("THREAT_VIOLENCE") ||
                            latestSafeguarding.categories.includes("ABUSE");
    return buildResult({
      distress_signal: isImminentThreat ? "CRITICAL" : "DISTRESS",
      safety_status: isImminentThreat ? "CLARIFICATION_NEEDED" : "NOT_NEEDED",
      risk_level: "LOW",
      concern_type: concernType,
      admin_flag_reason: "Safeguarding concern detected [" + getIndicatorCategoryLabel(concernType) + "]: '" + latestSafeguarding.matchedPhrases[0] + "'.",
      persona: "SAFETY_SUPPORT",
      detected_categories: latestSafeguarding.categories,
      matched_indicators: latestSafeguarding.matchedPhrases,
    });
  }

  // =========================================================================
  // REQUIREMENT 7: FIX STICKY DISTRESS
  // Evaluate distress primarily from latest message and recent window.
  // If recent message communicated de-escalation ("okay na, kaya ko pa"), transition to NONE.
  // =========================================================================
  if (looksLikeDeescalation(latest, reassurancePhrases)) {
    return buildResult({
      distress_signal: "NONE",
      safety_status: "NOT_NEEDED",
      risk_level: "NONE",
      concern_type: "NONE",
      admin_flag_reason: null,
      persona: "COMPANION",
      detected_categories: [],
      matched_indicators: [],
    });
  }

  // Check latest message distress hits
  if (latestDistress.matchedPhrases.length > 0) {
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: "NOT_NEEDED",
      risk_level: "LOW",
      concern_type: "EMOTIONAL_DISTRESS",
      admin_flag_reason: "Emotional distress language detected: '" + latestDistress.matchedPhrases[0] + "'.",
      persona: "DISTRESS_SUPPORT",
      detected_categories: latestDistress.categories,
      matched_indicators: latestDistress.matchedPhrases,
    });
  }

  // Check recent window distress hits (within last 3 turns)
  if (windowDistress.matchedPhrases.length > 0) {
    return buildResult({
      distress_signal: "DISTRESS",
      safety_status: "NOT_NEEDED",
      risk_level: "LOW",
      concern_type: "EMOTIONAL_DISTRESS",
      admin_flag_reason: "Recent emotional distress context: '" + windowDistress.matchedPhrases[0] + "'.",
      persona: "DISTRESS_SUPPORT",
      detected_categories: windowDistress.categories,
      matched_indicators: windowDistress.matchedPhrases,
    });
  }

  // Normal conversation
  return buildResult({
    distress_signal: "NONE",
    safety_status: "NOT_NEEDED",
    risk_level: "NONE",
    concern_type: "NONE",
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
  looksLikeDenyReply,
  looksLikeDeescalation,
  looksLikeConfirmationReply,
  isPhraseNegated,
  resolveConcernType,
};

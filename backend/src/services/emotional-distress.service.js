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
 */

const LITERAL_CRITICAL_PHRASES = [
  // Clear intent/plan language only — bare "suicide"/"suicidal"/"want to die" are AMBIGUOUS.
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
    /\bjust\s+(?:super\s+)?(?:stressed|exhausted|tired|frustrated|overwhelmed)\b/i.test(value)
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

function buildClarificationReply(langHint) {
  const taglish = /[àáâãäåæçèéêë]|ako|ko|mo|yung|parang|hindi|gusto|pagod/i.test(langHint || "");
  if (taglish) {
    return "Gusto kong siguraduhin na naiintindihan kita ng tama. Kapag sinabi mong gusto mong tumigil o 'di na gusto mabuhay, literal ba 'yan ngayon, o pinapahayag mo lang kung gaano ka-overwhelm? Kung may plano kang saktan ang sarili mo ngayon, sabihin mo nang diretso para matulungan kita.";
  }
  return "I want to make sure I understand you correctly. When you talk about wanting to quit or not wanting to go on, do you mean that literally right now, or are you expressing how overwhelmed you feel? If you are thinking about hurting yourself or ending your life right now, please tell me clearly so I can help you get support.";
}

function buildConfirmedCriticalReply(langHint) {
  const taglish = /[àáâãäåæçèéêë]|ako|ko|mo|yung|parang|hindi|gusto|pagod/i.test(langHint || "");
  if (taglish) {
    return "Salamat sa pagiging tapat. Ang safety mo ang pinakaimportante ngayon — hindi kita iiwan sa ganitong bigat. Kung nasa panganib ka ngayon, gumamit ng emergency/hotline support o kausapin agad ang guidance counselor. Nandito ako para suportahan ka, hindi para magbigay ng productivity advice.";
  }
  return "Thank you for telling me clearly. Your safety matters most right now — I will not push goals or productivity tips. If you are in danger right now, please use emergency or hotline support, or reach a guidance counselor. I am here to support you calmly and help you get human help.";
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
  const combined = `${studentHistoryText} ${latest}`.trim();

  // Phase 2: respond to an open clarification
  if (priorSafety === "CLARIFICATION_NEEDED") {
    // DENY / negation first — including "not … ending my life" and "No haha, just super stressed".
    if (looksLikeDenyReply(latest)) {
      return {
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason: "Critical-language trigger cleared after student clarified hyperbole/frustration.",
        force_pet_reply: null,
        persona: "DISTRESS_SUPPORT",
      };
    }
    if (
      includesAnyUnnegated(latest, CONFIRM_LITERAL) ||
      includesAnyUnnegated(latest, LITERAL_CRITICAL_PHRASES)
    ) {
      return {
        distress_signal: "CRITICAL",
        safety_status: "CONFIRMED_CRITICAL",
        risk_level: "HIGH",
        admin_flag_reason: "Student confirmed literal safety concern after clarification.",
        force_pet_reply: buildConfirmedCriticalReply(latest),
        persona: "CRITICAL_SAFETY",
      };
    }
    // Still ambiguous — stay in clarification
    return {
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Awaiting safety clarification for critical-language signals.",
      force_pet_reply: buildClarificationReply(latest),
      persona: "CRITICAL_CLARIFY",
    };
  }

  const literalHits =
    countUnnegatedMatches(combined, LITERAL_CRITICAL_PHRASES) +
    countUnnegatedMatches(latest, LITERAL_CRITICAL_PHRASES);
  const ambiguousHitsLatest = countMatches(latest, AMBIGUOUS_CRITICAL_PHRASES);
  const ambiguousHitsHistory = countMatches(studentHistoryText, AMBIGUOUS_CRITICAL_PHRASES);
  const distressHits = countMatches(combined, DISTRESS_PHRASES);
  const escalating =
    ambiguousHitsHistory + ambiguousHitsLatest >= 2 ||
    (ambiguousHitsLatest >= 1 && distressHits >= 1) ||
    (priorSignal === "DISTRESS" && ambiguousHitsLatest >= 1);

  // Same-turn deny / negation wins over history escalate and bare literal substrings.
  if (looksLikeDenyReply(latest)) {
    return {
      distress_signal: "DISTRESS",
      safety_status: "CLEARED",
      risk_level: "LOW",
      admin_flag_reason: "Critical-sounding language cleared by negation or hyperbole in the latest reply.",
      force_pet_reply: null,
      persona: "DISTRESS_SUPPORT",
    };
  }

  // Clear literal intent / plan language → confirmed without waiting.
  // Negated phrases ("not thinking of ending my life") do not count.
  const hyperboleContext =
    includesAny(latest, DENY_HYPERBOLE) ||
    /[\u{1F602}\u{1F923}\u{1F62D}]|jk\b|idk just|for (?:my )?thesis|essay|research/u.test(latest);
  if (literalHits >= 1 && !hyperboleContext) {
    return {
      distress_signal: "CRITICAL",
      safety_status: "CONFIRMED_CRITICAL",
      risk_level: "HIGH",
      admin_flag_reason: "Clear literal safety-concern language detected.",
      force_pet_reply: buildConfirmedCriticalReply(latest),
      persona: "CRITICAL_SAFETY",
    };
  }
  if (literalHits >= 1 && hyperboleContext) {
    return {
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Literal-sounding phrase appeared with hyperbole/academic context — clarification required.",
      force_pet_reply: buildClarificationReply(latest),
      persona: "CRITICAL_CLARIFY",
    };
  }

  // Ambiguous critical language or escalation → clarify first (no crisis modal yet)
  if (ambiguousHitsLatest >= 1 || escalating) {
    return {
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Critical-language trigger requires safety clarification before confirmed crisis.",
      force_pet_reply: buildClarificationReply(latest),
      persona: "CRITICAL_CLARIFY",
    };
  }

  // Ambiguous critical language or escalation → clarify first (no crisis modal yet)
  if (ambiguousHitsLatest >= 1 || escalating) {
    // Soften if message is clearly hyperbolic in the same turn
    if (includesAny(latest, DENY_HYPERBOLE) && ambiguousHitsLatest <= 1 && !escalating) {
      return {
        distress_signal: "DISTRESS",
        safety_status: "CLEARED",
        risk_level: "LOW",
        admin_flag_reason: "Critical-sounding phrase appeared with clear hyperbole/frustration markers.",
        force_pet_reply: null,
        persona: "DISTRESS_SUPPORT",
      };
    }
    return {
      distress_signal: "CRITICAL",
      safety_status: "CLARIFICATION_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: "Critical-language trigger requires safety clarification before confirmed crisis.",
      force_pet_reply: buildClarificationReply(latest),
      persona: "CRITICAL_CLARIFY",
    };
  }

  if (distressHits >= 1 || priorSignal === "DISTRESS") {
    return {
      distress_signal: "DISTRESS",
      safety_status: priorSafety === "CLEARED" ? "CLEARED" : "NOT_NEEDED",
      risk_level: "LOW",
      admin_flag_reason: distressHits >= 1 ? "Emotional distress language detected (not confirmed crisis)." : null,
      force_pet_reply: null,
      persona: "DISTRESS_SUPPORT",
    };
  }

  return {
    distress_signal: "NONE",
    safety_status: "NOT_NEEDED",
    risk_level: "NONE",
    admin_flag_reason: null,
    force_pet_reply: null,
    persona: "COMPANION",
  };
}

function personaInstructions(persona) {
  switch (String(persona || "COMPANION").toUpperCase()) {
    case "CRITICAL_CLARIFY":
      return [
        "PERSONA OBJECTIVE: Calm safety assessor.",
        "Do NOT give productivity tips, thesis advice, or 'one small task' coaching.",
        "Ask one clear safety-clarification question about whether concerning statements are literal or figurative.",
        "Stay warm and direct. Do not diagnose depression or suicidality.",
      ].join(" ");
    case "CRITICAL_SAFETY":
      return [
        "PERSONA OBJECTIVE: Calm safety supporter after confirmed concern.",
        "Drop chit-chat and goal coaching. Acknowledge the seriousness, urge human/emergency support, stay present.",
        "Do not diagnose. Do not ask productivity questions.",
      ].join(" ");
    case "DISTRESS_SUPPORT":
      return [
        "PERSONA OBJECTIVE: Empathic supporter for emotional distress (not crisis modal).",
        "Validate overwhelm without diagnosing. No hotline spam unless they confirm danger.",
      ].join(" ");
    default:
      return "PERSONA OBJECTIVE: Warm journaling companion.";
  }
}

module.exports = {
  assessEmotionalDistress,
  normalizeDistressSignal,
  normalizeSafetyStatus,
  toCompatRiskLevel,
  personaInstructions,
};

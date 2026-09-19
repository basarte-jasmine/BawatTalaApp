/**
 * Categories and default phrases for the Counselor-Managed Safety & Well-being Indicators System.
 */

const SAFETY_INDICATOR_CATEGORIES = {
  "SELF_HARM": "SELF_HARM",
  "ABUSE": "ABUSE",
  "GROOMING": "GROOMING",
  "COERCION_BLACKMAIL": "COERCION_BLACKMAIL",
  "BULLYING_HARASSMENT": "BULLYING_HARASSMENT",
  "THREAT_VIOLENCE": "THREAT_VIOLENCE",
  "UNSAFE_ENVIRONMENT": "UNSAFE_ENVIRONMENT",
  "SUBSTANCE": "SUBSTANCE",
  "EMOTIONAL_DISTRESS": "EMOTIONAL_DISTRESS",
  "EXPRESSION_HYPERBOLE": "EXPRESSION_HYPERBOLE",
  "CONFIRMATION_SIGNAL": "CONFIRMATION_SIGNAL",
  "OTHER": "OTHER",
  "CRITICAL_LITERAL": "CRITICAL_LITERAL",
  "CRITICAL_AMBIGUOUS": "CRITICAL_AMBIGUOUS",
  "DISTRESS": "DISTRESS",
  "DENY_HYPERBOLE": "DENY_HYPERBOLE",
  "CONFIRM_LITERAL": "CONFIRM_LITERAL",
  "POWER_IMBALANCE": "POWER_IMBALANCE",
  "SECRECY": "SECRECY",
  "BOUNDARY_CROSSING": "BOUNDARY_CROSSING",
  "AI_ATTACHMENT": "AI_ATTACHMENT"
};

const SAFETY_INDICATOR_SEVERITY_TIERS = {
  "CRITICAL": "CRITICAL",
  "AMBIGUOUS": "AMBIGUOUS",
  "DISTRESS": "DISTRESS",
  "FILTER": "FILTER",
  "CONFIRMATION": "CONFIRMATION"
};

const SAFETY_INDICATOR_CATEGORY_LABELS = {
  "SELF_HARM": "Self-Harm / Suicide Concern",
  "ABUSE": "Abuse / Domestic Harm",
  "GROOMING": "Grooming & Interpersonal Exploitation",
  "COERCION_BLACKMAIL": "Coercion, Blackmail & Extortion",
  "BULLYING_HARASSMENT": "Bullying & Harassment",
  "THREAT_VIOLENCE": "Threats & Violence",
  "UNSAFE_ENVIRONMENT": "Unsafe Environment & Neglect",
  "SUBSTANCE": "Substance & Addiction Concern",
  "EMOTIONAL_DISTRESS": "Emotional Distress & Overwhelm",
  "EXPRESSION_HYPERBOLE": "Expression & Hyperbole Filter",
  "CONFIRMATION_SIGNAL": "Confirmation Signal",
  "OTHER": "General Safeguarding Indicator",
  "CRITICAL_LITERAL": "Urgent Intent (Critical)",
  "CRITICAL_AMBIGUOUS": "Ambiguous Concern",
  "DISTRESS": "Emotional Distress",
  "DENY_HYPERBOLE": "Hyperbole & Expression Filter",
  "CONFIRM_LITERAL": "Confirmation Signal",
  "POWER_IMBALANCE": "Power Imbalance / Authority Gap",
  "SECRECY": "Secrecy Demands",
  "BOUNDARY_CROSSING": "Boundary Crossing",
  "AI_ATTACHMENT": "AI Attachment / Parasocial"
};

const SAFETY_INDICATOR_CATEGORY_DESCRIPTIONS = {
  "SELF_HARM": "Direct or ambiguous statements indicating thoughts of self-harm or suicide. Evaluated via Two-Phase clarification.",
  "ABUSE": "Statements describing physical, emotional, or domestic abuse at home, school, or relationships.",
  "GROOMING": "Suspicious adult-student boundaries, inappropriate gifts, private messaging, or requests to meet alone.",
  "COERCION_BLACKMAIL": "Extortion, blackmail, coercion (threatening to leak photos, forcing payments/favors).",
  "BULLYING_HARASSMENT": "Repeated humiliation, malicious exclusion, targeted online harassment, or severe peer pressure.",
  "THREAT_VIOLENCE": "Direct threats of violence or harm from or toward another individual.",
  "UNSAFE_ENVIRONMENT": "Unsafe living conditions, domestic hostility, homelessness, or severe neglect.",
  "SUBSTANCE": "Concerns regarding substance misuse, forced intoxication, or dependency.",
  "EMOTIONAL_DISTRESS": "Severe emotional overwhelm, burnout, chronic stress, or feeling unable to cope.",
  "EXPRESSION_HYPERBOLE": "Idiomatic venting, academic stress expressions, jokes, or hyperbole that de-escalate flags.",
  "CONFIRMATION_SIGNAL": "Explicit confirmations indicating literal intent during Phase 2 clarification.",
  "OTHER": "Custom counselor-defined well-being or safeguarding indicators.",
  "CRITICAL_LITERAL": "Direct, explicit statements of intent or crisis.",
  "CRITICAL_AMBIGUOUS": "Passive ideation or ambiguous expressions of despair.",
  "DISTRESS": "Language indicating severe emotional overwhelm, stress, or burnout.",
  "DENY_HYPERBOLE": "Idiomatic expressions or humor that clear critical flags.",
  "CONFIRM_LITERAL": "Phrases indicating the student statement was literal.",
  "POWER_IMBALANCE": "Authority-student or power-gap romantic/sexual dynamics (counselor-configured).",
  "SECRECY": "Pressure to keep relationships or contact secret (counselor-configured).",
  "BOUNDARY_CROSSING": "Inappropriate boundary crossing by an authority figure (counselor-configured).",
  "AI_ATTACHMENT": "Romantic/parasocial attachment toward the AI companion (counselor-configured)."
};

const DEFAULT_INDICATORS_BY_CATEGORY = {
  "SELF_HARM": [
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
    "magpakamatay",
    "magpapakamatay",
    "papatayin ko sarili ko",
    "tapusin ang aking buhay",
    "ayaw ko nang mabuhay",
    "ayoko nang mabuhay",
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
    "gusto ko na lang mamatay",
    "gusto ko nang mamatay",
    "gusto kong mamatay",
    "mamatay na",
    "mamatay na lang",
    "mamatay",
    "tapusin ang lahat",
    "tapusin na lahat",
    "tapusin lahat",
    "ayoko na mabuhay",
    "ayaw ko na mabuhay"
  ],
  "ABUSE": [
    "he hits me",
    "she hits me",
    "sinasaktan ako sa bahay",
    "sinasaktan ako",
    "physically abused",
    "being abused",
    "domestic abuse",
    "he hurts me physically",
    "she hurts me physically",
    "binubugbog ako",
    "tinatamaan ako sa bahay"
  ],
  "GROOMING": [
    "teacher asks me to meet alone",
    "teacher wants to meet alone",
    "he gives me special gifts",
    "asks for private photos",
    "teacher messages me privately late at night",
    "secret relationship with teacher"
  ],
  "COERCION_BLACKMAIL": [
    "blackmailing me",
    "blackmail",
    "leak my photos",
    "leaking my photos",
    "threatens to post my pictures",
    "threatening to post my pictures",
    "threatening to leak my photos",
    "threatening to spread my photos",
    "spread my photos",
    "forcing me to send photos",
    "binablackmail ako",
    "ipagkakalat ang pictures ko",
    "kakalat ang photos ko",
    "sinisingil ako kundi ipopost",
    "they said something bad will happen if i tell",
    "scared to say no"
  ],
  "BULLYING_HARASSMENT": [
    "everyone keeps bullying me",
    "they keep bullying me",
    "humiliating me",
    "they're humiliating me",
    "they keep threatening me",
    "binubully ako",
    "pinapahiya ako",
    "cyberbullying",
    "cyberbullied",
    "they created a hate group"
  ],
  "THREAT_VIOLENCE": [
    "someone threatened me",
    "he's going to hurt me",
    "hes going to hurt me",
    "banta sa buhay ko",
    "he threatened to kill me",
    "threatened to harm me",
    "i want to hurt someone"
  ],
  "UNSAFE_ENVIRONMENT": [
    "unsafe at home",
    "not safe at home",
    "hindi ligtas sa bahay",
    "takot umuwi sa bahay",
    "kicked out of my house",
    "pinalayas sa bahay",
    "nowhere to sleep"
  ],
  "SUBSTANCE": [
    "forced to take drugs",
    "pinilit uminom ng droga",
    "substance abuse",
    "overdose on pills"
  ],
  "EMOTIONAL_DISTRESS": [
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
    "di ko na kaya",
    "hindi ko na kaya",
    "sobra nang bigat",
    "nothing matters",
    "nothing else matters",
    "nothing else matter",
    "i want to quit everything",
    "quit everything",
    "don't want to do this anymore",
    "dont want to do this anymore"
  ],
  "CONFIRMATION_SIGNAL": [
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
    "totoo po",
    "talaga po",
    "seryoso ako",
    "seryoso po"
  ],
  "EXPRESSION_HYPERBOLE": [
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
    "joke lang",
    "biro lang",
    "venting lang"
  ],
  "CRITICAL_LITERAL": [
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
    "magpakamatay",
    "magpapakamatay",
    "papatayin ko sarili ko",
    "tapusin ang aking buhay",
    "ayaw ko nang mabuhay",
    "ayoko nang mabuhay"
  ],
  "CRITICAL_AMBIGUOUS": [
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
    "gusto ko na lang mamatay",
    "gusto ko nang mamatay",
    "gusto kong mamatay",
    "mamatay na",
    "mamatay na lang",
    "mamatay",
    "tapusin ang lahat",
    "tapusin na lahat",
    "tapusin lahat",
    "ayoko na mabuhay",
    "ayaw ko na mabuhay"
  ],
  "DISTRESS": [
    "overwhelmed",
    "burned out",
    "burnt out",
    "so stressed",
    "exhausted",
    "hopeless",
    "i can't cope",
    "i cant cope",
    "giving up",
    "want to give up"
  ],
  "CONFIRM_LITERAL": [
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
    "i have a plan to"
  ],
  "DENY_HYPERBOLE": [
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
    "was just an expression"
  ]
};

function normalizeIndicatorPhrase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeIndicatorCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return SAFETY_INDICATOR_CATEGORIES[normalized] || "";
}

function normalizeIndicatorSeverity(value, category = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (SAFETY_INDICATOR_SEVERITY_TIERS[normalized]) {
    return SAFETY_INDICATOR_SEVERITY_TIERS[normalized];
  }
  const normCat = normalizeIndicatorCategory(category);
  if (normCat === "EXPRESSION_HYPERBOLE" || normCat === "DENY_HYPERBOLE") return "FILTER";
  if (normCat === "CONFIRMATION_SIGNAL" || normCat === "CONFIRM_LITERAL") return "CONFIRMATION";
  if (normCat === "EMOTIONAL_DISTRESS" || normCat === "DISTRESS" || normCat === "UNSAFE_ENVIRONMENT" || normCat === "SUBSTANCE") return "DISTRESS";
  if (normCat === "CRITICAL_AMBIGUOUS") return "AMBIGUOUS";
  return "CRITICAL";
}

function normalizeVariantsList(val) {
  if (Array.isArray(val)) {
    const set = new Set();
    for (const v of val) {
      const p = normalizeIndicatorPhrase(v);
      if (p) set.add(p);
    }
    return Array.from(set);
  }
  if (typeof val === "string") {
    const set = new Set();
    const parts = val.split(",");
    for (const part of parts) {
      const p = normalizeIndicatorPhrase(part);
      if (p) set.add(p);
    }
    return Array.from(set);
  }
  return [];
}

function getIndicatorCategoryLabel(value) {
  const cat = normalizeIndicatorCategory(value);
  return SAFETY_INDICATOR_CATEGORY_LABELS[cat] || "Indicator";
}


/** 8 top-level CMS display domains → sub-indicator categories (phrases stay per category in DB). */
const SAFEGUARDING_DOMAINS = Object.freeze({
  SELF_HARM_CRISIS: ["SELF_HARM", "CRITICAL_LITERAL", "CRITICAL_AMBIGUOUS", "CONFIRMATION_SIGNAL"],
  ABUSE: ["ABUSE"],
  /** Display: "Grooming, Power Imbalance & Boundary Concerns" — sub-indicators stay distinct in assessor. */
  GROOMING_POWER_BOUNDARY: ["GROOMING", "POWER_IMBALANCE", "SECRECY", "BOUNDARY_CROSSING"],
  COERCION: ["COERCION_BLACKMAIL"],
  BULLYING_HARASSMENT: ["BULLYING_HARASSMENT"],
  THREAT_VIOLENCE: ["THREAT_VIOLENCE"],
  UNSAFE_ENVIRONMENT: ["UNSAFE_ENVIRONMENT", "SUBSTANCE"],
  AI_ATTACHMENT: ["AI_ATTACHMENT"],
});

const SAFEGUARDING_DOMAIN_LABELS = Object.freeze({
  SELF_HARM_CRISIS: "Self-Harm & Crisis",
  ABUSE: "Abuse",
  GROOMING_POWER_BOUNDARY: "Grooming, Power Imbalance & Boundary Concerns",
  COERCION: "Coercion & Blackmail",
  BULLYING_HARASSMENT: "Bullying & Harassment",
  THREAT_VIOLENCE: "Threat & Violence",
  UNSAFE_ENVIRONMENT: "Unsafe Environment & Substance",
  AI_ATTACHMENT: "AI Attachment / Parasocial",
});

module.exports = {
  DEFAULT_INDICATORS_BY_CATEGORY,
  SAFEGUARDING_DOMAINS,
  SAFEGUARDING_DOMAIN_LABELS,
  SAFETY_INDICATOR_CATEGORIES,
  SAFETY_INDICATOR_CATEGORY_DESCRIPTIONS,
  SAFETY_INDICATOR_CATEGORY_LABELS,
  SAFETY_INDICATOR_SEVERITY_TIERS,
  getIndicatorCategoryLabel,
  normalizeIndicatorCategory,
  normalizeIndicatorPhrase,
  normalizeIndicatorSeverity,
  normalizeVariantsList,
};

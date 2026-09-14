const { query } = require("../config/db");
const {
  DEFAULT_INDICATORS_BY_CATEGORY,
  SAFETY_INDICATOR_CATEGORIES,
  SAFETY_INDICATOR_SEVERITY_TIERS,
  normalizeIndicatorCategory,
  normalizeIndicatorPhrase,
  normalizeIndicatorSeverity,
} = require("../constants/safety-risk-indicators");

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache
let cachedDictionary = null;
let cacheExpiresAt = 0;

const CANONICAL_INDICATORS = [
  // 1. SELF_HARM (10)
  { phrase: "kill myself", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Explicit suicide intent", variants: ["killing myself", "going to kill myself", "i will kill myself", "i'm going to kill myself", "im going to kill myself", "i've decided to kill myself", "ive decided to kill myself"] },
  { phrase: "end my life", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Explicit intent to end life", variants: ["ending my life", "tapusin ang aking buhay"] },
  { phrase: "do not want to be alive", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Direct statement of not wanting to live", variants: ["i don't want to be alive", "i dont want to be alive", "don't want to be alive", "dont want to be alive", "do not want to be alive anymore", "don't want to be alive anymore", "dont want to be alive anymore", "do not want to live", "don't want to live", "dont want to live", "i don't want to live", "i dont want to live"] },
  { phrase: "magpakamatay", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Tagalog suicide intent", variants: ["magpapakamatay", "papatayin ko sarili ko"] },
  { phrase: "ayaw ko nang mabuhay", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Tagalog statement of not wanting to live", variants: ["ayoko nang mabuhay", "ayoko na mabuhay", "ayaw ko na mabuhay"] },
  { phrase: "hurt myself", category: "SELF_HARM", severity_tier: "CRITICAL", description: "Physical self-harm intent", variants: ["hurting myself", "going to hurt myself", "i will hurt myself"] },
  { phrase: "want to die", category: "SELF_HARM", severity_tier: "AMBIGUOUS", description: "Passive ideation; requires clarification", variants: ["i want to die", "want to be dead", "wanna die"] },
  { phrase: "gusto ko nang mamatay", category: "SELF_HARM", severity_tier: "AMBIGUOUS", description: "Tagalog passive ideation", variants: ["gusto ko na lang mamatay", "gusto kong mamatay", "mamatay na", "mamatay na lang", "mamatay"] },
  { phrase: "suicide", category: "SELF_HARM", severity_tier: "AMBIGUOUS", description: "Suicide references or self-harm", variants: ["suicidal", "self harm", "self-harm"] },
  { phrase: "tapusin ang lahat", category: "SELF_HARM", severity_tier: "AMBIGUOUS", description: "Tagalog expression of ending everything", variants: ["tapusin na lahat", "tapusin lahat"] },

  // 2. COERCION_BLACKMAIL (3)
  { phrase: "leak my photos", category: "COERCION_BLACKMAIL", severity_tier: "CRITICAL", description: "Photo leaking or image extortion", variants: ["leaking my photos", "threatens to post my pictures", "threatening to post my pictures", "threatening to leak my photos", "threatening to spread my photos", "spread my photos", "forcing me to send photos", "ipagkakalat ang pictures ko", "kakalat ang photos ko", "ipopost ang picture ko"] },
  { phrase: "blackmail", category: "COERCION_BLACKMAIL", severity_tier: "CRITICAL", description: "Blackmail or extortion under threat", variants: ["blackmailing me", "being blackmailed", "binablackmail ako", "sinisingil ako kundi ipopost"] },
  { phrase: "scared to say no", category: "COERCION_BLACKMAIL", severity_tier: "CRITICAL", description: "Coercion or fear of reporting", variants: ["afraid to say no", "they said something bad will happen if i tell", "forcing me"] },

  // 3. GROOMING (5)
  { phrase: "teacher asks me to meet alone", category: "GROOMING", severity_tier: "CRITICAL", description: "Inappropriate private meeting request", variants: ["teacher wants to meet alone", "professor asks to meet alone", "meet in private"] },
  { phrase: "keep our messages secret", category: "GROOMING", severity_tier: "CRITICAL", description: "Secrecy demands regarding communications", variants: ["keep our chat secret", "don't tell anyone about us", "dont tell anyone about us", "huwag sabihin sa magulang", "huwag ipagsabi", "secret from my parents", "secret from parents"] },
  { phrase: "he gives me special gifts", category: "GROOMING", severity_tier: "CRITICAL", description: "Gifts aimed at building secrecy/dependency", variants: ["giving me expensive gifts", "teacher gives me gifts"] },
  { phrase: "asks for private photos", category: "GROOMING", severity_tier: "CRITICAL", description: "Requests for nude or private pictures", variants: ["asking for explicit photos", "asking for nudes", "asks for nudes", "hingi ng picture"] },
  { phrase: "teacher messages me privately", category: "GROOMING", severity_tier: "CRITICAL", description: "Late-night private messaging", variants: ["teacher chats me late at night", "secret relationship with teacher"] },

  // 4. ABUSE (3)
  { phrase: "he hits me", category: "ABUSE", severity_tier: "CRITICAL", description: "Physical violence or battery", variants: ["she hits me", "they hit me", "he beats me", "she beats me", "binubugbog ako", "tinatamaan ako sa bahay", "he hurts me physically", "she hurts me physically"] },
  { phrase: "sinasaktan ako sa bahay", category: "ABUSE", severity_tier: "CRITICAL", description: "Domestic or physical harm at home", variants: ["sinasaktan ako", "physical abuse", "physically abused", "domestic abuse"] },
  { phrase: "verbal abuse", category: "ABUSE", severity_tier: "DISTRESS", description: "Severe hostile verbal attacks", variants: ["verbally abused", "always screaming at me", "mura nang mura sa bahay"] },

  // 5. BULLYING_HARASSMENT (3)
  { phrase: "everyone keeps bullying me", category: "BULLYING_HARASSMENT", severity_tier: "DISTRESS", description: "Repeated bullying or peer cruelty", variants: ["they keep bullying me", "bullying me", "binubully ako", "bina-bully ako"] },
  { phrase: "they're humiliating me", category: "BULLYING_HARASSMENT", severity_tier: "DISTRESS", description: "Public humiliation or shaming", variants: ["humiliating me", "pinapahiya ako", "mocking me online"] },
  { phrase: "cyberbullying", category: "BULLYING_HARASSMENT", severity_tier: "DISTRESS", description: "Targeted online harassment or hate groups", variants: ["cyberbullied", "created a hate group", "online harassment"] },

  // 6. THREAT_VIOLENCE (3)
  { phrase: "someone threatened me", category: "THREAT_VIOLENCE", severity_tier: "CRITICAL", description: "Threats of physical harm or violence", variants: ["he's going to hurt me", "hes going to hurt me", "threatened to harm me"] },
  { phrase: "he threatened to kill me", category: "THREAT_VIOLENCE", severity_tier: "CRITICAL", description: "Death threats", variants: ["banta sa buhay ko", "banta sa akin", "sasaktan ako"] },
  { phrase: "i want to hurt someone", category: "THREAT_VIOLENCE", severity_tier: "CRITICAL", description: "Violence ideation toward others", variants: ["going to hurt them", "gusto kong manakit"] },

  // 7. UNSAFE_ENVIRONMENT (3)
  { phrase: "unsafe at home", category: "UNSAFE_ENVIRONMENT", severity_tier: "DISTRESS", description: "Threatening or hazardous home environment", variants: ["not safe at home", "hindi ligtas sa bahay", "takot umuwi sa bahay"] },
  { phrase: "kicked out of my house", category: "UNSAFE_ENVIRONMENT", severity_tier: "DISTRESS", description: "Homelessness or eviction", variants: ["pinalayas sa bahay", "nowhere to sleep", "nowhere to go", "walang matuluyan"] },
  { phrase: "takot umuwi", category: "UNSAFE_ENVIRONMENT", severity_tier: "DISTRESS", description: "Fear of returning home", variants: ["afraid to go home", "takot sa bahay"] },

  // 8. SUBSTANCE (3)
  { phrase: "forced to take drugs", category: "SUBSTANCE", severity_tier: "CRITICAL", description: "Forced intoxication or drink spiking", variants: ["pinilit uminom ng droga", "forced to drink alcohol", "spiked my drink"] },
  { phrase: "overdose on pills", category: "SUBSTANCE", severity_tier: "CRITICAL", description: "Prescription misuse or overdose", variants: ["taking all the pills", "substance abuse", "inom ng madaming gamot"] },
  { phrase: "substance addiction", category: "SUBSTANCE", severity_tier: "DISTRESS", description: "Addiction or dependency struggles", variants: ["drug addiction", "alcohol addiction", "nalululong"] },

  // 9. EMOTIONAL_DISTRESS (7)
  { phrase: "overwhelmed", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "High stress or feeling overloaded", variants: ["so stressed", "super stressed", "feeling overwhelmed", "sobra nang bigat", "bigat na bigat"] },
  { phrase: "burned out", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "Severe burnout and exhaustion", variants: ["burnt out", "exhausted", "mental exhaustion", "pagod na pagod"] },
  { phrase: "i can't cope", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "Inability to cope with pressure", variants: ["i cant cope", "cannot cope", "di ko na kaya", "hindi ko na kaya"] },
  { phrase: "giving up", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "Hopelessness without crisis intent", variants: ["want to give up", "hopeless", "feeling hopeless"] },
  { phrase: "quit everything", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "Wanting to quit school or responsibilities", variants: ["i want to quit everything", "don't want to do this anymore", "dont want to do this anymore"] },
  { phrase: "nothing matters", category: "EMOTIONAL_DISTRESS", severity_tier: "DISTRESS", description: "Apathy or feeling nothing matters", variants: ["nothing else matters", "nothing else matter"] },
  { phrase: "rest for life", category: "EMOTIONAL_DISTRESS", severity_tier: "AMBIGUOUS", description: "Desire for prolonged rest/sleep", variants: ["rest like for life", "sleep forever"] },

  // 10. EXPRESSION_HYPERBOLE (7)
  { phrase: "just an expression", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Figurative or idiomatic venting", variants: ["its just an expression", "it's just an expression", "just an expression bro", "expression bro", "an expression", "it was just an expression", "was just an expression"] },
  { phrase: "just joking", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Joking, laughter, or hyperbole", variants: ["just kidding", "exaggerating", "i'm joking", "im joking", "joke lang", "biro lang", "haha", "hahaha", "lol", "lmao", "figuratively"] },
  { phrase: "just venting", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Venting frustration", variants: ["only venting", "just venting bro", "im just venting", "i'm just venting", "venting lang"] },
  { phrase: "not literally", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Explicit negation of literal intent", variants: ["not seriously", "not for real", "don't mean it", "dont mean it", "not serious", "not thinking of", "not thinking about"] },
  { phrase: "thesis is killing me", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Academic hyperbole", variants: ["killing me", "dying of", "dying from", "so hard i want to die", "for my thesis", "about suicide", "studying suicide", "research on suicide", "just exhausted", "just frustrated", "just tired"] },
  { phrase: "joke lang po", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Tagalog polite joke clarification", variants: ["joke lang", "biro lang po", "exaggerate lang"] },
  { phrase: "stressed lang po", category: "EXPRESSION_HYPERBOLE", severity_tier: "FILTER", description: "Tagalog stress disclaimer", variants: ["stressed lang", "sobrang stress lang", "pagod lang po"] },

  // 11. CONFIRMATION_SIGNAL (7)
  { phrase: "i mean it", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Explicit confirmation of seriousness", variants: ["i actually mean it", "i actually mean", "i mean that literally", "i literally mean it", "i literally mean", "for real i mean", "yes i mean it", "yes i really mean"] },
  { phrase: "i really want to die", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Direct reaffirmation of critical intent", variants: ["i actually want to die", "gusto ko na talaga mamatay", "talagang ayoko na"] },
  { phrase: "i have a plan", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Confirmation of plan or means", variants: ["i've got a plan", "ive got a plan", "i have a plan to", "may plano na ako"] },
  { phrase: "totoo po", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Tagalog confirmation affirmation", variants: ["talaga po", "seryoso ako", "seryoso po", "oo totoo"] },
  { phrase: "i don't want to be alive", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Reaffirmation of intent in Phase 2", variants: ["i dont want to be alive", "ayoko na talaga mabuhay"] },
  { phrase: "literally mean it", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Confirmation of literal meaning", variants: ["literal po", "literal talaga", "for real"] },
  { phrase: "yes i do", category: "CONFIRMATION_SIGNAL", severity_tier: "CONFIRMATION", description: "Direct affirmative response in clarification", variants: ["yes po", "opo", "oo nga po"] }
];

function cloneDefaultDictionary() {
  const dict = {};
  for (const item of CANONICAL_INDICATORS) {
    if (!Array.isArray(dict[item.category])) dict[item.category] = [];
    dict[item.category].push(item.phrase);
    for (const v of item.variants || []) {
      if (!dict[item.category].includes(v)) {
        dict[item.category].push(v);
      }
    }
  }

  // Populate legacy keys for backward compatibility
  dict.CRITICAL_LITERAL = [...(dict.SELF_HARM || [])];
  dict.CRITICAL_AMBIGUOUS = [
    "i want to die", "want to die", "want to be dead", "gusto ko na lang mamatay",
    "gusto ko nang mamatay", "gusto kong mamatay", "mamatay na", "mamatay na lang",
    "tapusin ang lahat", "tapusin na lahat", "tapusin lahat", "rest for life", "rest like for life"
  ];
  dict.DISTRESS = [...(dict.EMOTIONAL_DISTRESS || [])];
  dict.DENY_HYPERBOLE = [...(dict.EXPRESSION_HYPERBOLE || [])];
  dict.CONFIRM_LITERAL = [...(dict.CONFIRMATION_SIGNAL || [])];

  return dict;
}

function invalidateSafetyRiskIndicatorsCache() {
  cachedDictionary = null;
  cacheExpiresAt = 0;
}

function getSafetyRiskIndicatorDictionarySync() {
  if (cachedDictionary && Date.now() < cacheExpiresAt) {
    return cachedDictionary;
  }
  return cachedDictionary || cloneDefaultDictionary();
}

async function getSafetyRiskIndicatorDictionary(forceRefresh = false) {
  if (!forceRefresh && cachedDictionary && Date.now() < cacheExpiresAt) {
    return cachedDictionary;
  }

  try {
    const result = await query(
      "select phrase, category, coalesce(severity_tier, 'CRITICAL') as severity_tier, variants from public.safety_risk_indicators where is_enabled = true order by category asc, phrase asc"
    );

    if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
      cachedDictionary = cloneDefaultDictionary();
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return cachedDictionary;
    }

    const dict = {};
    for (const key of Object.keys(SAFETY_INDICATOR_CATEGORIES)) {
      dict[key] = [];
    }

    for (const row of result.rows) {
      const cat = normalizeIndicatorCategory(row.category);
      const phrase = normalizeIndicatorPhrase(row.phrase);
      if (cat && phrase) {
        if (!Array.isArray(dict[cat])) dict[cat] = [];
        if (!dict[cat].includes(phrase)) dict[cat].push(phrase);

        const rowVariants = Array.isArray(row.variants) ? row.variants : [];
        for (const variant of rowVariants) {
          const normVariant = normalizeIndicatorPhrase(variant);
          if (normVariant && !dict[cat].includes(normVariant)) {
            dict[cat].push(normVariant);
          }
        }
      }
    }

    // Populate backward-compatible legacy keys
    if ((!dict.CRITICAL_LITERAL || dict.CRITICAL_LITERAL.length === 0) && dict.SELF_HARM?.length > 0) {
      dict.CRITICAL_LITERAL = [...dict.SELF_HARM];
    }
    if ((!dict.DISTRESS || dict.DISTRESS.length === 0) && dict.EMOTIONAL_DISTRESS?.length > 0) {
      dict.DISTRESS = [...dict.EMOTIONAL_DISTRESS];
    }
    if ((!dict.DENY_HYPERBOLE || dict.DENY_HYPERBOLE.length === 0) && dict.EXPRESSION_HYPERBOLE?.length > 0) {
      dict.DENY_HYPERBOLE = [...dict.EXPRESSION_HYPERBOLE];
    }
    if ((!dict.CONFIRM_LITERAL || dict.CONFIRM_LITERAL.length === 0) && dict.CONFIRMATION_SIGNAL?.length > 0) {
      dict.CONFIRM_LITERAL = [...dict.CONFIRMATION_SIGNAL];
    }

    // Fall back to defaults if any category list is empty
    for (const key of Object.keys(SAFETY_INDICATOR_CATEGORIES)) {
      if (!dict[key] || dict[key].length === 0) {
        dict[key] = [...(DEFAULT_INDICATORS_BY_CATEGORY[key] || [])];
      }
    }

    cachedDictionary = dict;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedDictionary;
  } catch (error) {
    console.warn("Could not load dynamic safety indicators from database. Using built-in defaults.", {
      error: error instanceof Error ? error.message : String(error),
    });
    cachedDictionary = cloneDefaultDictionary();
    cacheExpiresAt = Date.now() + 10000;
    return cachedDictionary;
  }
}

async function consolidateExistingIndicatorVariants(poolClient = null) {
  const dbQuery = poolClient
    ? (sql, params) => poolClient.query(sql, params)
    : (sql, params) => query(sql, params);

  for (const item of CANONICAL_INDICATORS) {
    try {
      await dbQuery(
        "insert into public.safety_risk_indicators (phrase, category, severity_tier, is_enabled, description, variants) values ($1, $2, $3, true, $4, $5::jsonb) on conflict (phrase) do update set category = excluded.category, severity_tier = excluded.severity_tier, variants = (select jsonb_agg(distinct elem) from jsonb_array_elements_text(coalesce(public.safety_risk_indicators.variants, '[]'::jsonb) || $5::jsonb) as elem), updated_at = now()",
        [item.phrase, item.category, item.severity_tier, item.description, JSON.stringify(item.variants)]
      );

      // Clean up any stray row where phrase was one of the variants
      await dbQuery(
        "delete from public.safety_risk_indicators where phrase = any($1::text[]) and phrase != $2",
        [item.variants, item.phrase]
      );
    } catch (e) {
      // continue
    }
  }
}

async function ensureDefaultSafetyRiskIndicators(poolClient = null) {
  const dbQuery = poolClient
    ? (sql, params) => poolClient.query(sql, params)
    : (sql, params) => query(sql, params);

  try {
    for (const item of CANONICAL_INDICATORS) {
      await dbQuery(
        "insert into public.safety_risk_indicators (phrase, category, severity_tier, is_enabled, description, variants) values ($1, $2, $3, true, $4, $5::jsonb) on conflict (phrase) do nothing",
        [item.phrase, item.category, item.severity_tier, item.description, JSON.stringify(item.variants)]
      );
    }
    await consolidateExistingIndicatorVariants(poolClient);
    invalidateSafetyRiskIndicatorsCache();
  } catch (error) {
    console.warn("ensureDefaultSafetyRiskIndicators could not seed defaults:", error?.message || error);
  }
}

module.exports = {
  CANONICAL_INDICATORS,
  cloneDefaultDictionary,
  consolidateExistingIndicatorVariants,
  ensureDefaultSafetyRiskIndicators,
  getSafetyRiskIndicatorDictionary,
  getSafetyRiskIndicatorDictionarySync,
  invalidateSafetyRiskIndicatorsCache,
};


const assert = require("node:assert/strict");

function test(name, fn) {
  try {
    fn();
    console.log("✔ PASS: " + name);
  } catch (error) {
    console.error("✖ FAIL: " + name);
    console.error(error);
    process.exitCode = 1;
  }
}
 const {
   DEFAULT_INDICATORS_BY_CATEGORY,
   SAFETY_INDICATOR_CATEGORIES,
   normalizeIndicatorCategory,
   normalizeIndicatorPhrase,
   getIndicatorCategoryLabel,
 } = require("../src/constants/safety-risk-indicators");
 const {
   assessEmotionalDistress,
   normalizeDistressSignal,
   normalizeSafetyStatus,
   toCompatRiskLevel,
 } = require("../src/services/emotional-distress.service");
const {
  cloneDefaultDictionary,
  getSafetyRiskIndicatorDictionarySync,
  invalidateSafetyRiskIndicatorsCache,
} = require("../src/services/safety-risk-indicators.service");
const {
  inferJournalTagsFromText,
  normalizeJournalTags,
} = require("../src/constants/journal-tags");
 
test("Safety Risk Indicator Constants & Categories", () => {
  assert.equal(normalizeIndicatorCategory("critical_literal"), "CRITICAL_LITERAL");
  assert.equal(normalizeIndicatorCategory("CRITICAL_AMBIGUOUS"), "CRITICAL_AMBIGUOUS");
  assert.equal(normalizeIndicatorCategory("distress"), "DISTRESS");
  assert.equal(normalizeIndicatorCategory("deny_hyperbole"), "DENY_HYPERBOLE");
  assert.equal(normalizeIndicatorCategory("confirm_literal"), "CONFIRMED_LITERAL" in SAFETY_INDICATOR_CATEGORIES ? "CONFIRMED_LITERAL" : "CONFIRM_LITERAL");
  assert.equal(normalizeIndicatorCategory("INVALID"), "");

  assert.equal(normalizeIndicatorPhrase("  Gusto Ko   Nang Mamatay  "), "gusto ko nang mamatay");
  assert.equal(getIndicatorCategoryLabel("CRITICAL_LITERAL"), "Urgent Intent (Critical)");
});

test("Safety Risk Indicators Cache and Default Dictionary", () => {
  const dict = getSafetyRiskIndicatorDictionarySync();
  assert.ok(Array.isArray(dict.CRITICAL_LITERAL));
  assert.ok(dict.CRITICAL_LITERAL.includes("kill myself"));
   assert.ok(dict.CRITICAL_LITERAL.includes("magpakamatay"));
   assert.ok(dict.CRITICAL_AMBIGUOUS.includes("gusto ko na lang mamatay"));
   assert.ok(dict.DISTRESS.includes("overwhelmed"));
   assert.ok(dict.DENY_HYPERBOLE.includes("just an expression"));
   assert.ok(dict.CONFIRM_LITERAL.includes("i actually mean it"));
 
   invalidateSafetyRiskIndicatorsCache();
   const fresh = getSafetyRiskIndicatorDictionarySync();
   assert.ok(fresh.CRITICAL_LITERAL.length > 0);
 });
 
 test("Two-Phase Engine: Phase 1 triggers clarification (not immediate crisis)", () => {
   const res = assessEmotionalDistress({
     latestUserMessage: "I feel like I want to end my life right now",
     history: [],
   });
 
   assert.equal(res.distress_signal, "CRITICAL");
   assert.equal(res.safety_status, "CLARIFICATION_NEEDED");
   assert.equal(res.risk_level, "LOW"); // Two-phase keeps risk LOW until confirmed
   assert.equal(res.persona, "CRITICAL_CLARIFY");
 });
 
 test("Two-Phase Engine: Phase 2 Confirmed Critical escalation", () => {
   const res = assessEmotionalDistress({
     latestUserMessage: "Yes, I really mean it and I have a plan",
     history: [
       { role: "user", text: "I want to end my life" },
       { role: "assistant", text: "Are you saying this literally right now or are you feeling overwhelmed?" },
     ],
     previousDistressSignal: "CRITICAL",
     previousSafetyStatus: "CLARIFICATION_NEEDED",
   });
 
   assert.equal(res.distress_signal, "CRITICAL");
   assert.equal(res.safety_status, "CONFIRMED_CRITICAL");
   assert.equal(res.risk_level, "HIGH");
   assert.equal(res.persona, "CRITICAL_SAFETY");
 });
 
 test("Two-Phase Engine: Phase 2 Cleared De-escalation on expression/hyperbole denial", () => {
   const res = assessEmotionalDistress({
     latestUserMessage: "No, sorry it was just an expression! Thesis is just super stressful haha",
     history: [
       { role: "user", text: "I want to die" },
       { role: "assistant", text: "Are you in danger right now?" },
     ],
     previousDistressSignal: "CRITICAL",
     previousSafetyStatus: "CLARIFICATION_NEEDED",
   });
 
   assert.equal(res.distress_signal, "DISTRESS");
   assert.equal(res.safety_status, "CLEARED");
   assert.equal(res.risk_level, "LOW");
   assert.equal(res.persona, "DISTRESS_SUPPORT");
 });
 
 test("Two-Phase Engine: Negation handling prevents false alarm", () => {
   const res = assessEmotionalDistress({
     latestUserMessage: "Don't worry, I am not thinking of hurting myself, just studying for exams",
     history: [],
   });
 
   assert.notEqual(res.safety_status, "CONFIRMED_CRITICAL");
 });
 
 test("Two-Phase Engine: Custom dynamic CMS indicators work seamlessly", () => {
   const customDictionary = {
     CRITICAL_LITERAL: ["custom crisis trigger code 99"],
     CRITICAL_AMBIGUOUS: ["custom ambiguous signal code 88"],
     DISTRESS: ["custom extreme burnout 77"],
     DENY_HYPERBOLE: ["custom joke disclaimer 00"],
     CONFIRM_LITERAL: ["custom literal confirm 11"],
   };
 
   // Test custom critical phrase triggering Phase 1
   const p1 = assessEmotionalDistress({
     latestUserMessage: "I am feeling custom crisis trigger code 99 today",
     dictionary: customDictionary,
   });
   assert.equal(p1.distress_signal, "CRITICAL");
   assert.equal(p1.safety_status, "CLARIFICATION_NEEDED");
   assert.equal(p1.persona, "CRITICAL_CLARIFY");
 
   // Test custom denial phrase clearing in Phase 2
   const p2 = assessEmotionalDistress({
     latestUserMessage: "custom joke disclaimer 00",
     history: [{ role: "user", text: "I am feeling custom crisis trigger code 99" }],
     previousDistressSignal: "CRITICAL",
     previousSafetyStatus: "CLARIFICATION_NEEDED",
     dictionary: customDictionary,
   });
  assert.equal(p2.safety_status, "CLEARED");
  assert.equal(p2.persona, "DISTRESS_SUPPORT");
});

test("Safety Risk Indicator Audit Log Trail Payload Structure", () => {
  const sampleBefore = {
    id: "d4b8e21a-4c28-4e1b-9721-3b7c938ef61a",
    phrase: "i want to quit",
    category: "CRITICAL_AMBIGUOUS",
    description: "Old notes",
    is_enabled: true,
  };
  const sampleAfter = {
    phrase: "i want to quit everything",
    category: "CRITICAL_AMBIGUOUS",
    description: "Updated notes",
    isEnabled: true,
  };

  const changes = {};
  if (sampleBefore.phrase !== sampleAfter.phrase) {
    changes.fromPhrase = sampleBefore.phrase;
    changes.toPhrase = sampleAfter.phrase;
  }
  if ((sampleBefore.description || "") !== (sampleAfter.description || "")) {
    changes.fromDescription = sampleBefore.description;
    changes.toDescription = sampleAfter.description;
  }

  assert.equal(changes.fromPhrase, "i want to quit");
  assert.equal(changes.toPhrase, "i want to quit everything");
  assert.equal(changes.fromDescription, "Old notes");
  assert.equal(changes.toDescription, "Updated notes");
});

test("Dynamic CMS Variants & Tagalog Equivalents without Code Hardcoding", () => {
  const dynamicDict = {
    CRITICAL_LITERAL: [
      "ayaw ko nang mabuhay",
      "ayoko nang mabuhay",
      "ayoko na mabuhay",
      "do not want to be alive",
      "dont want to be alive",
    ],
    CRITICAL_AMBIGUOUS: [],
    DISTRESS: [
      "cannot cope",
      "di ko na kaya",
      "hindi ko na kaya",
    ],
    CONFIRM_LITERAL: [],
    DENY_HYPERBOLE: [
      "just joking",
      "joke lang",
      "biro lang",
    ],
  };

  // 1. Tagalog contraction variant triggers Phase 1 clarification
  const r1 = assessEmotionalDistress({
    latestUserMessage: "Sobrang hirap ng sitwasyon, ayoko na mabuhay sa totoo lang",
    dictionary: dynamicDict,
  });
  assert.equal(r1.distress_signal, "CRITICAL");
  assert.equal(r1.safety_status, "CLARIFICATION_NEEDED");
  assert.equal(r1.persona, "CRITICAL_CLARIFY");

  // 2. Tagalog equivalent denial in Phase 2 clears it
  const r2 = assessEmotionalDistress({
    latestUserMessage: "Hala sorry joke lang po yun! Stress lang talaga",
    dictionary: dynamicDict,
    previousDistressSignal: "CRITICAL",
    previousSafetyStatus: "CLARIFICATION_NEEDED",
  });
  assert.equal(r2.safety_status, "CLEARED");
  assert.equal(r2.persona, "DISTRESS_SUPPORT");
});

test("Two-Phase Engine: Healthy romance and crushes default to NONE risk", () => {
  const res1 = assessEmotionalDistress({
    latestUserMessage: "I really like my classmate and he smiled at me today! So kilig",
    history: [],
  });
  assert.equal(res1.distress_signal, "NONE");
  assert.equal(res1.safety_status, "NOT_NEEDED");
  assert.equal(res1.risk_level, "NONE");
  assert.equal(res1.persona, "COMPANION");

  const res2 = assessEmotionalDistress({
    latestUserMessage: "I want to have a girlfriend someday, I hope to find love",
    history: [],
  });
  assert.equal(res2.distress_signal, "NONE");
  assert.equal(res2.safety_status, "NOT_NEEDED");
  assert.equal(res2.risk_level, "NONE");
  assert.equal(res2.persona, "COMPANION");
});

test("Two-Phase Engine: Relationship distress (heartbreak) maps to DISTRESS / LOW", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "My girlfriend broke up with me and I am so heartbroken and overwhelmed",
    history: [],
  });
  assert.equal(res.distress_signal, "DISTRESS");
  assert.equal(res.safety_status, "NOT_NEEDED");
  assert.equal(res.risk_level, "LOW");
  assert.equal(res.persona, "DISTRESS_SUPPORT");
});

test("Journal Tags: Romantic & Interpersonal Relationships inferred correctly", () => {
  const tags1 = inferJournalTagsFromText("I talked with my boyfriend and crush today, so happy");
  assert.ok(tags1.includes("Romantic"));
  assert.ok(tags1.includes("Interpersonal relationships"));

  const tags2 = inferJournalTagsFromText("I am having a hard time with my thesis and assignments");
  assert.ok(tags2.includes("Academic problems"));
});

test("Two-Phase Engine: Blended sentiment & romance without distress stays NONE risk", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "I fell in love with my best friend and my heart is beating so fast! Excited for our date tomorrow",
    history: [],
  });
  assert.equal(res.distress_signal, "NONE");
  assert.equal(res.safety_status, "NOT_NEEDED");
  assert.equal(res.risk_level, "NONE");
  assert.equal(res.persona, "COMPANION");
});

test("Two-Phase Engine: Coercion & Photo Leaking triggers Phase 1 clarification under COERCION_BLACKMAIL", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "Someone is threatening to leak my photos online and demanding money",
    history: [],
  });

  assert.equal(res.distress_signal, "CRITICAL");
  assert.equal(res.safety_status, "CLARIFICATION_NEEDED");
  assert.equal(res.risk_level, "LOW");
  assert.ok(res.detected_categories.includes("COERCION_BLACKMAIL"));
  assert.ok(res.admin_flag_reason.includes("Coercion"));
});

test("Two-Phase Engine: Blackmail / Photo joke clears in Phase 2", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "Haha joke lang, my friend just has an ugly candid pic of me eating",
    history: [
      { role: "user", text: "My friend is blackmailing me with my pictures lmao" },
      { role: "assistant", text: "Are you in danger or facing someone trying to expose you?" }
    ],
    previousDistressSignal: "CRITICAL",
    previousSafetyStatus: "CLARIFICATION_NEEDED",
  });

  assert.equal(res.distress_signal, "DISTRESS");
  assert.equal(res.safety_status, "CLEARED");
  assert.equal(res.risk_level, "LOW");
  assert.equal(res.persona, "DISTRESS_SUPPORT");
});

test("Two-Phase Engine: Confirmed Blackmail / Extortion escalates to CONFIRMED_CRITICAL", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "Yes, I really mean it, they are demanding 5000 pesos or they will spread it to my school",
    history: [
      { role: "user", text: "Someone is threatening to leak my photos" },
      { role: "assistant", text: "Are you being threatened or extorted?" }
    ],
    previousDistressSignal: "CRITICAL",
    previousSafetyStatus: "CLARIFICATION_NEEDED",
  });

  assert.equal(res.distress_signal, "CRITICAL");
  assert.equal(res.safety_status, "CONFIRMED_CRITICAL");
  assert.equal(res.risk_level, "HIGH");
  assert.equal(res.persona, "CRITICAL_SAFETY");
});

test("Two-Phase Engine: Grooming indicator triggers Phase 1 clarification under GROOMING", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "My professor asks me to meet alone after class and keep our chat secret from my parents",
    history: [],
  });

  assert.equal(res.distress_signal, "CRITICAL");
  assert.equal(res.safety_status, "CLARIFICATION_NEEDED");
  assert.ok(res.detected_categories.includes("GROOMING"));
  assert.ok(res.admin_flag_reason.includes("Grooming"));
});

test("Two-Phase Engine: Physical Abuse indicator triggers Phase 1 clarification under ABUSE", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "Sinasaktan ako sa bahay tuwing gabi",
    history: [],
  });

  assert.equal(res.distress_signal, "CRITICAL");
  assert.equal(res.safety_status, "CLARIFICATION_NEEDED");
  assert.ok(res.detected_categories.includes("ABUSE"));
});

test("Two-Phase Engine: Bullying & Harassment triggers DISTRESS support", () => {
  const res = assessEmotionalDistress({
    latestUserMessage: "Everyone keeps bullying me and making fun of me in class",
    history: [],
  });

  assert.equal(res.distress_signal, "DISTRESS");
  assert.equal(res.safety_status, "NOT_NEEDED");
  assert.equal(res.risk_level, "LOW");
  assert.ok(res.detected_categories.includes("BULLYING_HARASSMENT"));
});


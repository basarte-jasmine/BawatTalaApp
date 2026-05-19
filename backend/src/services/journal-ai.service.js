const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const OLLAMA_BASE_URL = normalizeBaseUrl(
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "",
);
const OLLAMA_CF_ACCESS_CLIENT_ID = String(
  process.env.OLLAMA_CF_ACCESS_CLIENT_ID ||
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID ||
    "",
).trim();
const OLLAMA_CF_ACCESS_CLIENT_SECRET = String(
  process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET ||
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET ||
    "",
).trim();
const {
  JOURNAL_TAG_OPTIONS,
  inferJournalTagsFromText,
  normalizeJournalTags,
} = require("../constants/journal-tags");
const {
  getRiskLevelLabel,
  normalizeRiskTriggerLevel,
  normalizeRiskTriggerPhrase,
} = require("../constants/risk-levels");
const { query } = require("../config/db");

function normalizeBaseUrl(value) {
  const compact = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  if (!compact) return "";
  return compact.replace(/\/v1$/i, "");
}

function parseModelList(value, defaults) {
  const configured = String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return [...configured, ...defaults].filter(
    (model, index, items) => model && items.indexOf(model) === index,
  );
}

function parseConfiguredModelList(value, defaults) {
  const configured = String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const selected = configured.length ? configured : defaults;

  return selected.filter(
    (model, index, items) => model && items.indexOf(model) === index,
  );
}

const GEMINI_MODELS = parseModelList(
  process.env.GEMINI_MODELS || process.env.GEMINI_MODEL,
  ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
);
const GEMINI_RATE_LIMIT_COOLDOWN_MS = Math.max(
  8000,
  Number(process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS || 12000),
);
const GROQ_MODELS = parseModelList(
  process.env.GROQ_MODELS || process.env.GROQ_MODEL,
  ["llama-3.3-70b-versatile"],
);
const OLLAMA_MODELS = parseConfiguredModelList(
  process.env.OLLAMA_MODELS || process.env.OLLAMA_MODEL,
  ["gemma3:4b"],
);
const AI_PROVIDER_ORDER = parseProviderOrder(
  process.env.AI_CHAT_PROVIDER_ORDER ||
    process.env.AI_PROVIDER_ORDER ||
    process.env.AI_PROVIDER ||
    process.env.AI_CHAT_PROVIDER,
  ["groq", "gemini", "ollama"],
);
const OLLAMA_REQUEST_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || 60000),
);
const OLLAMA_MAX_TOKENS = Math.max(
  0,
  Number(process.env.OLLAMA_MAX_TOKENS || 0),
);
const AI_JSON_TEMPERATURE = 0.6;

let geminiCooldownUntil = 0;
let geminiLastFailure = null;
let groqLastFailure = null;
let ollamaLastFailure = null;

function parseProviderOrder(value, defaults) {
  const allowed = new Set(["ollama", "gemini", "groq"]);
  const configured = String(value || "")
    .split(",")
    .map((item) =>
      String(item || "")
        .trim()
        .toLowerCase(),
    )
    .filter((provider) => allowed.has(provider));

  return (configured.length ? configured : defaults).filter(
    (provider, index, items) => provider && items.indexOf(provider) === index,
  );
}

function cleanJsonFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseGeminiJson(text) {
  const cleaned = cleanJsonFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Failed to parse Gemini JSON response.");
  }
}

function normalizeInsights(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeRiskLevel(value) {
  const normalized = String(value || "NONE")
    .trim()
    .toUpperCase();
  if (normalized === "HIGH" || normalized === "LOW") return normalized;
  return "NONE";
}

function normalizeSentimentLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"].includes(normalized)) {
    return normalized;
  }
  return "NEUTRAL";
}

function normalizeScore(value, fallback = 0, min = -1, max = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function inferFallbackSentiment(text) {
  const value = String(text || "").toLowerCase();
  const positiveMatches = (
    value.match(/\b(happy|glad|grateful|thankful|hopeful|excited|proud|calm|relieved|okay|better|love|enjoy|appreciate|masaya|salamat|thank you)\b/g) || []
  ).length;
  const negativeMatches = (
    value.match(/\b(sad|angry|tired|stressed|stress|anxious|anxiety|worried|scared|afraid|overwhelmed|hopeless|hurt|crying|pagod|takot|galit|malungkot|iyak)\b/g) || []
  ).length;

  if (positiveMatches > 0 && negativeMatches > 0) {
    return {
      dominant_emotion: negativeMatches >= positiveMatches ? "mixed stress and hope" : "mixed relief and concern",
      sentiment_confidence: 0.55,
      sentiment_label: "MIXED",
      sentiment_score: normalizeScore((positiveMatches - negativeMatches) / Math.max(positiveMatches + negativeMatches, 1), 0),
    };
  }

  if (negativeMatches > positiveMatches) {
    return {
      dominant_emotion: "distress",
      sentiment_confidence: 0.55,
      sentiment_label: "NEGATIVE",
      sentiment_score: -0.6,
    };
  }

  if (positiveMatches > negativeMatches) {
    return {
      dominant_emotion: "positive reflection",
      sentiment_confidence: 0.55,
      sentiment_label: "POSITIVE",
      sentiment_score: 0.6,
    };
  }

  return {
    dominant_emotion: "neutral reflection",
    sentiment_confidence: 0.45,
    sentiment_label: "NEUTRAL",
    sentiment_score: 0,
  };
}

function normalizeSentimentAnalysis(value, fallbackText = "") {
  const fallback = inferFallbackSentiment(fallbackText);
  return {
    dominant_emotion: normalizeWhitespace(value?.dominant_emotion || fallback.dominant_emotion).slice(0, 80),
    sentiment_confidence: normalizeScore(value?.sentiment_confidence, fallback.sentiment_confidence, 0, 1),
    sentiment_label: normalizeSentimentLabel(value?.sentiment_label || fallback.sentiment_label),
    sentiment_score: normalizeScore(value?.sentiment_score, fallback.sentiment_score, -1, 1),
  };
}

function collectStudentJournalTexts(latestUserMessage = "", history = []) {
  const texts = [];
  const addText = (value) => {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && !texts.includes(text)) texts.push(text);
  };

  for (const item of Array.isArray(history) ? history : []) {
    const role = String(item?.role || "")
      .trim()
      .toLowerCase();
    if (role === "assistant" || role === "model") continue;
    addText(item?.text);
  }
  addText(latestUserMessage);

  return texts;
}

function getStudentJournalText(latestUserMessage = "", history = []) {
  return collectStudentJournalTexts(latestUserMessage, history).join("\n");
}

function getRiskEvidenceText(latestUserMessage = "", history = [], summaries = []) {
  return [
    getStudentJournalText(latestUserMessage, history),
    ...(Array.isArray(summaries) ? summaries : [summaries]),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n");
}

function hasStrongDistressContext(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return false;

  return [
    /\b(?:can't|cannot|cant|can not)\s+(?:cope|handle|function|breathe|sleep|eat|focus|calm down)\b/,
    /\b(?:di|hindi)\s+(?:ko\s+)?(?:kaya|makaya|okay)\b/,
    /\b(?:sobrang|super|very|really|so|extremely|severely|intensely|totally|completely)\s+(?:anxious|overwhelmed|stressed|distressed|scared|afraid|panicked|panic|sad|down|empty|numb)\b/,
    /\b(?:panic attack|anxiety attack|breaking down|breakdown|meltdown|spiraling|spiralling|losing control|not okay|not ok|hindi okay|di okay)\b/,
    /\b(?:hopeless|worthless|helpless|desperate|empty|numb)\b/,
    /\b(?:unsafe|danger|abuse|abused|assault|violence|threatened|harassed|harassment|hit me|hurt me|hurts me)\b/,
    /\b(?:self[-\s]?harm|suicid(?:e|al)|kill myself|end my life|hurt myself)\b/,
    /\b(?:crying|iyak|umiiyak)\s+(?:all day|for days|for weeks|nonstop|constantly)\b/,
    /\b(?:need|needs|want|wants)\s+(?:emotional\s+)?(?:support|counsel(?:ing|ling)|someone to talk to|professional help)\b/,
  ].some((pattern) => pattern.test(value));
}

function calibrateRiskSignal(riskSignal, studentText) {
  const riskLevel = normalizeRiskLevel(riskSignal?.risk_level);
  if (riskLevel === "NONE") {
    return {
      risk_level: "NONE",
      admin_flag_reason: null,
    };
  }

  if (riskLevel === "LOW" && !hasStrongDistressContext(studentText)) {
    return {
      risk_level: "NONE",
      admin_flag_reason: null,
    };
  }

  return {
    risk_level: riskLevel,
    admin_flag_reason:
      riskSignal?.admin_flag_reason == null
        ? null
        : String(riskSignal.admin_flag_reason).trim() || null,
  };
}

function pickMirrorLanguageTemplate(latestUserMessage) {
  const text = String(latestUserMessage || "").trim();
  if (!text) {
    return {
      acknowledge: "Salamat sa pag-share.",
      reflect: "Mukhang may bigat itong dala para sa'yo.",
    };
  }

  const hasFilipinoMarkers =
    /\b(ako|ko|mo|siya|si|naman|talaga|kasi|bakit|ewan|malungkot|pagod|naiinis|natatae|gutom|inaantok)\b/i.test(
      text,
    );
  const hasEnglishLetters = /[a-z]/i.test(text);

  if (hasFilipinoMarkers && hasEnglishLetters) {
    return {
      acknowledge: "Salamat sa pag-share.",
      reflect: "Mukhang may bigat o gulo itong dala para sa'yo.",
    };
  }

  if (hasEnglishLetters && !hasFilipinoMarkers) {
    return {
      acknowledge: "Thanks for sharing that.",
      reflect: "It sounds like this is really sitting with you right now.",
    };
  }

  return {
    acknowledge: "Salamat sa pag-share.",
    reflect: "Mukhang may bigat itong dala para sa'yo.",
  };
}

async function unavailableConversationAnalysis(latestUserMessage = "", history = []) {
  const studentText = getStudentJournalText(latestUserMessage, history);
  const heuristicRisk = calibrateRiskSignal(
    await riskFromSeverityWords(studentText),
    studentText,
  );

  return {
    pet_reply: null,
    summary: "",
    insights: [],
    risk_level: heuristicRisk.risk_level,
    admin_flag_reason: heuristicRisk.admin_flag_reason,
    unavailable_reason: "ai_temporarily_unavailable",
  };
}

function parseProviderJson(text) {
  return parseGeminiJson(text);
}

function getFallbackFinalSummary(studentText, sentimentAnalysis = {}) {
  const text = String(studentText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "This journal entry was saved, but Muni could not create a fuller summary yet.";
  }

  const dominantEmotion = String(sentimentAnalysis.dominant_emotion || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const firstSentence = text.match(/[^.!?]+[.!?]?/)?.[0] || text;
  const excerpt = firstSentence.length > 150
    ? `${firstSentence.slice(0, 147).trim()}...`
    : firstSentence.trim();
  const theme = dominantEmotion && dominantEmotion !== "neutral reflection"
    ? ` around ${dominantEmotion}`
    : "";

  return `This entry reflects${theme} through the thought: ${excerpt}`;
}

async function unavailableFinalAnalysis(latestUserMessage = "", history = []) {
  const studentText = getStudentJournalText(latestUserMessage, history);
  const heuristicRisk = calibrateRiskSignal(
    await riskFromSeverityWords(studentText),
    studentText,
  );
  const fallbackTags = inferJournalTagsFromText(studentText);
  const fallbackSentiment = inferFallbackSentiment(studentText);

  return {
    pet_reply: "",
    summary: getFallbackFinalSummary(studentText, fallbackSentiment),
    insights: [],
    ...fallbackSentiment,
    risk_level: heuristicRisk.risk_level,
    admin_flag_reason: heuristicRisk.admin_flag_reason,
    suggested_tags: fallbackTags,
    unavailable_reason: "ai_temporarily_unavailable",
  };
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getGeminiCooldownRemainingMs() {
  return Math.max(0, geminiCooldownUntil - Date.now());
}

function markGeminiRateLimited(detail) {
  geminiCooldownUntil = Date.now() + GEMINI_RATE_LIMIT_COOLDOWN_MS;
  geminiLastFailure = {
    cooldownMs: GEMINI_RATE_LIMIT_COOLDOWN_MS,
    occurredAt: new Date().toISOString(),
    reason: "rate_limit",
    ...detail,
  };
}

function clearGeminiFailureState() {
  geminiCooldownUntil = 0;
  geminiLastFailure = null;
}

function clearGroqFailureState() {
  groqLastFailure = null;
}

function clearOllamaFailureState() {
  ollamaLastFailure = null;
}

function normalizePetReply(rawReply, latestUserMessage) {
  const addTerminalPunctuation = (line) => {
    const text = normalizeWhitespace(line);
    if (!text) return "";
    return /[.!?)]$/.test(text) ? text : `${text}.`;
  };

  const cleanReply = String(rawReply || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => addTerminalPunctuation(line))
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");

  if (cleanReply) {
    return cleanReply;
  }

  return "";
}

function getReplyOpening(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}

function getRecentAssistantOpenings(history = []) {
  const openings = [];
  for (const item of [...(Array.isArray(history) ? history : [])].reverse()) {
    const role = String(item?.role || "").trim().toLowerCase();
    if (role !== "assistant" && role !== "model") continue;
    const opening = getReplyOpening(item?.text || "");
    if (opening && !openings.includes(opening)) {
      openings.push(opening);
    }
    if (openings.length >= 3) break;
  }
  return openings.reverse();
}

function getRecentAssistantFirstWords(history = []) {
  const firstWords = [];
  for (const item of [...(Array.isArray(history) ? history : [])].reverse()) {
    const role = String(item?.role || "").trim().toLowerCase();
    if (role !== "assistant" && role !== "model") continue;
    const firstWord = getReplyOpening(item?.text || "").split(/\s+/)[0] || "";
    if (firstWord && !firstWords.includes(firstWord)) {
      firstWords.push(firstWord);
    }
    if (firstWords.length >= 5) break;
  }
  return firstWords.reverse();
}

function getConversationMetadata(history = [], latestUserMessage = "") {
  const userTurns = (Array.isArray(history) ? history : []).filter((item) => {
    const role = String(item?.role || "").trim().toLowerCase();
    return role === "user";
  }).length;
  const depth = userTurns < 3 ? "early" : userTurns < 8 ? "mid" : "deep";
  const hasFilipino =
    /\b(ako|ko|mo|siya|naman|talaga|kasi|bakit|ewan)\b/i.test(
      String(latestUserMessage || ""),
    );

  return {
    depth,
    mode: hasFilipino ? "Taglish/Filipino" : "English",
    turnCount: userTurns + 1,
  };
}

function isShortAgreement(text) {
  const cleaned = normalizeWhitespace(text).toLowerCase();
  if (!cleaned) return false;
  if (/^(?:not|hindi|di)\s+(?:ok|okay|yes|sure|sige|oo)\b/.test(cleaned)) {
    return false;
  }
  const normalized = cleaned.replace(/[^\p{L}\p{N}\s]/gu, "").trim();

  const agreements = [
    "oo",
    "sige",
    "ok",
    "okay",
    "yeah",
    "yep",
    "yes",
    "sure",
    "oo nga",
    "ah okay",
  ];

  return (
    normalized.split(/\s+/).length <= 3 &&
    agreements.includes(normalized)
  );
}

function getRecentPatterns(history = []) {
  const lastThreeMuni = (Array.isArray(history) ? history : [])
    .filter((item) => {
      const role = String(item?.role || "").trim().toLowerCase();
      return role === "assistant" || role === "model";
    })
    .slice(-3);

  const endedInQuestion =
    lastThreeMuni.length === 3 &&
    lastThreeMuni.every((item) => String(item?.text || "").trim().endsWith("?"));
  const startedWithParang = lastThreeMuni.some((item) =>
    String(item?.text || "")
      .trim()
      .toLowerCase()
      .startsWith("parang"),
  );

  return { endedInQuestion, startedWithParang };
}

function looksLikeMuniFeedback(value) {
  const text = String(value || "").toLowerCase();
  return /\b(off[-\s]?topic|random|repetitive|paulit|ulit|huh|wtf|ano sinasabi|what are you saying|nakalimutan|forgot|bakit.*tanong|why.*question|changed? topic|iba.*usapan)\b/i.test(text);
}

async function loadEnabledRiskTriggerWords() {
  try {
    const result = await query(
      `
        select phrase, risk_level
        from public.risk_trigger_words
        where is_enabled = true
        order by
          case risk_level when 'HIGH' then 0 when 'LOW' then 1 else 2 end,
          phrase asc
      `,
    );

    return result.rows
      .map((row) => ({
        phrase: normalizeRiskTriggerPhrase(row.phrase),
        riskLevel: normalizeRiskTriggerLevel(row.risk_level),
      }))
      .filter((trigger) => trigger.phrase && trigger.riskLevel);
  } catch (error) {
    console.warn("Configured risk triggers could not be loaded.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function riskFromTriggerWords(text, triggers) {
  const value = String(text || "").toLowerCase();
  const matchedTriggers = (Array.isArray(triggers) ? triggers : [])
    .map((trigger) => ({
      phrase: normalizeRiskTriggerPhrase(trigger.phrase),
      riskLevel: normalizeRiskTriggerLevel(trigger.riskLevel || trigger.risk_level),
    }))
    .filter((trigger) => trigger.phrase && trigger.riskLevel && value.includes(trigger.phrase));

  const matched =
    matchedTriggers.find((trigger) => trigger.riskLevel === "HIGH") ||
    matchedTriggers.find((trigger) => trigger.riskLevel === "LOW");
  if (matched) {
    const riskLabel = getRiskLevelLabel(matched.riskLevel);
    return {
      risk_level: matched.riskLevel,
      admin_flag_reason: `${riskLabel} trigger phrase "${matched.phrase}" was detected.`,
    };
  }

  return {
    risk_level: "NONE",
    admin_flag_reason: null,
  };
}

async function riskFromSeverityWords(text) {
  return riskFromTriggerWords(text, await loadEnabledRiskTriggerWords());
}

function mergeRiskSignals(
  modelRiskLevel,
  modelReason,
  heuristicRiskLevel,
  heuristicReason,
) {
  const order = { NONE: 0, LOW: 1, HIGH: 2 };
  const normalizedModel = normalizeRiskLevel(modelRiskLevel);
  const normalizedHeuristic = normalizeRiskLevel(heuristicRiskLevel);

  if (
    order[normalizedHeuristic] > order[normalizedModel] &&
    normalizedHeuristic === "HIGH"
  ) {
    return {
      risk_level: normalizedHeuristic,
      admin_flag_reason: heuristicReason,
    };
  }

  return {
    risk_level: normalizedModel,
    admin_flag_reason:
      normalizedModel === "NONE" || modelReason == null
        ? null
        : String(modelReason).trim() || null,
  };
}

function isQuotaError(response, data) {
  if (response?.status === 429) {
    return true;
  }

  const message = String(data?.error?.message || "").toLowerCase();
  return (
    String(data?.error?.status || "").toUpperCase() === "RESOURCE_EXHAUSTED" ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted")
  );
}

async function requestGeminiJson({
  models,
  systemInstruction,
  contents,
  schemaLines,
}) {
  const cooldownRemainingMs = getGeminiCooldownRemainingMs();
  if (cooldownRemainingMs > 0) {
    console.warn("Gemini cooldown active, skipping request.", {
      cooldownRemainingMs,
      geminiLastFailure,
      models,
    });
    return { ok: false, parsed: null, reason: "rate_limited_cooldown" };
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: AI_JSON_TEMPERATURE,
      responseMimeType: "application/json",
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };

  let lastFailure = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    let response = null;
    let data = {};

    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json().catch(() => ({}));
      if (!isQuotaError(response, data) || attempt === 1) {
        break;
      }

      markGeminiRateLimited({
        attempt: attempt + 1,
        model,
        status: response?.status,
        statusText: response?.statusText,
      });
      console.warn("Gemini quota hit, backing off before retry.", {
        cooldownMs: GEMINI_RATE_LIMIT_COOLDOWN_MS,
        model,
        status: response?.status,
        statusText: response?.statusText,
      });
      await wait(Math.min(GEMINI_RATE_LIMIT_COOLDOWN_MS, 1500 * (attempt + 1)));
    }

    const candidate = data?.candidates?.[0];
    const finishReason = String(candidate?.finishReason || "");
    const rawText =
      candidate?.content?.parts?.map((part) => part?.text || "").join("") || "";

    if (response.ok && rawText) {
      clearGeminiFailureState();
      try {
        return {
          ok: true,
          parsed: parseGeminiJson(rawText),
          provider: "gemini",
          model,
        };
      } catch (error) {
        console.error("Failed to parse Gemini JSON response.", {
          error: error instanceof Error ? error.message : String(error),
          model,
          rawText,
        });
        throw new Error(
          `Failed to parse Gemini JSON for schema: ${schemaLines.join(" ")}`,
        );
      }
    }

    if (finishReason === "SAFETY") {
      return {
        ok: true,
        parsed: {
          pet_reply:
            "Muni noticed something serious in your journal. Please pause and reach out to a trusted adult, counselor, or immediate support person right now.",
          insights: ["The message needs careful human review."],
          risk_level: "HIGH",
          admin_flag_reason:
            "Gemini safety filters were triggered while analyzing the entry.",
        },
        provider: "gemini",
        model,
      };
    }

    lastFailure = {
      finishReason,
      hasRawText: Boolean(rawText),
      model,
      status: response?.status,
      statusText: response?.statusText,
    };

    if (isQuotaError(response, data)) {
      markGeminiRateLimited(lastFailure);
      console.warn("Gemini quota hit, trying next model.", lastFailure);
      continue;
    }

    console.error("Gemini request failed.", lastFailure);
    geminiLastFailure = {
      occurredAt: new Date().toISOString(),
      reason: "request_failed",
      ...lastFailure,
    };
    return { ok: false, parsed: null, reason: "request_failed" };
  }

  if (lastFailure) {
    console.error(
      "Gemini request failed for all configured models.",
      lastFailure,
    );
  }

  return {
    ok: false,
    parsed: null,
    reason: lastFailure?.status === 429 ? "rate_limited" : "request_failed",
  };
}

async function requestGroqJson({
  models,
  systemInstruction,
  messages,
  schemaLines,
}) {
  if (!GROQ_API_KEY) {
    return { ok: false, parsed: null, reason: "groq_missing_key" };
  }

  let lastFailure = null;

  for (const model of models) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemInstruction },
              ...messages,
            ],
            temperature: AI_JSON_TEMPERATURE,
            response_format: { type: "json_object" },
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      const rawText = String(data?.choices?.[0]?.message?.content || "").trim();

      if (response.ok && rawText) {
        try {
          const parsed = parseProviderJson(rawText);
          clearGroqFailureState();
          return { ok: true, parsed, provider: "groq", model };
        } catch (error) {
          lastFailure = {
            error: error instanceof Error ? error.message : String(error),
            hasRawText: true,
            model,
            reason: "parse_failed",
            schema: schemaLines.join(" "),
            status: response?.status,
            statusText: response?.statusText,
          };
          groqLastFailure = {
            occurredAt: new Date().toISOString(),
            ...lastFailure,
          };
          console.warn(
            "Groq returned invalid JSON, trying next model.",
            lastFailure,
          );
          continue;
        }
      }

      lastFailure = {
        hasRawText: Boolean(rawText),
        model,
        reason: response.status === 429 ? "rate_limit" : "request_failed",
        status: response?.status,
        statusText: response?.statusText,
      };

      groqLastFailure = {
        occurredAt: new Date().toISOString(),
        ...lastFailure,
      };
      console.warn("Groq request failed for model, trying next model.", {
        data,
        ...lastFailure,
      });
      continue;
    } catch (error) {
      lastFailure = {
        error: error instanceof Error ? error.message : String(error),
        hasRawText: false,
        model,
        reason: "request_error",
        status: null,
        statusText: null,
      };
      groqLastFailure = {
        occurredAt: new Date().toISOString(),
        ...lastFailure,
      };
      console.warn(
        "Groq request error for model, trying next model.",
        lastFailure,
      );
      continue;
    }
  }

  if (lastFailure) {
    console.error(
      "Groq request failed for all configured models.",
      lastFailure,
    );
  }

  return {
    ok: false,
    parsed: null,
    reason:
      lastFailure?.reason === "rate_limit"
        ? "groq_rate_limited"
        : "groq_request_failed",
  };
}

function getOllamaChatCompletionsEndpoint() {
  return OLLAMA_BASE_URL ? `${OLLAMA_BASE_URL}/v1/chat/completions` : "";
}

function getOllamaRequestHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "BawatTalaBackend/1.0",
  };

  if (OLLAMA_CF_ACCESS_CLIENT_ID && OLLAMA_CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = OLLAMA_CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = OLLAMA_CF_ACCESS_CLIENT_SECRET;
  }

  return headers;
}

async function requestOllamaJson({
  models,
  systemInstruction,
  messages,
  schemaLines,
}) {
  const endpoint = getOllamaChatCompletionsEndpoint();
  if (!endpoint) {
    return { ok: false, parsed: null, reason: "ollama_missing_base_url" };
  }

  let lastFailure = null;

  for (const model of models) {
    let response = null;
    let data = {};
    const requestBody = {
      model,
      messages: [{ role: "system", content: systemInstruction }, ...messages],
      response_format: { type: "json_object" },
      stream: false,
      temperature: AI_JSON_TEMPERATURE,
    };
    if (OLLAMA_MAX_TOKENS > 0) {
      requestBody.max_tokens = OLLAMA_MAX_TOKENS;
    }

    try {
      response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: getOllamaRequestHeaders(),
          body: JSON.stringify(requestBody),
        },
        OLLAMA_REQUEST_TIMEOUT_MS,
      );
      data = await response.json().catch(() => ({}));
    } catch (error) {
      lastFailure = {
        error: error instanceof Error ? error.message : String(error),
        model,
      };
      ollamaLastFailure = {
        occurredAt: new Date().toISOString(),
        reason: "request_failed",
        ...lastFailure,
      };
      console.warn("Ollama request failed, trying next provider.", lastFailure);
      return { ok: false, parsed: null, reason: "ollama_request_failed" };
    }

    const rawText = String(data?.choices?.[0]?.message?.content || "").trim();

    if (response.ok && rawText) {
      clearOllamaFailureState();
      try {
        return {
          ok: true,
          parsed: parseProviderJson(rawText),
          provider: "ollama",
          model,
        };
      } catch (error) {
        console.error("Failed to parse Ollama JSON response.", {
          error: error instanceof Error ? error.message : String(error),
          model,
          rawText,
        });
        throw new Error(
          `Failed to parse Ollama JSON for schema: ${schemaLines.join(" ")}`,
        );
      }
    }

    lastFailure = {
      data,
      hasRawText: Boolean(rawText),
      model,
      status: response?.status,
      statusText: response?.statusText,
    };
    ollamaLastFailure = {
      occurredAt: new Date().toISOString(),
      reason: "request_failed",
      ...lastFailure,
    };
    console.warn(
      "Ollama request failed for model, trying next model.",
      lastFailure,
    );
  }

  return {
    ok: false,
    parsed: null,
    reason:
      lastFailure?.status === 404
        ? "ollama_model_not_found"
        : "ollama_request_failed",
  };
}

async function requestConfiguredProviderJson({
  systemInstruction,
  contents,
  messages,
  schemaLines,
}) {
  const providerReasons = {};

  for (const provider of AI_PROVIDER_ORDER) {
    let result = { ok: false, parsed: null, reason: "provider_not_configured" };
    console.info("Trying AI provider.", { provider });

    if (provider === "gemini") {
      result = GEMINI_API_KEY
        ? await requestGeminiJson({
            models: GEMINI_MODELS,
            systemInstruction,
            contents,
            schemaLines,
          })
        : { ok: false, parsed: null, reason: "gemini_missing_key" };
    } else if (provider === "groq") {
      result = await requestGroqJson({
        models: GROQ_MODELS,
        systemInstruction,
        messages,
        schemaLines,
      });
    } else if (provider === "ollama") {
      result = await requestOllamaJson({
        models: OLLAMA_MODELS,
        systemInstruction,
        messages,
        schemaLines,
      });
    }

    if (result.ok) {
      console.info("AI provider succeeded.", {
        model: result.model || "unknown",
        provider: result.provider || provider,
      });
      return result;
    }
    providerReasons[provider] = result.reason || "unknown";
  }

  return {
    ok: false,
    parsed: null,
    providerReasons,
    reason: "all_providers_failed",
  };
}

async function analyzeJournalConversation({
  firstName,
  latestUserMessage,
  history,
}) {
  const recentAssistantOpenings = getRecentAssistantOpenings(history);
  const recentAssistantFirstWords = getRecentAssistantFirstWords(history);
  const meta = getConversationMetadata(history, latestUserMessage);
  const patterns = getRecentPatterns(history);
  const latestMessageIsShortAgreement = isShortAgreement(latestUserMessage);
  const latestMessageIsMuniFeedback = looksLikeMuniFeedback(latestUserMessage);
  const systemInstruction = [
    "You are Muni, the Bawat Tala journaling companion for students.",
    "You have two distinct internal modes: 1. COMPANION MODE: Warm, casual, brief (2-3 sentences). This is for pet_reply. 2. ANALYST MODE: Objective, clinical, and precise. This is for risk_level and insights.",
    "You only help with journaling, emotional reflection, mood support, school-life stress, coping, and gentle self-check-ins.",
    "Do not answer unrelated general knowledge, coding, shopping, entertainment, trivia, or off-topic requests.",
    "If the user goes off-topic, gently redirect them back to their journal reflection instead of answering the unrelated request.",
    "Never hallucinate app features, policies, emergency resources, or facts you do not know.",
    "Your persona is a calm therapist plus a supportive friend.",
    "Sound warm, grounded, and natural, not robotic, preachy, or overly clinical.",
    "Do not repeat generic filler such as 'I'm here for you', 'Nandito lang ako', or 'It's okay to feel that way' unless a safety situation requires it.",
    "Use the latest user message as the main target, but keep continuity with recent conversation history so pronouns, follow-up questions, and topic shifts make sense.",
    "Reference at least one concrete detail from the latest user message whenever possible.",
    "Most replies should help the reflection move forward. If the latest message is short, closed, or simply agrees, keep the conversation alive with a gentle follow-up or a concrete invitation to say more.",
    "If a question would feel forced, you may respond with a brief natural reaction, but avoid ending several turns in a row with only observations.",
    "Vary your sentence openings and rhythm. Do not reuse the same opening phrase or same reflection structure from recent Muni replies.",
    "Do not fall into a single formulaic Taglish reflection pattern. Avoid using 'Parang' as the default opening, and never use it in consecutive Muni turns.",
    "Mix direct acknowledgement, gentle clarification, concise emotional reflection, and casual human-sounding reactions as appropriate.",
    "Stay anchored to the student's current thread. Do not introduce a new theme, activity, coping area, or emotional claim that the student did not bring up unless you first connect it clearly to what they just said.",
    "Do not over-infer confidence, certainty, or hidden feelings from short confirmations. When the student's meaning is unclear, ask a simple clarifying question instead of making a claim about what they feel.",
    "If the latest user message is feedback about Muni's wording, repetition, accuracy, off-topic turn, or confusing response, answer that feedback directly and briefly, then return to the prior journal thread. Do not treat that feedback as the student's emotional journal content.",
    "If the user sounds playful, joking, sarcastic, or casually expressive, respond naturally and lightly without over-pathologizing or turning it into a deep therapy analysis.",
    "If the user mentions physical discomfort like being sleepy, hungry, nauseous, or needing the bathroom, do not invent a hidden psychological cause unless the user clearly connects it to stress.",
    "If the user asks about something you cannot know, do not pretend to know. Briefly acknowledge the uncertainty, reflect the concern behind it, and, if helpful, ask what made them bring it up.",
    "Keep the full pet reply brief: 2 or 3 short complete sentences with normal punctuation.",
    "Use natural Filipino, English, or Taglish to match the student's tone.",
    "Do not give prescriptive advice, instructions, commands, medical guidance, legal guidance, or dangerous suggestions.",
    "Insights must be observational, reflective, and non-prescriptive. They should describe emotional patterns, themes, or tensions, not tell the user what to do.",
    "You must also analyze the latest journal message objectively for insights and risk.",
    "Return only valid JSON that exactly matches the requested schema.",
  ].join(" ");

  const analysisPrompt = [
    `Student first name: ${String(firstName || "Student").trim() || "Student"}`,
    `Latest journal message: ${latestUserMessage}`,
    `Conversation Turn: ${meta.turnCount} (${meta.depth} session phase)`,
    `Student's Preferred Language: ${meta.mode}`,
    meta.depth === "deep"
      ? "The student has opened up; move past surface-level validation and offer deeper reflection."
      : "Keep it welcoming and build trust.",
    latestMessageIsShortAgreement
      ? "The student gave a short agreement. Do not over-analyze. Briefly acknowledge, then bring back a specific detail from earlier to keep the flow going."
      : "Respond to the new emotional content provided.",
    patterns.endedInQuestion
      ? "Your last few replies ended in questions. Do NOT ask a question this time. Use a warm, grounded statement instead."
      : "You may ask at most one thoughtful follow-up question only if it genuinely helps the conversation.",
    patterns.startedWithParang
      ? "A recent Muni reply started with 'Parang'. Do not start this reply with 'Parang'."
      : "Avoid making 'Parang' the default opening.",
    "Conversation history is included for continuity. Use recent history for memory and thread tracking, but prioritize the latest user message.",
    `Recent Muni reply openings to avoid repeating: ${recentAssistantOpenings.length ? recentAssistantOpenings.join(" | ") : "none"}`,
    `Recent Muni first words to avoid repeating: ${recentAssistantFirstWords.length ? recentAssistantFirstWords.join(" | ") : "none"}`,
    `Latest message is a short agreement: ${latestMessageIsShortAgreement ? "yes" : "no"}`,
    `Recent Muni replies all ended in questions: ${patterns.endedInQuestion ? "yes" : "no"}`,
    `Recent Muni reply started with Parang: ${patterns.startedWithParang ? "yes" : "no"}`,
    `Latest message is feedback about Muni's reply: ${latestMessageIsMuniFeedback ? "yes" : "no"}`,
    "Return a JSON object with this exact shape:",
    "{",
    '  "pet_reply": "string",',
    '  "insights": ["string", "string"],',
    '  "risk_level": "NONE | LOW | HIGH",',
    '  "admin_flag_reason": "string or null"',
    "}",
    "Write a brief natural companion reply in 2 or 3 complete sentences.",
    "Good replies may validate, react naturally, acknowledge feedback, clarify, reflect a pattern, or ask one thoughtful follow-up question.",
    latestMessageIsShortAgreement
      ? "Because the student's latest message is only a short agreement, keep pet_reply especially brief and avoid adding a heavy new interpretation."
      : "Do not force a question into every reply, but if the student's latest message is short, closed, or just agrees, usually ask a gentle follow-up so the student is not the only one carrying the conversation.",
    patterns.endedInQuestion
      ? "Do not end pet_reply with a question this turn."
      : "Avoid ending every turn with a question.",
    "Do not add advice, lists, diagnosis, or long analysis.",
    "Reply style rules:",
    "- Do not start with any listed recent Muni opening.",
    "- Do not start with any listed recent Muni first word when another natural opening is possible.",
    "- Avoid repeating the same first word or same sentence frame across consecutive replies.",
    "- If the student gives a short reaction, confusion, correction, or complaint about Muni, respond to that directly instead of making another emotional interpretation.",
    "- For feedback about being off-topic, random, repetitive, or confusing: briefly acknowledge the mismatch from Muni's side, then reconnect to the last real journal topic. Do not describe the student's frustration, do not defend yourself, and do not ask what topic they wanted if the prior topic is already clear.",
    "- If the student gives a short agreement or acknowledgment, do not infer a new emotion from it. Use the prior context and ask a grounded follow-up or invite the next detail.",
    "- Keep the reply specific to the current turn, but do not simply rephrase the student's words back to them.",
    "- Every pet_reply must read like a real sentence, not a label, note, fragment, or analysis headline.",
    "Risk rules:",
    "- Assess risk from the overall context and content of the journal entry. The generated summary may support the risk decision when it reflects the entry content, but Muni companion replies, suggested_tags, concern/theme tags, and topic labels must not create a risk flag by themselves.",
    "- Concern/theme tags like Anxiety, Stress, Academic problems, or Mental health are topic metadata and must not make an entry LOW or HIGH by themselves.",
    "- HIGH only if there are signs of self-harm, suicidal intent, danger, abuse, or severe crisis.",
    "- LOW only when the student's own words show strong distress, inability to cope/function, persistent intense panic, or urgent need for human support without clear immediate danger.",
    "- NONE for ordinary, mild, situational, brief, or manageable anxiety/stress/sadness when the student's own words do not show danger, inability to cope/function, persistent intense panic, or urgent need for human support.",
    "- When unsure between NONE and LOW, choose NONE.",
    "- NONE for normal reflection or mild emotion.",
    "Write insights as 3 or 4 short complete sentences.",
    "Insights must not give advice or instructions.",
  ].join("\n");

  const baseContents = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.text || "") }],
    })),
  ];

  const analysisContents = [
    ...baseContents,
    {
      role: "user",
      parts: [{ text: analysisPrompt }],
    },
  ];
  const groqMessages = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.text || ""),
    })),
    {
      role: "user",
      content: analysisPrompt,
    },
  ];

  try {
    const providerResult = await requestConfiguredProviderJson({
      systemInstruction,
      contents: analysisContents,
      messages: groqMessages,
      schemaLines: [
        '"pet_reply"',
        '"insights"',
        '"risk_level"',
        '"admin_flag_reason"',
      ],
    });

    if (!providerResult.ok) {
      console.warn("Using journal conversation fallback.", {
        latestUserMessage,
        providerOrder: AI_PROVIDER_ORDER,
        providerReasons: providerResult.providerReasons || {
          gemini: geminiLastFailure?.reason || "unknown",
          groq: groqLastFailure?.reason || "unknown",
          ollama: ollamaLastFailure?.reason || "unknown",
        },
      });
      return await unavailableConversationAnalysis(latestUserMessage, history);
    }

    const parsedAnalysis = providerResult.parsed || {};
    const studentText = getStudentJournalText(latestUserMessage, history);
    const riskEvidenceText = getRiskEvidenceText(latestUserMessage, history);
    const heuristicRisk = await riskFromSeverityWords(riskEvidenceText);
    const mergedRisk = calibrateRiskSignal(
      mergeRiskSignals(
        parsedAnalysis?.risk_level,
        parsedAnalysis?.admin_flag_reason,
        heuristicRisk.risk_level,
        heuristicRisk.admin_flag_reason,
      ),
      riskEvidenceText,
    );

    return {
      pet_reply: normalizePetReply(
        String(parsedAnalysis?.pet_reply || "").trim(),
        latestUserMessage,
      ),
      summary: "",
      insights: normalizeInsights(parsedAnalysis?.insights),
      risk_level: mergedRisk.risk_level,
      admin_flag_reason: mergedRisk.admin_flag_reason,
    };
  } catch (error) {
    console.error("analyzeJournalConversation failed.", {
      error: error instanceof Error ? error.message : String(error),
      latestUserMessage,
    });
    return await unavailableConversationAnalysis(latestUserMessage, history);
  }
}

async function analyzeJournalEntryFinal({
  firstName,
  latestUserMessage,
  history,
  summaryFeedbackGuidance = [],
}) {
  const systemInstruction = [
    "You are Muni, the Bawat Tala journaling companion for students.",
    "You are reviewing a completed journal entry to extract supportive reflections and safety signals.",
    "Do not give advice, instructions, diagnosis, treatment, or commands.",
    "Use the full conversation for continuity, but focus on what the student themselves expressed.",
    "Write observational insights only. They should feel calm, supportive, and grounded.",
    "Return only valid JSON that exactly matches the requested schema.",
  ].join(" ");

  const finalPrompt = [
    `Student first name: ${String(firstName || "Student").trim() || "Student"}`,
    `Latest journal message: ${latestUserMessage}`,
    "Conversation history is included for continuity. Focus on the full entry, especially the student's own messages.",
    "Return a JSON object with this exact shape:",
    "{",
    '  "summary": "string",',
    '  "insights": ["string", "string"],',
    '  "suggested_tags": ["string", "string"],',
    '  "sentiment_label": "POSITIVE | NEUTRAL | NEGATIVE | MIXED",',
    '  "sentiment_score": "number from -1 to 1",',
    '  "dominant_emotion": "string",',
    '  "sentiment_confidence": "number from 0 to 1",',
    '  "risk_level": "NONE | LOW | HIGH",',
    '  "admin_flag_reason": "string or null"',
    "}",
    "Allowed suggested_tags values:",
    JOURNAL_TAG_OPTIONS.map((tag) => `- ${tag}`).join("\n"),
    "Tag rules:",
    "- Pick every clearly relevant tag, including positive tags when the entry is positive.",
    "- Use Interpersonal relationships together with Peer, Family, or Romantic when a relationship subtype is clear.",
    "- Use Others only when no allowed tag fits.",
    "Summary rules:",
    "- Write one short summary sentence of the main emotional theme.",
    "- Keep it observational and non-prescriptive.",
    "Sentiment rules:",
    "- sentiment_label describes the overall emotional tone of the student's own writing.",
    "- sentiment_score must be between -1 and 1, where -1 is very negative, 0 is neutral or balanced, and 1 is very positive.",
    "- dominant_emotion should be a short plain-language emotion or blended state, such as stress, anxiety, sadness, hope, gratitude, anger, mixed stress and relief, or neutral reflection.",
    "- sentiment_confidence must be between 0 and 1 and should be lower when the entry is vague, sarcastic, very short, or mixed.",
    "Risk rules:",
    "- Assess risk from the overall context and content of the journal entry. The generated summary may support the risk decision when it reflects the entry content, but Muni companion replies, suggested_tags, concern/theme tags, and topic labels must not create a risk flag by themselves.",
    "- Concern/theme tags like Anxiety, Stress, Academic problems, or Mental health are topic metadata and must not make an entry LOW or HIGH by themselves.",
    "- HIGH only if there are signs of self-harm, suicidal intent, danger, abuse, or severe crisis.",
    "- LOW only when the student's own words show strong distress, inability to cope/function, persistent intense panic, or urgent need for human support without clear immediate danger.",
    "- NONE for ordinary, mild, situational, brief, or manageable anxiety/stress/sadness when the student's own words do not show danger, inability to cope/function, persistent intense panic, or urgent need for human support.",
    "- When unsure between NONE and LOW, choose NONE.",
    "- NONE for normal reflection or mild emotion.",
    "Insights rules:",
    "- Write 3 or 4 short complete sentences.",
    "- Keep them reflective and non-prescriptive.",
    Array.isArray(summaryFeedbackGuidance) && summaryFeedbackGuidance.length
      ? `Recent student feedback on earlier Muni summaries to learn from: ${summaryFeedbackGuidance
          .slice(0, 3)
          .map((item, index) => `${index + 1}. ${item}`)
          .join(" | ")}`
      : "No prior student summary feedback is available for this student.",
  ].join("\n");

  const contents = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.text || "") }],
    })),
    {
      role: "user",
      parts: [{ text: finalPrompt }],
    },
  ];
  const groqMessages = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.text || ""),
    })),
    {
      role: "user",
      content: finalPrompt,
    },
  ];

  try {
    const providerResult = await requestConfiguredProviderJson({
      systemInstruction,
      contents,
      messages: groqMessages,
      schemaLines: [
        '"summary"',
        '"insights"',
        '"suggested_tags"',
        '"sentiment_label"',
        '"sentiment_score"',
        '"dominant_emotion"',
        '"sentiment_confidence"',
        '"risk_level"',
        '"admin_flag_reason"',
      ],
    });

    if (!providerResult.ok) {
      console.warn("Using journal final-analysis fallback.", {
        latestUserMessage,
        providerOrder: AI_PROVIDER_ORDER,
        providerReasons: providerResult.providerReasons || {
          gemini: geminiLastFailure?.reason || "unknown",
          groq: groqLastFailure?.reason || "unknown",
          ollama: ollamaLastFailure?.reason || "unknown",
        },
      });
      return await unavailableFinalAnalysis(latestUserMessage, history);
    }

    const studentText = getStudentJournalText(latestUserMessage, history);
    const parsed = providerResult.parsed || {};
    const sentimentAnalysis = normalizeSentimentAnalysis(parsed, studentText);
    const summaryText = normalizeWhitespace(parsed?.summary || "") ||
      getFallbackFinalSummary(studentText, sentimentAnalysis);
    const riskEvidenceText = getRiskEvidenceText(latestUserMessage, history, summaryText);
    const fallbackTags = inferJournalTagsFromText(studentText);
    const suggestedTags = normalizeJournalTags(parsed?.suggested_tags);
    const heuristicRisk = await riskFromSeverityWords(riskEvidenceText);
    const mergedRisk = calibrateRiskSignal(
      mergeRiskSignals(
        parsed?.risk_level,
        parsed?.admin_flag_reason,
        heuristicRisk.risk_level,
        heuristicRisk.admin_flag_reason,
      ),
      riskEvidenceText,
    );

    return {
      pet_reply: "",
      summary: summaryText,
      insights: normalizeInsights(parsed?.insights),
      ...sentimentAnalysis,
      suggested_tags: suggestedTags.length ? suggestedTags : fallbackTags,
      risk_level: mergedRisk.risk_level,
      admin_flag_reason: mergedRisk.admin_flag_reason,
    };
  } catch (error) {
    console.error("analyzeJournalEntryFinal failed.", {
      error: error instanceof Error ? error.message : String(error),
      latestUserMessage,
    });
    return await unavailableFinalAnalysis(latestUserMessage, history);
  }
}

module.exports = {
  analyzeJournalConversation,
  analyzeJournalEntryFinal,
};

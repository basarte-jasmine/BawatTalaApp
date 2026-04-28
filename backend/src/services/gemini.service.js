const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const OLLAMA_BASE_URL = normalizeBaseUrl(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "");
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

function normalizeBaseUrl(value) {
  const compact = String(value || "").trim().replace(/\/+$/, "");
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

  return selected.filter((model, index, items) => model && items.indexOf(model) === index);
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
  ["llama-3.1-8b-instant"],
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
  ["gemini", "groq"],
);
const OLLAMA_REQUEST_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || 60000),
);
const OLLAMA_MAX_TOKENS = Math.max(0, Number(process.env.OLLAMA_MAX_TOKENS || 0));

let geminiCooldownUntil = 0;
let geminiLastFailure = null;
let groqLastFailure = null;
let ollamaLastFailure = null;

function parseProviderOrder(value, defaults) {
  const allowed = new Set(["ollama", "gemini", "groq"]);
  const configured = String(value || "")
    .split(",")
    .map((item) => String(item || "").trim().toLowerCase())
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

function unavailableConversationAnalysis(latestUserMessage = "", history = []) {
  const heuristicRisk = riskFromSeverityWords(
    [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
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

function unavailableFinalAnalysis(latestUserMessage = "", history = []) {
  const heuristicRisk = riskFromSeverityWords(
    [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
  );
  const fallbackTags = inferJournalTagsFromText(
    [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
  );

  return {
    pet_reply: "",
    summary: "",
    insights: [],
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
  const cleanReply = String(rawReply || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");

  if (cleanReply) {
    return cleanReply;
  }

  return "";
}

function riskFromSeverityWords(text) {
  const value = String(text || "").toLowerCase();

  const highSignals = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "hurt myself",
    "self harm",
    "self-harm",
    "i want to die",
    "i wanna die",
    "ayoko na mabuhay",
    "gusto ko nang mamatay",
    "gusto ko na mamatay",
    "papatayin ko sarili ko",
    "sasaktan ko sarili ko",
    "saktan ang sarili",
    "magpapakamatay",
    "mamatay na lang",
    "wala nang dahilan mabuhay",
    "abuse",
    "inaabuso",
    "binubugbog",
    "rape",
    "sexual assault",
  ];

  const lowSignals = [
    "panic attack",
    "can't stop crying",
    "cant stop crying",
    "sobrang lungkot",
    "sobrang bigat",
    "wala na akong gana",
    "i feel hopeless",
    "hopeless",
    "burned out",
    "burnt out",
    "pagod na pagod",
    "hindi ko na kaya",
    "di ko na kaya",
    "overwhelmed",
    "matinding anxiety",
    "severe anxiety",
  ];

  if (highSignals.some((signal) => value.includes(signal))) {
    return {
      risk_level: "HIGH",
      admin_flag_reason:
        "Risk keywords suggesting self-harm, suicide, abuse, or immediate danger were detected.",
    };
  }

  if (lowSignals.some((signal) => value.includes(signal))) {
    return {
      risk_level: "LOW",
      admin_flag_reason:
        "Risk keywords suggesting significant distress were detected.",
    };
  }

  return {
    risk_level: "NONE",
    admin_flag_reason: null,
  };
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

  if (order[normalizedHeuristic] > order[normalizedModel]) {
    return {
      risk_level: normalizedHeuristic,
      admin_flag_reason: heuristicReason,
    };
  }

  return {
    risk_level: normalizedModel,
    admin_flag_reason:
      modelReason == null ? null : String(modelReason).trim() || null,
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
      temperature: 0.5,
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
        return { ok: true, parsed: parseGeminiJson(rawText), provider: "gemini", model };
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
    console.error("Gemini request failed for all configured models.", lastFailure);
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
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });

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
          console.warn("Groq returned invalid JSON, trying next model.", lastFailure);
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
      console.warn("Groq request error for model, trying next model.", lastFailure);
      continue;
    }
  }

  if (lastFailure) {
    console.error("Groq request failed for all configured models.", lastFailure);
  }

  return {
    ok: false,
    parsed: null,
    reason: lastFailure?.reason === "rate_limit" ? "groq_rate_limited" : "groq_request_failed",
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
      messages: [
        { role: "system", content: systemInstruction },
        ...messages,
      ],
      response_format: { type: "json_object" },
      stream: false,
      temperature: 0.5,
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
        return { ok: true, parsed: parseProviderJson(rawText), provider: "ollama", model };
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
    console.warn("Ollama request failed for model, trying next model.", lastFailure);
  }

  return {
    ok: false,
    parsed: null,
    reason: lastFailure?.status === 404 ? "ollama_model_not_found" : "ollama_request_failed",
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
  const systemInstruction = [
    "You are Muni, the Bawat Tala journaling companion for students.",
    "You only help with journaling, emotional reflection, mood support, school-life stress, coping, and gentle self-check-ins.",
    "Do not answer unrelated general knowledge, coding, shopping, entertainment, trivia, or off-topic requests.",
    "If the user goes off-topic, gently redirect them back to their journal reflection instead of answering the unrelated request.",
    "Never hallucinate app features, policies, emergency resources, or facts you do not know.",
    "Your persona is a calm therapist plus a supportive friend.",
    "Sound warm, grounded, and natural, not robotic, preachy, or overly clinical.",
    "Do not repeat generic filler such as 'I'm here for you', 'Nandito lang ako', or 'It's okay to feel that way' unless a safety situation requires it.",
    "Use the latest user message as the main target, but keep continuity with recent conversation history so pronouns, follow-up questions, and topic shifts make sense.",
    "Reference at least one concrete detail from the latest user message whenever possible.",
    "Most replies should help the reflection move forward, but not every reply needs a question.",
    "If a question would feel forced, you may respond with a brief natural reaction or reflection instead.",
    "If the user sounds playful, joking, sarcastic, or casually expressive, respond naturally and lightly without over-pathologizing or turning it into a deep therapy analysis.",
    "If the user mentions physical discomfort like being sleepy, hungry, nauseous, or needing the bathroom, do not invent a hidden psychological cause unless the user clearly connects it to stress.",
    "If the user asks about something you cannot know, do not pretend to know. Briefly acknowledge the uncertainty, reflect the concern behind it, and, if helpful, ask what made them bring it up.",
    "Keep the full pet reply brief: usually 1 to 3 short sentences.",
    "Use natural Filipino, English, or Taglish to match the student's tone.",
    "Do not give prescriptive advice, instructions, commands, medical guidance, legal guidance, or dangerous suggestions.",
    "Insights must be observational, reflective, and non-prescriptive. They should describe emotional patterns, themes, or tensions, not tell the user what to do.",
    "You must also analyze the latest journal message objectively for insights and risk.",
    "Return only valid JSON that exactly matches the requested schema.",
  ].join(" ");

  const analysisPrompt = [
    `Student first name: ${String(firstName || "Student").trim() || "Student"}`,
    `Latest journal message: ${latestUserMessage}`,
    "Conversation history is included for continuity. Use recent history for memory and thread tracking, but prioritize the latest user message.",
    "Return a JSON object with this exact shape:",
    "{",
    '  "pet_reply": "string",',
    '  "insights": ["string", "string"],',
    '  "risk_level": "NONE | LOW | HIGH",',
    '  "admin_flag_reason": "string or null"',
    "}",
    "Write a brief natural companion reply.",
    "Good replies may validate, react naturally, reflect a pattern, or ask one thoughtful follow-up question.",
    "Do not force a question into every reply.",
    "Do not add advice, lists, diagnosis, or long analysis.",
    "Risk rules:",
    "- HIGH only if there are signs of self-harm, suicidal intent, danger, abuse, or severe crisis.",
    "- LOW for strong distress without clear immediate danger.",
    "- NONE for normal reflection or mild emotion.",
    "Write insights as 2 or 3 short complete sentences.",
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
      schemaLines: ['"pet_reply"', '"insights"', '"risk_level"', '"admin_flag_reason"'],
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
      return unavailableConversationAnalysis(latestUserMessage, history);
    }

    const parsedAnalysis = providerResult.parsed || {};
    const heuristicRisk = riskFromSeverityWords(
      [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
    );
    const mergedRisk = mergeRiskSignals(
      parsedAnalysis?.risk_level,
      parsedAnalysis?.admin_flag_reason,
      heuristicRisk.risk_level,
      heuristicRisk.admin_flag_reason,
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
    return unavailableConversationAnalysis(latestUserMessage, history);
  }
}

async function analyzeJournalEntryFinal({
  firstName,
  latestUserMessage,
  history,
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
    "Risk rules:",
    "- HIGH only if there are signs of self-harm, suicidal intent, danger, abuse, or severe crisis.",
    "- LOW for strong distress without clear immediate danger.",
    "- NONE for normal reflection or mild emotion.",
    "Insights rules:",
    "- Write 2 or 3 short complete sentences.",
    "- Keep them reflective and non-prescriptive.",
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
      schemaLines: ['"summary"', '"insights"', '"suggested_tags"', '"risk_level"', '"admin_flag_reason"'],
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
      return unavailableFinalAnalysis(latestUserMessage, history);
    }

    const parsed = providerResult.parsed || {};
    const fallbackTags = inferJournalTagsFromText(
      [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
    );
    const suggestedTags = normalizeJournalTags(parsed?.suggested_tags);
    const heuristicRisk = riskFromSeverityWords(
      [latestUserMessage, ...history.map((item) => item.text)].join("\n"),
    );
    const mergedRisk = mergeRiskSignals(
      parsed?.risk_level,
      parsed?.admin_flag_reason,
      heuristicRisk.risk_level,
      heuristicRisk.admin_flag_reason,
    );

    return {
      pet_reply: "",
      summary: normalizeWhitespace(parsed?.summary || ""),
      insights: normalizeInsights(parsed?.insights),
      suggested_tags: suggestedTags.length ? suggestedTags : fallbackTags,
      risk_level: mergedRisk.risk_level,
      admin_flag_reason: mergedRisk.admin_flag_reason,
    };
  } catch (error) {
    console.error("analyzeJournalEntryFinal failed.", {
      error: error instanceof Error ? error.message : String(error),
      latestUserMessage,
    });
    return unavailableFinalAnalysis(latestUserMessage, history);
  }
}

module.exports = {
  analyzeJournalConversation,
  analyzeJournalEntryFinal,
};


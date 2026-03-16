const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();

function parseModelList(value, defaults) {
  const configured = String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return [...configured, ...defaults].filter(
    (model, index, items) => model && items.indexOf(model) === index,
  );
}

const GEMINI_CHAT_MODELS = parseModelList(
  process.env.GEMINI_CHAT_MODELS ||
    process.env.GEMINI_CHAT_MODEL ||
    process.env.GEMINI_MODEL,
  ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
);
const GEMINI_INSIGHTS_MODELS = parseModelList(
  process.env.GEMINI_INSIGHTS_MODELS ||
    process.env.GEMINI_INSIGHTS_MODEL ||
    process.env.GEMINI_MODEL,
  ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
);

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

function buildFallbackReply(latestUserMessage) {
  const text = normalizeWhitespace(latestUserMessage);
  const templates = pickMirrorLanguageTemplate(text);
  const lower = text.toLowerCase();

  if (!text) {
    return `${templates.acknowledge} ${templates.reflect}`;
  }

  if (/[?]$/.test(text) && /\b(huh|ha|ano|what)\b/i.test(text)) {
    return /[a-z]/i.test(text) && !/\b(ano|bakit)\b/i.test(text)
      ? "I want to respond better to what you mean. Can you say a bit more about what felt off there?"
      : "Gusto kong sumagot nang mas maayos sa ibig mong sabihin. Pwede mo bang linawin nang kaunti kung anong tumama sa'yo doon?";
  }

  if (/\b(repeating|ulit|inuulit|repeat)\b/i.test(lower)) {
    return /[a-z]/i.test(text) && !/\b(ulit|inuulit)\b/i.test(text)
      ? "You're right, that sounded repetitive. Tell me the part you want me to respond to more directly."
      : "Tama ka, paulit-ulit ang dating nun. Sabihin mo kung anong part ang gusto mong sagutin ko nang mas direkta.";
  }

  if (/\b(wtf|bwisit|nakakainis|inis|naiinis)\b/i.test(lower)) {
    return /[a-z]/i.test(text) && !/\b(nakakainis|naiinis)\b/i.test(text)
      ? "That came off badly. Tell me what felt most annoying or off in that moment."
      : "Gets ko kung bakit nakakainis ang dating nun. Anong part ang pinaka-off para sa'yo?";
  }

  if (/\b(natatae|jebs|poop|bathroom|cr|toilet)\b/i.test(lower)) {
    return /\b(natatae|jebs)\b/i.test(lower)
      ? "Mukhang ang hirap ngang makapag-focus kung ganyan ang pakiramdam. Gusto mo bang ikwento lang kung anong nangyayari ngayon?"
      : "That sounds physically distracting right now. Do you want to talk through what’s going on first?";
  }

  return `${templates.acknowledge} ${templates.reflect}`;
}

function fallbackAnalysis(latestUserMessage = "") {
  return {
    pet_reply: buildFallbackReply(latestUserMessage),
    summary: "",
    insights: [
      "A clear emotional theme is present in the entry.",
      "The entry highlights what felt most meaningful or heavy today.",
    ],
    risk_level: "NONE",
    admin_flag_reason: null,
  };
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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

  const cleanLatest = normalizeWhitespace(latestUserMessage);
  if (!cleanLatest) {
    return fallbackAnalysis().pet_reply;
  }

  return `Salamat sa pag-share. Mukhang mahalaga sa'yo yung "${cleanLatest.slice(0, 80)}".`;
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

      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }

    const candidate = data?.candidates?.[0];
    const finishReason = String(candidate?.finishReason || "");
    const rawText =
      candidate?.content?.parts?.map((part) => part?.text || "").join("") || "";

    if (response.ok && rawText) {
      try {
        return { ok: true, parsed: parseGeminiJson(rawText) };
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
      console.warn("Gemini quota hit, trying next model.", lastFailure);
      continue;
    }

    console.error("Gemini request failed.", lastFailure);
    return { ok: false, parsed: null };
  }

  if (lastFailure) {
    console.error("Gemini request failed for all configured models.", lastFailure);
  }

  return { ok: false, parsed: null };
}

async function analyzeJournalConversation({
  firstName,
  latestUserMessage,
  history,
}) {
  if (!GEMINI_API_KEY) {
    return fallbackAnalysis(latestUserMessage);
  }

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

  try {
    const analysisResult = await requestGeminiJson({
      models: GEMINI_CHAT_MODELS,
      systemInstruction,
      contents: analysisContents,
      schemaLines: ['"pet_reply"', '"insights"', '"risk_level"', '"admin_flag_reason"'],
    });

    if (!analysisResult.ok) {
      return fallbackAnalysis(latestUserMessage);
    }

    const parsedAnalysis = analysisResult.parsed || {};
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
        String(parsedAnalysis?.pet_reply || "").trim() ||
          fallbackAnalysis(latestUserMessage).pet_reply,
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
    return fallbackAnalysis(latestUserMessage);
  }
}

async function analyzeJournalEntryFinal({
  firstName,
  latestUserMessage,
  history,
}) {
  if (!GEMINI_API_KEY) {
    return fallbackAnalysis(latestUserMessage);
  }

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
    '  "risk_level": "NONE | LOW | HIGH",',
    '  "admin_flag_reason": "string or null"',
    "}",
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

  try {
    const analysisResult = await requestGeminiJson({
      models: GEMINI_INSIGHTS_MODELS,
      systemInstruction,
      contents,
      schemaLines: ['"summary"', '"insights"', '"risk_level"', '"admin_flag_reason"'],
    });

    if (!analysisResult.ok) {
      return fallbackAnalysis(latestUserMessage);
    }

    const parsed = analysisResult.parsed || {};
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
      risk_level: mergedRisk.risk_level,
      admin_flag_reason: mergedRisk.admin_flag_reason,
    };
  } catch (error) {
    console.error("analyzeJournalEntryFinal failed.", {
      error: error instanceof Error ? error.message : String(error),
      latestUserMessage,
    });
    return fallbackAnalysis(latestUserMessage);
  }
}

module.exports = {
  analyzeJournalConversation,
  analyzeJournalEntryFinal,
};


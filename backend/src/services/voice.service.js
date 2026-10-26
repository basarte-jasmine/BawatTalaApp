const https = require("https");
const { Buffer } = require("buffer");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { EdgeTTS } = require("node-edge-tts");

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const BLESSICA_VOICE = "fil-PH-BlessicaNeural";

function splitTextIntoSentences(text, maxLen = 180) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  const rawSentences = clean.split(/(?<=[.?!,;:\n])\s+/);
  const parts = [];
  let current = "";

  for (const s of rawSentences) {
    if (!s) continue;
    if ((current ? current + " " + s : s).length <= maxLen) {
      current = current ? current + " " + s : s;
    } else {
      if (current) parts.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(" ");
        let subCurrent = "";
        for (const w of words) {
          if ((subCurrent ? subCurrent + " " + w : w).length <= maxLen) {
            subCurrent = subCurrent ? subCurrent + " " + w : w;
          } else {
            if (subCurrent) parts.push(subCurrent);
            subCurrent = w;
          }
        }
        current = subCurrent;
      }
    }
  }
  if (current) parts.push(current);
  return parts.filter(Boolean);
}

function fetchGoogleTtsChunk(textChunk, lang = "tl") {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(textChunk);
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&q=" +
      encoded +
      "&tl=" +
      lang +
      "&client=tw-ob";

    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error("TTS request failed with status: " + res.statusCode));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("TTS request timed out."));
    });
  });
}

function shouldUseFilipinoVoice(text) {
  const words =
    String(text || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .match(/[a-z]+/g) || [];

  const strongMarkers = new Set([
    "ako", "ikaw", "siya", "kami", "tayo", "kayo", "sila",
    "mga", "niya", "namin", "natin", "ninyo", "nila", "atin",
    "parang", "kasi", "naman", "talaga", "sobrang", "ngayon",
    "kumusta", "salamat", "opo", "hindi", "ganyan", "ganito",
    "gusto", "ayaw", "dapat", "pwede", "puwede", "araw",
    "linggo", "pasahan", "gawain", "narinig", "handa",
    "pakiramdam", "naiintindihan", "mahirap", "masaya", "malungkot",
    "yan", "iyon", "yung", "kapag", "pero", "kung", "sana",
    "siguro", "baka", "pagod", "bigat", "hirap", "maayos",
    "makinig", "magbahagi", "nararamdaman", "pinagdadaanan",
  ]);
  const ambiguousMarkers = new Set([
    "ang", "ng", "sa", "ko", "mo", "po", "oo", "ba", "nga",
    "din", "rin", "daw", "raw", "muna", "lang", "pala", "wala",
    "meron", "para",
  ]);
  const englishMarkers = new Set([
    "i", "me", "my", "you", "your", "we", "our", "the", "a", "an",
    "is", "are", "was", "were", "am", "be", "been", "to", "of",
    "for", "with", "and", "but", "because", "when", "what", "how",
    "that", "this", "it", "feel", "feels", "sounds", "understand",
    "really", "have", "has", "had", "can", "could", "would", "week",
    "sharing", "difficult", "stressed", "tired",
  ]);

  const filipinoScore = words.reduce((score, word) => {
    if (strongMarkers.has(word)) return score + 2;
    if (ambiguousMarkers.has(word)) return score + 1;
    return score;
  }, 0);
  const englishScore = words.filter((word) => englishMarkers.has(word)).length;

  return filipinoScore > 0 && filipinoScore >= englishScore;
}

function normalizeTranscriptionLanguage(language, text) {
  const sample = String(text || "").toLowerCase();
  const filipinoMarkers = [
    "ako", "ikaw", "siya", "kami", "tayo", "kayo", "sila",
    "ko", "mo", "niya", "namin", "natin", "ninyo", "nila",
    "ang", "mga", "ng", "sa", "may", "meron", "wala",
    "parang", "kasi", "naman", "talaga", "sobrang", "ngayon",
    "kumusta", "salamat", "opo", "po", "oo", "hindi", "ba",
    "pala", "nga", "din", "rin", "daw", "raw", "muna", "lang",
    "ganyan", "ganito", "gusto", "ayaw", "dapat", "pwede", "puwede",
    "araw", "linggo", "taon", "oras", "pasahan", "gawain",
  ];
  const words = sample.match(/[a-z������]+/g) || [];
  const hasFilipino = words.some((w) => filipinoMarkers.includes(w));
  if (hasFilipino) return "fil";

  const detected = String(language || "").trim().toLowerCase();
  if (
    detected === "tl" ||
    detected === "fil" ||
    detected.includes("tagalog") ||
    detected.includes("filipino")
  ) {
    return "fil";
  }
  return shouldUseFilipinoVoice(text) ? "fil" : "en";
}

function getVoiceConfig() {
  return { voice: BLESSICA_VOICE, lang: "fil-PH" };
}

async function synthesizeGoogleFallback(text, lang) {
  const chunks = splitTextIntoSentences(text);
  const audioBuffers = [];
  for (const chunk of chunks) {
    const fallbackLanguage = lang === "fil-PH" ? "tl" : "en";
    audioBuffers.push(await fetchGoogleTtsChunk(chunk, fallbackLanguage));
  }
  return Buffer.concat(audioBuffers);
}

/**
 * Synthesizes natural human-like speech supporting Tagalog, English, and Taglish
 */
async function synthesizeEdgeSpeech({ text, voice, rate = "+0%", pitch = "+0Hz" }) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    throw new Error("Text is required for speech synthesis.");
  }

  const selected = getVoiceConfig();
  const audioPath = path.join(
    os.tmpdir(),
    "muni-edge-tts-" + process.pid + "-" + randomUUID() + ".mp3",
  );

  async function generateWithEdge(attempt = 1) {
    const tts = new EdgeTTS({
      voice: selected.voice,
      lang: selected.lang,
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      rate,
      pitch,
      volume: "+0%",
      timeout: 25000,
    });
    try {
      await tts.ttsPromise(cleanText, audioPath);
      const audioBuffer = await fs.readFile(audioPath);
      if (!audioBuffer.length) {
        throw new Error("Edge Neural TTS returned empty audio.");
      }
      return audioBuffer;
    } catch (err) {
      if (attempt < 2) {
        return generateWithEdge(attempt + 1);
      }
      throw err;
    }
  }

  try {
    return await generateWithEdge(1);
  } catch (edgeError) {
    try {
      return await synthesizeGoogleFallback(cleanText, selected.lang);
    } catch {
      throw new Error("Edge Neural TTS failed: " + (edgeError?.message || edgeError));
    }
  } finally {
    await fs.unlink(audioPath).catch(() => {});
  }
}

const GROQ_WHISPER_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
];

/**
 * Transcribes voice audio using Groq Whisper Large v3 Turbo with Whisper Large v3 fallback
 * Accurately recognizes Tagalog, Filipino, English, and Taglish speech.
 */
async function transcribeWithGroqWhisper({
  audioBase64,
  mimeType = "audio/m4a",
  filename = "recording.m4a",
  models = GROQ_WHISPER_MODELS,
}) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const prompt = "Kumusta Muni? Medyo pagod at stressed ako ngayon sa school and personal life, gusto ko sanang mag-share tungkol sa nararamdaman ko. I feel overwhelmed with my exams and feelings today.";
  const targetModels = Array.isArray(models) && models.length > 0 ? models : GROQ_WHISPER_MODELS;

  let lastError = null;

  for (const model of targetModels) {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append("file", blob, filename);
    formData.append("model", model);
    formData.append("response_format", "verbose_json");
    formData.append("temperature", "0");
    formData.append("prompt", prompt);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        lastError = new Error(
          "Whisper transcription failed (" + response.status + "): " + errorBody
        );
        console.warn("Groq Whisper transcription failed, trying next model if available.", {
          model,
          status: response.status,
          error: errorBody,
        });
        continue;
      }

      const data = await response.json();
      const text = String(data?.text || "").trim();
      return {
        text,
        language: normalizeTranscriptionLanguage(data?.language, text),
      };
    } catch (err) {
      lastError = err;
      console.warn("Groq Whisper transcription request error, trying next model if available.", {
        model,
        error: err?.message || err,
      });
      continue;
    }
  }

  throw lastError || new Error("Whisper transcription failed for all configured models.");
}

module.exports = {
  GROQ_WHISPER_MODELS,
  getVoiceConfig,
  synthesizeEdgeSpeech,
  transcribeWithGroqWhisper,
};

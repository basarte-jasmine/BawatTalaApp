const { Buffer } = require("buffer");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { EdgeTTS } = require("node-edge-tts");

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const BLESSICA_VOICE = "fil-PH-BlessicaNeural";

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
  return "en";
}

function getVoiceConfig() {
  // Use Blessica Neural as Muni's unified voice.
  // Blessica speaks Tagalog and Filipino natively and handles English & Taglish naturally.
  return { voice: BLESSICA_VOICE, lang: "fil-PH" };
}

/**
 * Synthesizes natural human-like neural speech using BlessicaNeural.
 * Microsoft Edge Neural TTS exclusively provides high-fidelity, natural voice.
 */
async function synthesizeEdgeSpeech({ text, rate = "+0%", pitch = "+0Hz" }) {
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
    throw new Error("Edge Neural TTS failed: " + (edgeError?.message || edgeError));
  } finally {
    await fs.unlink(audioPath).catch(() => {});
  }
}

/**
 * Transcribes voice audio using Groq Whisper Large v3 Turbo
 * Accurately recognizes Tagalog, Filipino, English, and Taglish speech.
 */
async function transcribeWithGroqWhisper({
  audioBase64,
  mimeType = "audio/m4a",
  filename = "recording.m4a",
}) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0");
  formData.append(
    "prompt",
    "Kumusta Muni? Medyo pagod at stressed ako ngayon sa school and personal life, gusto ko sanang mag-share tungkol sa nararamdaman ko. I feel overwhelmed with my exams and feelings today."
  );

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      "Whisper transcription failed (" + response.status + "): " + errorBody
    );
  }

  const data = await response.json();
  const text = String(data?.text || "").trim();
  return {
    text,
    language: normalizeTranscriptionLanguage(data?.language, text),
  };
}

module.exports = {
  getVoiceConfig,
  synthesizeEdgeSpeech,
  transcribeWithGroqWhisper,
};

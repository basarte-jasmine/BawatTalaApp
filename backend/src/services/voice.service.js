const { Buffer } = require("buffer");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { EdgeTTS } = require("node-edge-tts");

/**
 * Muni speaks with Blessica Neural and nothing else.
 *
 * Microsoft's Edge Read Aloud voice catalog exposes exactly one Blessica voice:
 *   fil-PH-BlessicaNeural  (Friendly, Positive, GA)
 * There is no `en-PH-BlessicaNeural` in the catalog (en-PH only ships James/Rosa), so the
 * same Blessica voice reads both Tagalog and English replies. Do not add a second voice
 * here: `MUNI_VOICES` is the allow-list enforced by every synthesis request.
 */
const BLESSICA_VOICE = "fil-PH-BlessicaNeural";
const BLESSICA_LANG = "fil-PH";
const MUNI_VOICES = Object.freeze([BLESSICA_VOICE]);

/**
 * The single Groq Whisper model used for Bawat Tala transcription.
 * Verified against GET https://api.groq.com/openai/v1/models for this project's key.
 */
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/** Accepted recording MIME types mapped to the file extension Groq expects. */
const SUPPORTED_AUDIO_TYPES = Object.freeze({
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
});

class VoiceSynthesisError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "VoiceSynthesisError";
    this.code = "MUNI_VOICE_UNAVAILABLE";
    this.status = 502;
    if (options.cause) this.cause = options.cause;
  }
}

class TranscriptionError extends Error {
  constructor(message, { code = "TRANSCRIPTION_FAILED", status = 502, cause } = {}) {
    super(message);
    this.name = "TranscriptionError";
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
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

/**
 * The only voice Muni may use, for both Tagalog and English replies.
 * Text/language is intentionally ignored: there is no per-language voice selection.
 */
function getVoiceConfig() {
  return { voice: BLESSICA_VOICE, lang: BLESSICA_LANG };
}

/**
 * Synthesizes Muni's speech with Blessica Neural.
 *
 * There is deliberately no fallback voice or fallback provider. If Edge TTS cannot render
 * Blessica, this throws so the route can return a controlled error instead of silently
 * playing Muni in a different voice.
 */
async function synthesizeEdgeSpeech({ text, rate = "+0%", pitch = "+0Hz" }) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    throw new VoiceSynthesisError("Text is required for speech synthesis.");
  }

  const selected = getVoiceConfig();
  if (!MUNI_VOICES.includes(selected.voice)) {
    throw new VoiceSynthesisError("Refusing to synthesize with a non-Blessica voice.");
  }

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
      // One retry with the SAME voice (transient socket failures). No voice fallback.
      if (attempt < 2) {
        return generateWithEdge(attempt + 1);
      }
      throw err;
    }
  }

  try {
    return await generateWithEdge(1);
  } catch (edgeError) {
    throw new VoiceSynthesisError(
      "Muni's Blessica Neural voice is unavailable right now. Please try again.",
      { cause: edgeError },
    );
  } finally {
    await fs.unlink(audioPath).catch(() => {});
  }
}

function normalizeAudioType(mimeType) {
  const base = String(mimeType || "audio/m4a")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const extension = SUPPORTED_AUDIO_TYPES[base];
  if (!extension) {
    throw new TranscriptionError(
      "Unsupported audio format: " + base + ". Expected one of: " +
        Object.keys(SUPPORTED_AUDIO_TYPES).join(", ") + ".",
      { code: "UNSUPPORTED_AUDIO_TYPE", status: 415 },
    );
  }
  return { mimeType: base, extension };
}

function normalizeAudioFilename(filename, extension) {
  const fallback = "recording." + extension;
  const raw = String(filename || "").trim();
  if (!raw) return fallback;

  const dot = raw.lastIndexOf(".");
  const hasMatchingExtension =
    dot > 0 && raw.slice(dot + 1).toLowerCase() === extension;
  if (hasMatchingExtension) return raw;

  const stem = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[^\w.-]+/g, "_").slice(0, 80);
  return (stem || "recording") + "." + extension;
}

/**
 * Transcribes a recording with Groq Whisper (whisper-large-v3-turbo).
 *
 * This is the only transcription path in Bawat Tala. There is no provider fallback and no
 * model fallback: a failure throws a TranscriptionError with a code and HTTP status so the
 * client sees a real error instead of a quietly different result.
 */
async function transcribeWithGroqWhisper({ audioBase64, mimeType, filename }) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new TranscriptionError("GROQ_API_KEY is not configured on the server.", {
      code: "TRANSCRIPTION_NOT_CONFIGURED",
      status: 500,
    });
  }

  const rawAudio = String(audioBase64 || "").replace(/^data:[^;,]+;base64,/, "").trim();
  if (!rawAudio) {
    throw new TranscriptionError("The audio recording was empty.", {
      code: "EMPTY_AUDIO",
      status: 400,
    });
  }

  const audioBuffer = Buffer.from(rawAudio, "base64");
  if (!audioBuffer.length) {
    throw new TranscriptionError("The audio recording was empty.", {
      code: "EMPTY_AUDIO",
      status: 400,
    });
  }

  const audio = normalizeAudioType(mimeType);
  const uploadName = normalizeAudioFilename(filename, audio.extension);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: audio.mimeType });
  formData.append("file", blob, uploadName);
  formData.append("model", GROQ_WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0");
  formData.append(
    "prompt",
    "Kumusta Muni? Medyo pagod at stressed ako ngayon sa school and personal life, gusto ko sanang mag-share tungkol sa nararamdaman ko. I feel overwhelmed with my exams and feelings today.",
  );

  let response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: formData,
    });
  } catch (err) {
    throw new TranscriptionError("Could not reach the transcription service.", {
      code: "TRANSCRIPTION_UNREACHABLE",
      status: 502,
      cause: err,
    });
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new TranscriptionError(
      "Whisper transcription failed (" + response.status + "): " + errorBody,
      { code: "TRANSCRIPTION_UPSTREAM_ERROR", status: 502 },
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new TranscriptionError("Transcription service returned an invalid response.", {
      code: "TRANSCRIPTION_INVALID_RESPONSE",
      status: 502,
      cause: err,
    });
  }

  const text = String(data?.text || "").trim();
  return {
    text,
    language: normalizeTranscriptionLanguage(data?.language, text),
    model: GROQ_WHISPER_MODEL,
    contentType: audio.mimeType,
  };
}

module.exports = {
  BLESSICA_VOICE,
  BLESSICA_LANG,
  GROQ_WHISPER_MODEL,
  MUNI_VOICES,
  SUPPORTED_AUDIO_TYPES,
  TranscriptionError,
  VoiceSynthesisError,
  getVoiceConfig,
  normalizeAudioFilename,
  normalizeAudioType,
  synthesizeEdgeSpeech,
  transcribeWithGroqWhisper,
};

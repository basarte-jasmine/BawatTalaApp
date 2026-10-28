"use strict";

const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const fs = require("node:fs/promises");
const https = require("node:https");

/* ------------------------------------------------------------------ */
/* Stub node-edge-tts before the service is required                    */
/* ------------------------------------------------------------------ */

const edgeModulePath = require.resolve("node-edge-tts");
const realEdgeModule = require.cache[edgeModulePath];

let edgeCalls = [];
let edgeBehaviour = "ok";

class FakeEdgeTTS {
  constructor(options) {
    this.options = options;
    edgeCalls.push(options);
  }

  async ttsPromise(text, audioPath) {
    this.text = text;
    if (edgeBehaviour === "throw") {
      throw new Error("socket hang up");
    }
    if (edgeBehaviour === "empty") {
      await fs.writeFile(audioPath, Buffer.alloc(0));
      return;
    }
    await fs.writeFile(audioPath, Buffer.from("ID3-blessica-audio"));
  }
}

require.cache[edgeModulePath] = {
  id: edgeModulePath,
  filename: edgeModulePath,
  loaded: true,
  exports: { EdgeTTS: FakeEdgeTTS },
};

const voice = require("../src/services/voice.service");

after(() => {
  if (realEdgeModule) {
    require.cache[edgeModulePath] = realEdgeModule;
  } else {
    delete require.cache[edgeModulePath];
  }
});

/* ------------------------------------------------------------------ */
/* fetch / https instrumentation                                        */
/* ------------------------------------------------------------------ */

const realFetch = globalThis.fetch;
const realHttpsGet = https.get;

let fetchCalls = [];

function stubFetch(handler) {
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return handler(url, init);
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

before(() => {
  // The Google Translate TTS fallback used plain https.get. Any call here means an
  // alternative voice provider was contacted.
  https.get = (...args) => {
    throw new Error("Unexpected alternative voice provider call: " + args[0]);
  };
});

after(() => {
  globalThis.fetch = realFetch;
  https.get = realHttpsGet;
});

beforeEach(() => {
  edgeCalls = [];
  edgeBehaviour = "ok";
  fetchCalls = [];
  globalThis.fetch = realFetch;
  delete process.env.GROQ_API_KEY;
});

/* ------------------------------------------------------------------ */
/* ISSUE 1 — Blessica Neural is the only Muni voice                     */
/* ------------------------------------------------------------------ */

describe("Muni voice selection", () => {
  it("exposes exactly one voice, and it is Blessica Neural", () => {
    assert.deepEqual([...voice.MUNI_VOICES], ["fil-PH-BlessicaNeural"]);
    assert.equal(voice.BLESSICA_VOICE, "fil-PH-BlessicaNeural");
    assert.equal(voice.GROQ_WHISPER_MODEL, "whisper-large-v3-turbo");
  });

  it("selects Blessica for a Tagalog reply", () => {
    const config = voice.getVoiceConfig("Kumusta ka? Medyo pagod ako ngayon.");
    assert.deepEqual(config, { voice: "fil-PH-BlessicaNeural", lang: "fil-PH" });
  });

  it("selects the same Blessica voice for an English reply", () => {
    const config = voice.getVoiceConfig(
      "I understand. That sounds really difficult, and I am here with you.",
    );
    assert.deepEqual(config, { voice: "fil-PH-BlessicaNeural", lang: "fil-PH" });
  });

  it("ignores any per-language or per-request voice argument", () => {
    assert.deepEqual(voice.getVoiceConfig("english text", "en-US-JennyNeural"), {
      voice: "fil-PH-BlessicaNeural",
      lang: "fil-PH",
    });
  });

  it("sends Blessica to the TTS engine for Tagalog", async () => {
    const audio = await voice.synthesizeEdgeSpeech({
      text: "Salamat sa pagbabahagi. Nandito lang ako.",
    });

    assert.equal(audio.toString(), "ID3-blessica-audio");
    assert.equal(edgeCalls.length, 1);
    assert.equal(edgeCalls[0].voice, "fil-PH-BlessicaNeural");
    assert.equal(edgeCalls[0].lang, "fil-PH");
    assert.equal(fetchCalls.length, 0);
  });

  it("sends Blessica to the TTS engine for English", async () => {
    await voice.synthesizeEdgeSpeech({
      text: "I am here with you. Take your time.",
    });

    assert.equal(edgeCalls.length, 1);
    assert.equal(edgeCalls[0].voice, "fil-PH-BlessicaNeural");
    assert.equal(fetchCalls.length, 0);
  });

  it("tries every known Edge endpoint with the same voice, then fails clearly — never another voice", async () => {
    edgeBehaviour = "throw";

    await assert.rejects(
      () => voice.synthesizeEdgeSpeech({ text: "Kumusta ka?" }),
      (error) => {
        assert.equal(error.name, "VoiceSynthesisError");
        assert.equal(error.code, "MUNI_VOICE_UNAVAILABLE");
        assert.match(error.message, /Blessica Neural/);
        assert.ok(Array.isArray(error.cause?.attempts) && error.cause.attempts.length >= 2);
        return true;
      },
    );

    // One attempt per endpoint, all Blessica. No Google Translate (https.get) and no other voice.
    assert.equal(edgeCalls.length, 3);
    assert.ok(edgeCalls.every((call) => call.voice === "fil-PH-BlessicaNeural"));
    assert.equal(fetchCalls.length, 0);
  });

  it("treats an empty audio payload as a failure instead of falling back", async () => {
    edgeBehaviour = "empty";

    await assert.rejects(
      () => voice.synthesizeEdgeSpeech({ text: "Kumusta ka?" }),
      /Blessica Neural/,
    );
    assert.equal(fetchCalls.length, 0);
  });

  it("rejects empty text without contacting any provider", async () => {
    await assert.rejects(() => voice.synthesizeEdgeSpeech({ text: "   " }), /Text is required/);
    assert.equal(edgeCalls.length, 0);
    assert.equal(fetchCalls.length, 0);
  });
});

/* ------------------------------------------------------------------ */
/* ISSUE 2 — single Groq Whisper model                                  */
/* ------------------------------------------------------------------ */

describe("Groq Whisper transcription", () => {
  it("posts to Groq with the single configured model", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "Kumusta Muni, pagod ako.", language: "tl" }));

    const result = await voice.transcribeWithGroqWhisper({
      audioBase64: Buffer.from("fake-m4a-audio").toString("base64"),
      mimeType: "audio/m4a",
      filename: "recording.m4a",
    });

    assert.equal(fetchCalls.length, 1, "exactly one request; no model fallback");
    assert.equal(
      fetchCalls[0].url,
      "https://api.groq.com/openai/v1/audio/transcriptions",
    );
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.equal(fetchCalls[0].init.headers.Authorization, "Bearer test-key");

    const form = fetchCalls[0].init.body;
    assert.equal(form.get("model"), "whisper-large-v3-turbo");
    assert.equal(form.get("response_format"), "verbose_json");
    assert.equal(form.get("temperature"), "0");

    const file = form.get("file");
    assert.equal(file.name, "recording.m4a");
    assert.equal(file.type, "audio/m4a");

    assert.equal(result.text, "Kumusta Muni, pagod ako.");
    assert.equal(result.language, "fil");
    assert.equal(result.model, "whisper-large-v3-turbo");
  });

  it("returns English transcripts with an English language tag", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "I feel tired today.", language: "en" }));

    const result = await voice.transcribeWithGroqWhisper({
      audioBase64: Buffer.from("fake-audio").toString("base64"),
      mimeType: "audio/webm",
      filename: "recording.webm",
    });

    assert.equal(result.text, "I feel tired today.");
    assert.equal(result.language, "en");
    assert.equal(fetchCalls[0].init.body.get("file").type, "audio/webm");
  });

  it("keeps webm recordings as webm and repairs a mismatched filename", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "hello" }));

    await voice.transcribeWithGroqWhisper({
      audioBase64: Buffer.from("fake-audio").toString("base64"),
      mimeType: "audio/webm;codecs=opus",
      filename: "recording.m4a",
    });

    const file = fetchCalls[0].init.body.get("file");
    assert.equal(file.type, "audio/webm");
    assert.equal(file.name, "recording.webm");
  });

  it("rejects an empty recording without calling Groq", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "should not happen" }));

    await assert.rejects(
      () => voice.transcribeWithGroqWhisper({ audioBase64: "", mimeType: "audio/m4a" }),
      (error) => {
        assert.equal(error.code, "EMPTY_AUDIO");
        assert.equal(error.status, 400);
        return true;
      },
    );
    assert.equal(fetchCalls.length, 0);
  });

  it("rejects an unsupported audio type without calling Groq", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "should not happen" }));

    await assert.rejects(
      () =>
        voice.transcribeWithGroqWhisper({
          audioBase64: Buffer.from("x").toString("base64"),
          mimeType: "video/mp4",
        }),
      (error) => {
        assert.equal(error.code, "UNSUPPORTED_AUDIO_TYPE");
        assert.equal(error.status, 415);
        return true;
      },
    );
    assert.equal(fetchCalls.length, 0);
  });

  it("fails clearly on an upstream error without retrying another model", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse("model overloaded", { status: 500 }));

    await assert.rejects(
      () =>
        voice.transcribeWithGroqWhisper({
          audioBase64: Buffer.from("x").toString("base64"),
          mimeType: "audio/m4a",
        }),
      (error) => {
        assert.equal(error.code, "TRANSCRIPTION_UPSTREAM_ERROR");
        assert.equal(error.status, 502);
        assert.match(error.message, /500/);
        return true;
      },
    );
    assert.equal(fetchCalls.length, 1);
  });

  it("fails clearly when the network is unreachable", async () => {
    process.env.GROQ_API_KEY = "test-key";
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    await assert.rejects(
      () =>
        voice.transcribeWithGroqWhisper({
          audioBase64: Buffer.from("x").toString("base64"),
          mimeType: "audio/m4a",
        }),
      (error) => {
        assert.equal(error.code, "TRANSCRIPTION_UNREACHABLE");
        return true;
      },
    );
  });

  it("fails clearly on an invalid JSON response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token");
      },
      text: async () => "",
    });

    await assert.rejects(
      () =>
        voice.transcribeWithGroqWhisper({
          audioBase64: Buffer.from("x").toString("base64"),
          mimeType: "audio/m4a",
        }),
      (error) => {
        assert.equal(error.code, "TRANSCRIPTION_INVALID_RESPONSE");
        return true;
      },
    );
  });

  it("returns an empty transcript (not an error) when no speech is detected", async () => {
    process.env.GROQ_API_KEY = "test-key";
    stubFetch(() => jsonResponse({ text: "", language: "en" }));

    const result = await voice.transcribeWithGroqWhisper({
      audioBase64: Buffer.from("x").toString("base64"),
      mimeType: "audio/m4a",
    });

    assert.equal(result.text, "");
  });

  it("refuses to transcribe when the server key is missing", async () => {
    // GROQ_API_KEY deleted in beforeEach — proves the key stays on the backend.
    await assert.rejects(
      () =>
        voice.transcribeWithGroqWhisper({
          audioBase64: Buffer.from("x").toString("base64"),
          mimeType: "audio/m4a",
        }),
      (error) => {
        assert.equal(error.code, "TRANSCRIPTION_NOT_CONFIGURED");
        return true;
      },
    );
  });
});

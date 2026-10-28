"use strict";

const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const fs = require("node:fs/promises");
const http = require("node:http");
const express = require("express");

/* Stub the Edge TTS transport before the route/service graph is loaded. */
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
    if (edgeBehaviour === "throw") throw new Error("socket hang up");
    await fs.writeFile(audioPath, Buffer.from("ID3-blessica"));
  }
}

require.cache[edgeModulePath] = {
  id: edgeModulePath,
  filename: edgeModulePath,
  loaded: true,
  exports: { EdgeTTS: FakeEdgeTTS },
};

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/api/voice", require("../src/api/voice.routes"));

let server;
let baseUrl;
const realFetch = globalThis.fetch;

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(baseUrl + path);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  globalThis.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
  if (realEdgeModule) require.cache[edgeModulePath] = realEdgeModule;
  else delete require.cache[edgeModulePath];
});

beforeEach(() => {
  edgeCalls = [];
  edgeBehaviour = "ok";
  globalThis.fetch = realFetch;
  process.env.GROQ_API_KEY = "test-key";
});

describe("POST /api/voice/speak", () => {
  it("always answers with Blessica Neural, even if the client asks for another voice", async () => {
    const res = await postJson("/api/voice/speak", {
      text: "Kumusta ka? Nandito lang ako.",
      voice: "en-US-JennyNeural",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.voice, "fil-PH-BlessicaNeural");
    assert.equal(res.body.language, "fil-PH");
    assert.equal(res.body.contentType, "audio/mp3");
    assert.ok(res.body.audioBase64.length > 0);

    assert.equal(edgeCalls.length, 1);
    assert.equal(edgeCalls[0].voice, "fil-PH-BlessicaNeural");
    assert.equal(edgeCalls[0].lang, "fil-PH");
  });

  it("uses the same Blessica voice for an English reply", async () => {
    const res = await postJson("/api/voice/speak", {
      text: "I am here with you. Take your time.",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.voice, "fil-PH-BlessicaNeural");
    assert.equal(edgeCalls[0].voice, "fil-PH-BlessicaNeural");
  });

  it("returns a controlled 502 instead of substituting a voice when Blessica fails", async () => {
    edgeBehaviour = "throw";

    const res = await postJson("/api/voice/speak", { text: "Kumusta ka?" });

    assert.equal(res.status, 502);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, "MUNI_VOICE_UNAVAILABLE");
    assert.match(res.body.message, /Blessica Neural/);
    assert.equal(res.body.audioBase64, undefined);
    assert.equal(globalThis.fetch, realFetch, "no alternative provider was called");
  });

  it("rejects an empty text request", async () => {
    const res = await postJson("/api/voice/speak", { text: "  " });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "TEXT_REQUIRED");
    assert.equal(edgeCalls.length, 0);
  });
});

describe("POST /api/voice/transcribe", () => {
  it("transcribes with the single Groq Whisper model and echoes it", async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.groq.com/openai/v1/audio/transcriptions");
      assert.equal(init.body.get("model"), "whisper-large-v3-turbo");
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: "Kumusta Muni, pagod ako.", language: "tl" }),
        text: async () => "",
      };
    };

    const res = await postJson("/api/voice/transcribe", {
      audioBase64: Buffer.from("m4a-bytes").toString("base64"),
      mimeType: "audio/m4a",
      filename: "recording.m4a",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.text, "Kumusta Muni, pagod ako.");
    assert.equal(res.body.language, "fil");
    assert.equal(res.body.model, "whisper-large-v3-turbo");
  });

  it("rejects an empty recording", async () => {
    const res = await postJson("/api/voice/transcribe", { audioBase64: "" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "EMPTY_AUDIO");
  });

  it("rejects an unsupported audio type", async () => {
    const res = await postJson("/api/voice/transcribe", {
      audioBase64: Buffer.from("x").toString("base64"),
      mimeType: "video/mp4",
    });

    assert.equal(res.status, 415);
    assert.equal(res.body.code, "UNSUPPORTED_AUDIO_TYPE");
  });

  it("surfaces an upstream failure without trying another provider", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return {
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => "upstream unavailable",
      };
    };

    const res = await postJson("/api/voice/transcribe", {
      audioBase64: Buffer.from("x").toString("base64"),
      mimeType: "audio/m4a",
    });

    assert.equal(res.status, 502);
    assert.equal(res.body.code, "TRANSCRIPTION_UPSTREAM_ERROR");
    assert.equal(calls, 1, "exactly one provider request");
  });
});

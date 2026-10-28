"use strict";

/**
 * Canary for the Edge Read Aloud handshake.
 *
 * On 2026-10-24 Microsoft migrated the Edge TTS endpoint and started rejecting clients that
 * still send the v1 `Sec-MS-GEC` token (production returned HTTP 200/403 instead of 101, so
 * every synthesis failed with "Unexpected server response"). `node-edge-tts@1.2.12`
 * (published 2026-10-26) is the first version that sends `Sec-MS-GEC-Version: 2-…` with the
 * CS64-SHA256 token, which is what fixed the deployed backend.
 *
 * A downgrade here silently breaks Muni's voice again, so pin the contract instead of the
 * behaviour of a live network call (which would make this suite flaky).
 */

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const drm = require("node-edge-tts/dist/drm");
const pkg = require("node-edge-tts/package.json");

function versionAtLeast(actual, minimum) {
  const a = actual.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

describe("Edge TTS client contract", () => {
  it("installs a client that sends the v2 Sec-MS-GEC token", () => {
    assert.ok(
      versionAtLeast(pkg.version, "1.2.12"),
      "node-edge-tts " + pkg.version + " predates the v2 handshake; Microsoft rejects it",
    );
    assert.equal(typeof drm.generateSecMsGecToken_V2, "function");
    assert.match(drm.SEC_MS_GEC_VERSION_V2, /^2-/);
  });

  it("produces a well-formed, stable 5-minute token", () => {
    const first = drm.generateSecMsGecToken_V2();
    const second = drm.generateSecMsGecToken_V2();

    // <16 hex>-<64 hex>: CS64 digest + SHA-256 digest.
    assert.match(first, /^[0-9A-F]{16}-[0-9A-F]{64}$/);
    assert.equal(first, second, "token must be stable inside the same 5-minute window");
  });

  it("rotates the token across 5-minute windows", () => {
    const now = Math.floor(Date.now() / 1000);
    const a = drm.generateSecMsGecToken_V2(now);
    const b = drm.generateSecMsGecToken_V2(now + 300);
    assert.notEqual(a, b);
  });
});

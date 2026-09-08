const express = require("express");

const router = express.Router();

const NEGATIVE_TRIGGER_WORDS = [
  "die",
  "death",
  "kill",
  "dead",
  "hate",
  "haters",
  "grave",
  "suck",
  "sucking",
  "shadows get darker",
  "pain",
  "suffer",
  "cruel",
  "fear",
  "afraid",
  "flaws",
  "failure",
  "fool",
  "sad",
  "grief",
  "tragedy",
  "evil",
  "ugly",
  "darkness",
  "doom",
  "worthless",
  "enemy",
  "dick",
  "shit",
  "hair is thinning",
  "scalp",
  "cars are bad",
  "shipwreck",
  "naked",
  "mouth closed",
  "religion",
  "press makes",
  "surrenders to god",
];

function isUpbeatAndPositive(text) {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  if (clean.length < 10 || clean.length > 140) return false;
  if (clean.includes("Too many requests") || clean.includes("auth key")) return false;

  const lower = clean.toLowerCase();
  for (const word of NEGATIVE_TRIGGER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) {
      return false;
    }
  }
  return true;
}

let recentDelivered = [];

async function fetchFromUpstreamSources() {
  // Affirmations API (https://www.affirmations.dev/)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://www.affirmations.dev/?_ts=${Date.now() + Math.random()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.affirmation && typeof data.affirmation === "string") {
        const candidate = data.affirmation.trim();
        if (isUpbeatAndPositive(candidate)) {
          return candidate;
        }
      }
    }
  } catch {}
  return null;
}

router.get("/", async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  // Try to fetch a quote that hasn't been recently delivered
  let quote = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const fetched = await fetchFromUpstreamSources();
    if (fetched) {
      if (!recentDelivered.includes(fetched)) {
        quote = fetched;
        break;
      }
      if (!quote) {
        quote = fetched;
      }
    }
  }

  if (quote) {
    recentDelivered = [quote, ...recentDelivered.filter((item) => item !== quote)].slice(0, 25);
    return res.json({ ok: true, affirmation: quote, quote });
  }

  if (recentDelivered.length > 0) {
    const unused = recentDelivered.slice(1);
    const randomItem = (unused.length > 0 ? unused : recentDelivered)[
      Math.floor(Math.random() * (unused.length > 0 ? unused.length : recentDelivered.length))
    ];
    return res.json({ ok: true, affirmation: randomItem, quote: randomItem });
  }

  return res.json({
    ok: true,
    affirmation: "You are capable of wonderful things today!",
    quote: "You are capable of wonderful things today!",
  });
});

module.exports = router;

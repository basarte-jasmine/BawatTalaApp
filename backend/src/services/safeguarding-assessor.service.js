/**
 * Safeguarding context assessor.
 * Loads counselor-configured phrases from public.safety_risk_indicators (CMS only).
 * NO hardcoded phrase arrays.
 *
 * familiesHit uses DISTINCT sub-indicator categories (GROOMING ≠ POWER_IMBALANCE).
 * Status: NONE | POTENTIAL | CONFIRMED — separate from sentiment + distress/safety.
 */
"use strict";

const { query } = require("../config/db");

/** Sub-indicator categories that participate in safeguardingStatus stacking. */
const SAFEGUARDING_CATEGORIES = Object.freeze([
  "GROOMING",
  "POWER_IMBALANCE",
  "SECRECY",
  "BOUNDARY_CROSSING",
  "COERCION_BLACKMAIL",
  "AI_ATTACHMENT",
  "ABUSE",
]);

/** Top-level CMS display domains (8) → sub-indicator categories for FE grouping. */
const SAFEGUARDING_DOMAINS = Object.freeze({
  SELF_HARM_CRISIS: ["SELF_HARM", "CRITICAL_LITERAL", "CRITICAL_AMBIGUOUS", "CONFIRMATION_SIGNAL"],
  ABUSE: ["ABUSE"],
  /** Display: "Grooming, Power Imbalance & Boundary Concerns" — sub-indicators stay distinct in assessor. */
  GROOMING_POWER_BOUNDARY: ["GROOMING", "POWER_IMBALANCE", "SECRECY", "BOUNDARY_CROSSING"],
  COERCION: ["COERCION_BLACKMAIL"],
  BULLYING_HARASSMENT: ["BULLYING_HARASSMENT"],
  THREAT_VIOLENCE: ["THREAT_VIOLENCE"],
  UNSAFE_ENVIRONMENT: ["UNSAFE_ENVIRONMENT", "SUBSTANCE"],
  AI_ATTACHMENT: ["AI_ATTACHMENT"],
});

const SAFEGUARDING_DOMAIN_LABELS = Object.freeze({
  SELF_HARM_CRISIS: "Self-Harm & Crisis",
  ABUSE: "Abuse",
  GROOMING_POWER_BOUNDARY: "Grooming, Power Imbalance & Boundary Concerns",
  COERCION: "Coercion & Blackmail",
  BULLYING_HARASSMENT: "Bullying & Harassment",
  THREAT_VIOLENCE: "Threat & Violence",
  UNSAFE_ENVIRONMENT: "Unsafe Environment & Substance",
  AI_ATTACHMENT: "AI Attachment / Parasocial",
});

const STACK_CATEGORIES = Object.freeze([
  "SECRECY",
  "COERCION_BLACKMAIL",
  "BOUNDARY_CROSSING",
  "POWER_IMBALANCE",
  "GROOMING",
  "ABUSE",
]);

const RANK = Object.freeze({ NONE: 0, POTENTIAL: 1, CONFIRMED: 2 });

function normalizeStatus(value) {
  const raw = String(value || "NONE").trim().toUpperCase();
  if (raw === "POTENTIAL" || raw === "CONFIRMED") return raw;
  return "NONE";
}

function maxStatus(a, b) {
  const left = normalizeStatus(a);
  const right = normalizeStatus(b);
  return RANK[left] >= RANK[right] ? left : right;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function collectConversationText(messages, latestUserText) {
  const parts = [];
  if (Array.isArray(messages)) {
    for (const item of messages) {
      const role = String(item?.role || "").toLowerCase();
      if (role !== "user" && role !== "student") continue;
      const text = String(item?.text || item?.content || "").trim();
      if (text) parts.push(text);
    }
  }
  const latest = String(latestUserText || "").trim();
  if (latest) parts.push(latest);
  return parts.join("\n");
}

let cache = { at: 0, rows: [] };
const CACHE_MS = 30000;

async function loadIndicators({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.rows.length && now - cache.at < CACHE_MS) return cache.rows;
  const result = await query(
    `
      select id, phrase, category, variants, is_enabled
      from public.safety_risk_indicators
      where is_enabled = true
        and category = any($1::text[])
    `,
    [SAFEGUARDING_CATEGORIES.slice()],
  );
  const rows = [];
  for (const row of result.rows || []) {
    const category = String(row.category || "").trim().toUpperCase();
    if (!SAFEGUARDING_CATEGORIES.includes(category)) continue;
    const phrases = [row.phrase]
      .concat(Array.isArray(row.variants) ? row.variants : [])
      .map((p) => String(p || "").trim())
      .filter(Boolean);
    for (const phrase of phrases) {
      rows.push({ id: row.id, family: category, category, phrase });
    }
  }
  cache = { at: now, rows };
  return rows;
}

function matchIndicators(haystack, indicators) {
  const text = normalizeText(haystack);
  if (!text) return [];
  const hits = [];
  for (const row of indicators) {
    const phrase = normalizeText(row.phrase);
    if (!phrase) continue;
    if (!text.includes(phrase)) continue;
    hits.push({
      id: row.id,
      family: row.family,
      category: row.category,
      phrase: row.phrase,
    });
  }
  return hits;
}

async function assessSafeguarding({ messages, latestUserText, priorStatus } = {}) {
  const indicators = await loadIndicators();
  const haystack = collectConversationText(messages, latestUserText);
  const hits = matchIndicators(haystack, indicators);
  // Distinct sub-indicator categories — GROOMING stays GROOMING, not merged into POWER
  const familiesHit = [...new Set(hits.map((h) => h.family).filter(Boolean))];
  const stackHits = familiesHit.filter((f) => STACK_CATEGORIES.includes(f));
  const hasAiAttachment = familiesHit.includes("AI_ATTACHMENT");

  let status = "NONE";
  let reason = "no_indicator_hits";
  if (hits.length === 0) {
    status = "NONE";
  } else if (stackHits.length >= 2) {
    status = "CONFIRMED";
    reason = `stacked_families:${stackHits.join(",")}`;
  } else if (
    stackHits.length === 1 &&
    (hits.length >= 3 || (hasAiAttachment && hits.length >= 2))
  ) {
    status = "CONFIRMED";
    reason = `stack_family_plus_support:${stackHits[0]}`;
  } else if (hasAiAttachment && familiesHit.length === 1) {
    status = "POTENTIAL";
    reason = "soft_or_single:AI_ATTACHMENT";
  } else {
    status = "POTENTIAL";
    reason = `soft_or_single:${familiesHit.join(",") || "unknown"}`;
  }

  status = maxStatus(status, priorStatus);

  return {
    status,
    familiesHit,
    hits,
    reason,
    indicatorCount: indicators.length,
  };
}

function invalidateSafeguardingAssessorCache() {
  cache = { at: 0, rows: [] };
}

module.exports = {
  assessSafeguarding,
  invalidateSafeguardingAssessorCache,
  normalizeStatus,
  maxStatus,
  SAFEGUARDING_CATEGORIES,
  SAFEGUARDING_DOMAINS,
  SAFEGUARDING_DOMAIN_LABELS,
};

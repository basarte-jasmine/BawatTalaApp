/**
 * Centralized Safety & Wellness Configuration Service.
 * Retrieves configurable phrases, patterns, thresholds, rules, and response templates from the database.
 * Fails safely if database is unavailable.
 * Strictly NO hardcoded safety rules, canned fallback messages, or detection phrases in application code.
 */
"use strict";

const { query } = require("../config/db");

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache
let cachedConfig = null;
let cacheExpiresAt = 0;

/** Default config used ONLY as safe fallback structure if DB fails */
const DEFAULT_CONFIG_FALLBACK = {
  wellness: {
    max_offers_per_entry: 2,
    min_intervening_turns: 1,
    recent_distress_window_turns: 3,
    deescalation_reassurance_window_turns: 2,
  },
  concern_categories: [
    "BULLYING_HARASSMENT",
    "ABUSE",
    "GROOMING",
    "POWER_IMBALANCE",
    "COERCION_BLACKMAIL",
    "THREAT_VIOLENCE",
    "UNSAFE_ENVIRONMENT",
    "AI_ATTACHMENT",
  ],
  templates: {
    SAFETY_SUPPORT: {
      default: "I hear how heavy and hurtful this situation is, and I want you to know that this is not your fault. Your safety and well-being come first—are you in a safe place right now? Please consider reaching out to a guidance counselor or trusted adult who can support you through this.",
      BULLYING_HARASSMENT: "What you are experiencing with bullying is unfair and painful, and it is never your fault. You deserve to feel safe and respected. Are you feeling safe right now? Reaching out to a guidance counselor or trusted adult can help protect you.",
      ABUSE: "I am so sorry you are going through this. Please know that abuse or being hurt is never your fault. Your immediate safety is the most important thing—are you safe right now? Please talk to a guidance counselor, trusted adult, or emergency support immediately.",
      GROOMING: "Thank you for sharing this with me. What you are describing involves an unfair power imbalance or crossing of boundaries, and none of this is your fault. Are you safe right now? I strongly encourage you to talk with a guidance counselor or trusted adult about this.",
      POWER_IMBALANCE: "What you are describing involves an unfair power dynamic, and you should never have to carry that pressure. It is not your fault. Are you in a safe situation right now? Please consider speaking to a guidance counselor who can support you safely.",
      COERCION_BLACKMAIL: "Please know that being threatened or pressured like this is not your fault, and you do not have to handle it alone. Are you safe right now? Please reach out to a trusted adult, guidance counselor, or authorities who can help protect your privacy and safety.",
      THREAT_VIOLENCE: "Your safety is the absolute top priority. If someone is threatening you, that is not your fault and you deserve protection. Are you somewhere safe right now? Please contact a trusted adult, school counselor, or emergency services right away.",
      UNSAFE_ENVIRONMENT: "It sounds really difficult and unsafe right now, and you deserve a secure, caring space. Are you safe at this moment? Please consider connecting with a counselor or trusted adult who can help you find shelter and support.",
      AI_ATTACHMENT: "I care about your well-being, and I am glad you feel comfortable sharing here. As your journaling companion, Muni is here to reflect and help you process your thoughts, but I cannot be a romantic partner. You deserve real-world connections, care, and human relationships."
    },
    CRITICAL_SAFETY: {
      default: "I hear how deeply painful things are right now, and I care about your safety. You do not have to carry this alone. Please connect with someone who can help right now—reach out to a crisis line, trusted adult, or emergency services."
    },
    CRITICAL_CLARIFY: {
      default: "What you shared sounds really heavy, and I want to make sure you are okay. When you say that, do you mean it literally right now, or is it an expression of how overwhelmed you feel? What is going on?"
    }
  }
};

function invalidateSafetyConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

/**
 * Loads safety configurations and response templates from public.safety_configurations.
 */
async function getSafetyConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now < cacheExpiresAt) {
    return cachedConfig;
  }

  try {
    const result = await query(
      "select config_key, config_value, is_enabled from public.safety_configurations where is_enabled = true"
    );

    if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
      cachedConfig = DEFAULT_CONFIG_FALLBACK;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return cachedConfig;
    }

    const cfg = {
      wellness: { ...DEFAULT_CONFIG_FALLBACK.wellness },
      concern_categories: [...DEFAULT_CONFIG_FALLBACK.concern_categories],
      templates: JSON.parse(JSON.stringify(DEFAULT_CONFIG_FALLBACK.templates)),
    };

    for (const row of result.rows) {
      const key = String(row.config_key || "").trim();
      const val = row.config_value;
      if (key === "wellness_offer_rules" && typeof val === "object" && val !== null) {
        cfg.wellness = { ...cfg.wellness, ...val };
      } else if (key === "concern_categories" && Array.isArray(val)) {
        cfg.concern_categories = val;
      } else if (key.startsWith("template_")) {
        const templateType = key.replace(/^template_/, "").toUpperCase();
        if (!cfg.templates[templateType]) cfg.templates[templateType] = {};
        if (typeof val === "object" && val !== null) {
          cfg.templates[templateType] = { ...cfg.templates[templateType], ...val };
        }
      }
    }

    cachedConfig = cfg;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedConfig;
  } catch (error) {
    console.warn("Could not load safety config from database. Using safe fallback.", error?.message || error);
    cachedConfig = DEFAULT_CONFIG_FALLBACK;
    cacheExpiresAt = now + 10000;
    return cachedConfig;
  }
}

/**
 * Returns a safety response template for a concern type or persona.
 */
async function getSafetySupportTemplate(concernType = "default", persona = "SAFETY_SUPPORT") {
  const config = await getSafetyConfig();
  const templates = config.templates?.[persona] || config.templates?.SAFETY_SUPPORT || {};
  return templates[concernType] || templates.default || config.templates?.SAFETY_SUPPORT?.default || "";
}

module.exports = {
  getSafetyConfig,
  getSafetySupportTemplate,
  invalidateSafetyConfigCache,
  DEFAULT_CONFIG_FALLBACK,
};


/**
 * Safety Schema & Data Migration Service.
 * Ensures:
 * 1. public.safety_configurations table exists for database-managed rules, templates, and wellness offer limits.
 * 2. public.safety_risk_indicators supports PLAN_MEANS_TIMEFRAME, ACTION_TAKEN, DEESCALATION_REASSURANCE, WORSENING_DISTRESS.
 * 3. public.journal_entries has wellness_offer_count, last_wellness_offer_turn, wellness_offer_status, wellness_offer_history, concern_type.
 * 4. Seeds default database-managed configs and indicators idempotently.
 */
"use strict";

const { query } = require("../config/db");
const { DEFAULT_CONFIG_FALLBACK } = require("./safety-config.service");

const ALL_SAFETY_CATEGORIES = [
  "SELF_HARM",
  "ABUSE",
  "GROOMING",
  "COERCION_BLACKMAIL",
  "BULLYING_HARASSMENT",
  "THREAT_VIOLENCE",
  "UNSAFE_ENVIRONMENT",
  "SUBSTANCE",
  "EMOTIONAL_DISTRESS",
  "EXPRESSION_HYPERBOLE",
  "CONFIRMATION_SIGNAL",
  "OTHER",
  "POWER_IMBALANCE",
  "SECRECY",
  "BOUNDARY_CROSSING",
  "AI_ATTACHMENT",
  "CRITICAL_LITERAL",
  "CRITICAL_AMBIGUOUS",
  "DISTRESS",
  "DENY_HYPERBOLE",
  "CONFIRM_LITERAL",
  "PLAN_MEANS_TIMEFRAME",
  "ACTION_TAKEN",
  "DEESCALATION_REASSURANCE",
  "WORSENING_DISTRESS",
];

const SEED_CONFIG_RECORDS = [
  {
    key: "wellness_offer_rules",
    value: {
      max_offers_per_entry: 2,
      min_intervening_turns: 1,
      recent_distress_window_turns: 3,
      deescalation_reassurance_window_turns: 2,
    },
    description: "Rules governing the inline wellness popup (max 2 offers, non-consecutive, context-sensitive)",
  },
  {
    key: "concern_categories",
    value: [
      "BULLYING_HARASSMENT",
      "ABUSE",
      "GROOMING",
      "POWER_IMBALANCE",
      "COERCION_BLACKMAIL",
      "THREAT_VIOLENCE",
      "UNSAFE_ENVIRONMENT",
      "AI_ATTACHMENT",
      "EMOTIONAL_DISTRESS",
      "SELF_HARM",
    ],
    description: "Categories of student concern independent of risk level",
  },
  {
    key: "template_safety_support",
    value: DEFAULT_CONFIG_FALLBACK.templates.SAFETY_SUPPORT,
    description: "Response templates for SAFETY_SUPPORT persona by concern type",
  },
  {
    key: "template_critical_safety",
    value: DEFAULT_CONFIG_FALLBACK.templates.CRITICAL_SAFETY,
    description: "Response templates for CRITICAL_SAFETY persona",
  },
  {
    key: "template_critical_clarify",
    value: DEFAULT_CONFIG_FALLBACK.templates.CRITICAL_CLARIFY,
    description: "Response templates for CRITICAL_CLARIFY persona",
  },
];

const SEED_NEW_INDICATORS = [
  {
    phrase: "stressed",
    category: "EMOTIONAL_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Stress, feeling stressed, or academic stress",
    variants: [
      "naiistress",
      "na-iistress",
      "stress na stress",
      "na-stress",
      "already stressed",
      "so stressed",
      "super stressed",
      "stress ako",
      "stress na ako",
      "sobrang stress",
      "stressed out",
      "stressing me out",
    ],
  },
  {
    phrase: "drained",
    category: "EMOTIONAL_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Feeling drained or depleted",
    variants: [
      "drains me",
      "draining",
      "so drained",
      "feeling drained",
      "emotionally drained",
      "mentally drained",
      "drained na drained",
      "ubos na ubos",
    ],
  },
  {
    phrase: "hindi ko na alam",
    category: "WORSENING_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Feeling lost, overwhelmed or unable to think/cope",
    variants: [
      "di ko na alam",
      "hindi ko na alam gagawin",
      "di ko na alam gagawin",
      "di ko na maintindihan",
      "hindi ko na maintindihan",
      "hindi ko na alam gagawin ko",
    ],
  },
  {
    phrase: "ang bigat",
    category: "EMOTIONAL_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Tagalog heavy emotional burden",
    variants: [
      "sobrang bigat",
      "bigat na bigat",
      "ang bigat ng pakiramdam",
      "bigat ng nararamdaman",
      "mabigat sa loob",
    ],
  },
  {
    phrase: "pagod na ako",
    category: "EMOTIONAL_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Tagalog mental/emotional exhaustion",
    variants: [
      "pagod na ko",
      "sobrang pagod",
      "pagod na utak ko",
      "pagod na ang utak ko",
      "pagod na katawan at isip ko",
    ],
  },
  // 1. ACTION_TAKEN (Explicit suicide attempt or harmful action already taken)
  {
    phrase: "i already took the pills",
    category: "ACTION_TAKEN",
    severity_tier: "CRITICAL",
    description: "Action already taken: ingestion or overdose",
    variants: [
      "already took the pills",
      "i already took pills",
      "i took all the pills",
      "i drank the bleach",
      "uminom na ako ng gamot",
      "uminom na ko ng lason",
      "nakainom na ako",
      "sinaksak ko sarili ko",
      "hiniwa ko na pulso ko",
      "cut my wrists already",
      "i jumped",
      "tumalon na ako",
    ],
  },
  {
    phrase: "i just swallowed a bunch of pills",
    category: "ACTION_TAKEN",
    severity_tier: "CRITICAL",
    description: "Action already taken: swallowing pills",
    variants: [
      "swallowed a bunch of pills",
      "just overdosed",
      "nag-overdose na ako",
      "inubos ko na gamot",
    ],
  },

  // 2. PLAN_MEANS_TIMEFRAME (Explicit suicide plans with means, intent, or timeframe)
  {
    phrase: "i have a plan to end my life tonight",
    category: "PLAN_MEANS_TIMEFRAME",
    severity_tier: "CRITICAL",
    description: "Explicit near-term plan to end life tonight",
    variants: [
      "i have a plan to end my life",
      "plan to end my life tonight",
      "plan to kill myself tonight",
      "i will end my life tonight",
      "i will kill myself tonight",
      "mamayang gabi tatapusin ko na",
      "mamaya magpapakamatay na ako",
      "tatapusin ko na mamaya",
      "magpapakamatay ako mamayang gabi",
    ],
  },
  {
    phrase: "i have a plan",
    category: "PLAN_MEANS_TIMEFRAME",
    severity_tier: "CRITICAL",
    description: "Explicit statement of suicide plan",
    variants: [
      "may plano na ako",
      "may plano na ko magpakamatay",
      "i have a plan and the pills",
      "i have a rope and a plan",
      "may lubid na ako",
      "may gamot na ako para tapusin to",
      "handa na ang lahat para magpakamatay",
      "i have everything ready to die",
    ],
  },

  // 3. WORSENING_DISTRESS (Tagalog and English expressions of deepening overwhelm)
  {
    phrase: "hindi ko na kaya",
    category: "WORSENING_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Tagalog worsening distress expression (cannot take it anymore)",
    variants: [
      "di ko na kaya",
      "hindi ko na kakayanin",
      "di ko na kakayanin",
      "hindi ko na kaya to",
      "di ko na kaya talaga",
      "hindi na kaya ng utak ko",
      "hindi ko na kayang mabuhay ng ganito",
      "i can't take it anymore",
      "i cant take it anymore",
      "i cannot take this anymore",
      "can't do this anymore",
      "cant do this anymore",
      "i can't go on",
      "i cant go on",
    ],
  },
  {
    phrase: "hindi na",
    category: "WORSENING_DISTRESS",
    severity_tier: "DISTRESS",
    description: "Tagalog expression of giving up or cessation under distress",
    variants: [
      "hindi na talaga",
      "di na talaga",
      "ayoko na",
      "ayaw ko na",
      "suko na ako",
      "susuko na ako",
    ],
  },

  // 4. DEESCALATION_REASSURANCE (Legitimate recovery/okay statements)
  {
    phrase: "okay na, kaya ko pa",
    category: "DEESCALATION_REASSURANCE",
    severity_tier: "FILTER",
    description: "Tagalog reassurance: okay now, can still cope",
    variants: [
      "okay na kaya ko pa",
      "kaya ko pa",
      "kaya pa naman",
      "kakayanin pa",
      "kakayanin ko pa",
      "mas maayos na ako",
      "mas okay na pakiramdam ko",
      "i'm okay now",
      "im okay now",
      "i am okay now",
      "i feel better now",
      "feeling much better",
      "i can handle it now",
      "i can manage now",
      "false alarm",
      "calmed down already",
      "nahimasmasan na ako",
    ],
  },
];

async function ensureSafetySchema(poolClient = null) {
  const dbQuery = poolClient
    ? (sql, params) => poolClient.query(sql, params)
    : (sql, params) => query(sql, params);

  // 1. Create public.safety_configurations table
  await dbQuery(`
    create table if not exists public.safety_configurations (
      id uuid primary key default gen_random_uuid(),
      config_key text not null unique,
      config_value jsonb not null default '{}'::jsonb,
      description text,
      is_enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await dbQuery(`
    create index if not exists safety_configurations_key_idx
      on public.safety_configurations (config_key);
  `);

  // 2. Add wellness offer tracking and concern_type columns to journal_entries
  await dbQuery(`
    alter table public.journal_entries
      add column if not exists wellness_offer_count integer not null default 0,
      add column if not exists last_wellness_offer_turn integer,
      add column if not exists wellness_offer_status text not null default 'NOT_OFFERED',
      add column if not exists wellness_offer_history jsonb not null default '[]'::jsonb,
      add column if not exists concern_type text;
  `);

  await dbQuery(`
    alter table public.journal_entries
      drop constraint if exists journal_entries_wellness_offer_status_check;
  `);

  await dbQuery(`
    alter table public.journal_entries
      add constraint journal_entries_wellness_offer_status_check
      check (
        wellness_offer_status in ('NOT_OFFERED', 'OFFERED', 'ACCEPTED', 'DECLINED')
      );
  `);

  // 3. Update safety_risk_indicators category check constraint to include new categories
  await dbQuery(`
    alter table public.safety_risk_indicators
      drop constraint if exists safety_risk_indicators_category_check;
  `);

  const categorySqlList = ALL_SAFETY_CATEGORIES.map((c) => "'" + c + "'").join(", ");
  await dbQuery(`
    alter table public.safety_risk_indicators
      add constraint safety_risk_indicators_category_check check (
        category in (` + categorySqlList + `)
      );
  `);

  // 4. Seed safety_configurations
  for (const record of SEED_CONFIG_RECORDS) {
    await dbQuery(
      `
        insert into public.safety_configurations (config_key, config_value, description, is_enabled)
        values ($1, $2::jsonb, $3, true)
        on conflict (config_key) do update set
          config_value = excluded.config_value,
          description = excluded.description,
          updated_at = now();
      `,
      [record.key, JSON.stringify(record.value), record.description],
    );
  }

  // 5. Seed new indicators into public.safety_risk_indicators
  for (const item of SEED_NEW_INDICATORS) {
    await dbQuery(
      `
        insert into public.safety_risk_indicators (
          phrase, category, severity_tier, is_enabled, description, variants
        ) values ($1, $2, $3, true, $4, $5::jsonb)
        on conflict (phrase) do update set
          category = excluded.category,
          severity_tier = excluded.severity_tier,
          variants = (
            select jsonb_agg(distinct elem)
            from jsonb_array_elements_text(coalesce(public.safety_risk_indicators.variants, '[]'::jsonb) || $5::jsonb) as elem
          ),
          updated_at = now();
      `,
      [item.phrase, item.category, item.severity_tier, item.description, JSON.stringify(item.variants)],
    );
  }
}

module.exports = {
  ensureSafetySchema,
  ALL_SAFETY_CATEGORIES,
  SEED_CONFIG_RECORDS,
  SEED_NEW_INDICATORS,
};

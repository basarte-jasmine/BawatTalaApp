/**
 * Wellness Offer Tracking and Eligibility Service.
 *
 * Rules:
 * - A maximum of TWO Wellness popup appearances per journal entry.
 * - The two appearances must NEVER be on consecutive Muni turns.
 * - Spacing: At least one intervening Muni turn required between offers.
 * - Tracking survives component remounts, screen navigation, and app restarts (backed by DB).
 * - Distinguishes between student declining Wellness and denying suicidal intent.
 * - Crisis alerts and critical risk reassessment are NEVER limited by wellness offer counts.
 */
"use strict";

const { query } = require("../config/db");
const { getSafetyConfig } = require("./safety-config.service");

/**
 * Checks if the journal entry is currently eligible to display an inline wellness popup.
 *
 * @param {{
 *   wellnessOfferCount: number,
 *   lastWellnessOfferTurn: number | null,
 *   currentMuniTurn: number,
 *   distressSignal: string,
 *   safetyStatus: string,
 *   persona: string,
 *   concernType: string,
 * }} state
 * @returns {Promise<{ eligible: boolean, reason: string }>}
 */
async function checkWellnessOfferEligibility({
  wellnessOfferCount = 0,
  lastWellnessOfferTurn = null,
  currentMuniTurn = 1,
  distressSignal = "NONE",
  safetyStatus = "NOT_NEEDED",
  persona = "COMPANION",
  concernType = "NONE",
}) {
  const config = await getSafetyConfig();
  const rules = config.wellness || { max_offers_per_entry: 2, min_intervening_turns: 1 };
  const maxOffers = Number(rules.max_offers_per_entry) || 2;
  const minIntervening = Number(rules.min_intervening_turns) || 1;

  // 1. Critical safety situations require a different response pathway
  if (safetyStatus === "CONFIRMED_CRITICAL" || persona === "CRITICAL_SAFETY" || persona === "CRITICAL_CLARIFY") {
    return { eligible: false, reason: "critical_safety_active" };
  }

  // 2. Safeguarding concerns (Bullying, abuse, grooming, coercion, etc.) use SAFETY_SUPPORT
  if (persona === "SAFETY_SUPPORT" || (concernType && concernType !== "NONE" && concernType !== "EMOTIONAL_DISTRESS")) {
    return { eligible: false, reason: "safeguarding_concern_active" };
  }

  // 3. Must be emotional distress
  if (distressSignal !== "DISTRESS" && persona !== "DISTRESS_SUPPORT") {
    return { eligible: false, reason: "not_in_distress" };
  }

  // 4. Maximum offers reached
  if (wellnessOfferCount >= maxOffers) {
    return { eligible: false, reason: "max_offers_reached" };
  }

  // 5. Non-consecutive turn restriction: at least 1 intervening turn
  if (lastWellnessOfferTurn !== null && lastWellnessOfferTurn !== undefined) {
    const turnsSince = currentMuniTurn - lastWellnessOfferTurn;
    if (turnsSince <= minIntervening) {
      return { eligible: false, reason: "consecutive_turn_restriction" };
    }
  }

  return { eligible: true, reason: "eligible" };
}

/**
 * Records a Wellness offer decision (ACCEPTED or DECLINED).
 * Idempotent: avoids duplicate offer records from repeated taps.
 */
async function recordWellnessOfferDecision({
  entryId,
  studentNumber,
  decision, // "ACCEPTED" | "DECLINED"
  turn = null,
  metadata = {},
}) {
  const normDecision = String(decision || "").trim().toUpperCase();
  if (normDecision !== "ACCEPTED" && normDecision !== "DECLINED") {
    throw new Error("Invalid wellness decision. Must be ACCEPTED or DECLINED.");
  }

  const existingRes = await query(
    `
      select id, student_number, wellness_offer_count, last_wellness_offer_turn,
             wellness_offer_status, wellness_offer_history
      from public.journal_entries
      where id = $1 and student_number = $2
      limit 1
    `,
    [entryId, studentNumber],
  );

  if (existingRes.rowCount === 0) {
    throw new Error("Journal entry not found.");
  }

  const entry = existingRes.rows[0];
  const history = Array.isArray(entry.wellness_offer_history) ? entry.wellness_offer_history : [];

  // Idempotency: If this turn or identical decision was already recorded within the last 5 seconds, ignore
  const now = new Date().toISOString();
  const lastRecord = history[history.length - 1];
  if (lastRecord && lastRecord.decision === normDecision && turn !== null && lastRecord.turn === turn) {
    return {
      wellnessOfferCount: entry.wellness_offer_count,
      lastWellnessOfferTurn: entry.last_wellness_offer_turn,
      wellnessOfferStatus: entry.wellness_offer_status,
      wellnessOfferHistory: history,
    };
  }

  const newRecord = {
    turn: turn ?? (entry.last_wellness_offer_turn || 1),
    decision: normDecision,
    timestamp: now,
    metadata,
  };

  const nextHistory = [...history, newRecord];
  const nextStatus = normDecision;

  const updateRes = await query(
    `
      update public.journal_entries
      set
        wellness_offer_status = $3,
        wellness_offer_history = $4::jsonb,
        updated_at = now()
      where id = $1 and student_number = $2
      returning id, student_number, wellness_offer_count, last_wellness_offer_turn,
                wellness_offer_status, wellness_offer_history
    `,
    [entryId, studentNumber, nextStatus, JSON.stringify(nextHistory)],
  );

  return updateRes.rows[0];
}

/**
 * Registers that an offer was presented to the student on a specific turn.
 * Increments wellness_offer_count and sets last_wellness_offer_turn.
 */
async function registerWellnessOfferPresented({
  entryId,
  studentNumber,
  turn,
}) {
  const res = await query(
    `
      update public.journal_entries
      set
        wellness_offer_count = wellness_offer_count + 1,
        last_wellness_offer_turn = $3,
        wellness_offer_status = 'OFFERED',
        updated_at = now()
      where id = $1 and student_number = $2
      returning id, student_number, wellness_offer_count, last_wellness_offer_turn,
                wellness_offer_status, wellness_offer_history
    `,
    [entryId, studentNumber, turn],
  );

  return res.rows[0] || null;
}

module.exports = {
  checkWellnessOfferEligibility,
  recordWellnessOfferDecision,
  registerWellnessOfferPresented,
};

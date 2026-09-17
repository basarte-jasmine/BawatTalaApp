const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireStudentOnlyAuth);
const DAILY_TALA_CAP = 12;
const ACTIVITY_IDS = new Set(["memory", "pattern", "recall", "words", "odd", "numbers", "match"]);

router.post("/mini-reset-reward", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  const activityId = String(req.body.activityId || "").trim();
  const roundKey = String(req.body.roundKey || "").trim().slice(0, 100);
  const level = Math.max(1, Math.min(Number(req.body.level) || 1, 20));
  if (!/^\d{2}-\d{4}$/.test(studentNumber) || !ACTIVITY_IDS.has(activityId) || !roundKey) {
    return res.status(400).json({ message: "A valid completed mini reset is required." });
  }
  try {
    const today = await query(`select coalesce(sum(reward_tala), 0)::int as total from public.student_wellness_game_rewards where student_number = $1 and created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'`, [studentNumber]);
    const claimedToday = Number(today.rows[0]?.total || 0);
    const rewardTala = claimedToday >= DAILY_TALA_CAP ? 0 : 1;
    const saved = await query(`insert into public.student_wellness_game_rewards (student_number, round_key, activity_id, level, reward_tala) values ($1,$2,$3,$4,$5) on conflict (student_number, round_key) do nothing returning reward_tala`, [studentNumber, roundKey, activityId, level, rewardTala]);
    if (!saved.rowCount) return res.status(409).json({ message: "This gentle round was already counted." });
    let totalTala;
    if (rewardTala) {
      const wallet = await query(`insert into public.student_tala_wallets (student_number, total_tala, updated_at) values ($1,$2,now()) on conflict (student_number) do update set total_tala = public.student_tala_wallets.total_tala + excluded.total_tala, updated_at = now() returning total_tala`, [studentNumber, rewardTala]);
      totalTala = Number(wallet.rows[0]?.total_tala || 0);
    }
    return res.json({ rewardTala, totalTala, dailyCapReached: !rewardTala, message: rewardTala ? "A calm win—+1 Tala added to your wallet." : "Lovely focus. Your daily Tala for mini resets is complete, but you can keep playing." });
  } catch (error) { return res.status(500).json({ message: error.message || "Could not add your Tala right now." }); }
});

module.exports = router;

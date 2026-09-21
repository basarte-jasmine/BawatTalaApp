const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireStudentOnlyAuth);
const DAILY_TALA_CAP = 12;
const ACTIVITY_IDS = new Set(["memory", "pattern", "recall", "words", "odd", "numbers", "match", "count", "color", "fruit-catcher", "image-puzzle", "munis-arrival", "gentle-pairs", "unscramble-word"]);
const ACHIEVEMENTS = new Map([
  ["future-bottle", { title: "A Bottle for Tomorrow", rewardTala: 10, message: "Congratulations! You sent a message toward your future.", trivia: "Muni says the island keeps every hopeful message until the right tide carries it onward." }],
  ["seven-little-stars", { title: "Seven Little Stars", rewardTala: 15, message: "Congratulations! You completed seven daily check-ins.", trivia: "Muni remembers falling through the night sky by following seven small stars toward the island." }],
  ["a-sky-with-many-colors", { title: "A Sky With Many Colors", rewardTala: 15, message: "Congratulations! You logged every emotion.", trivia: "Muni believes emotions are signals from the sky, not storms to be hidden." }],
  ["dear-muni", { title: "Dear Muni", rewardTala: 10, message: "Congratulations! You shared your first journal message with Muni.", trivia: "Muni first learned the word 'dear' from a note it found near the island shore." }],
  ["ink-on-the-page", { title: "Ink on the Page", rewardTala: 10, message: "Congratulations! You saved your first journal entry.", trivia: "Muni's asteroid shell looked hard, but it softened whenever someone wrote honestly nearby." }],
  ["quiet-mode", { title: "Quiet Mode", rewardTala: 10, message: "Congratulations! You made space for your own voice.", trivia: "Before Muni learned to speak, it spent a long time listening to the island wind." }],
  ["named-what-hurt", { title: "Named What Hurt", rewardTala: 10, message: "Congratulations! You named a concern with care.", trivia: "Muni says naming a heavy thing gives it a shape that can finally be held." }],
  ["message-from-the-tide", { title: "Message From the Tide", rewardTala: 10, message: "Congratulations! You opened a drifting bottle note.", trivia: "The first islanders thought Muni arrived as an asteroid; Muni insists it was simply a very dramatic landing." }],
  ["star-shopper", { title: "Star Shopper", rewardTala: 10, message: "Congratulations! You spent Tala in the Muni shop for the first time.", trivia: "Muni collects bright things because they remind it of the sky it crossed before reaching the island." }],
  ["found-the-right-time", { title: "Found the Right Time", rewardTala: 10, message: "Congratulations! You found the right time for a support session.", trivia: "Muni says the island has many tides, and asking for help is one way to find the gentlest one." }],
]);

router.post("/achievement-reward", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  const achievementId = String(req.body.achievementId || "").trim();
  const achievement = ACHIEVEMENTS.get(achievementId);
  if (!/^\d{2}-\d{4}$/.test(studentNumber) || !achievement) {
    return res.status(400).json({ message: "A valid achievement is required." });
  }

  try {
    const saved = await query(
      `insert into public.student_achievements (student_number, achievement_id, achievement_title, reward_tala)
       values ($1, $2, $3, $4)
       on conflict (student_number, achievement_id) do nothing
       returning reward_tala`,
      [studentNumber, achievementId, achievement.title, achievement.rewardTala],
    );
    if (!saved.rowCount) {
      return res.json({ alreadyUnlocked: true, rewardTala: 0, message: "Achievement already unlocked." });
    }

    const wallet = await query(
      `insert into public.student_tala_wallets (student_number, total_tala, updated_at)
       values ($1, $2, now())
       on conflict (student_number) do update set total_tala = public.student_tala_wallets.total_tala + excluded.total_tala, updated_at = now()
       returning total_tala`,
      [studentNumber, achievement.rewardTala],
    );
    await query(
      `insert into public.student_notifications (student_number, kind, title, message, metadata)
       values ($1, 'ACHIEVEMENT_UNLOCKED', $2, $3, $4::jsonb)`,
      [
        studentNumber,
        `${achievement.title} unlocked!`,
        `${achievement.message} You earned +${achievement.rewardTala} Tala\n\nMuni trivia: ${achievement.trivia}`,
        JSON.stringify({ achievementId, achievementTitle: achievement.title, rewardTala: achievement.rewardTala, trivia: achievement.trivia }),
      ],
    );
    return res.json({
      alreadyUnlocked: false,
      achievementId,
      rewardTala: achievement.rewardTala,
      totalTala: Number(wallet.rows[0]?.total_tala || 0),
      message: `${achievement.message} You earned +${achievement.rewardTala} Tala. ${achievement.trivia}`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not unlock this achievement." });
  }
});

router.post("/mini-reset-reward", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  const activityId = String(req.body.activityId || "").trim();
  const roundKey = String(req.body.roundKey || "").trim().slice(0, 100);
  const level = Math.max(1, Math.min(Number(req.body.level) || 1, 20));
  const score = Math.max(0, Math.min(Number(req.body.score) || 0, 100000));
  const distance = Math.max(0, Math.min(Number(req.body.distance) || 0, 100000));
  const leaves = Math.max(0, Math.min(Number(req.body.leaves) || 0, 10000));
  const rounds = Math.max(0, Math.min(Number(req.body.rounds) || 0, 1000));
  if (!/^\d{2}-\d{4}$/.test(studentNumber) || !ACTIVITY_IDS.has(activityId) || !roundKey) {
    return res.status(400).json({ message: "A valid completed mini reset is required." });
  }
  try {
    const today = await query(`select coalesce(sum(reward_tala), 0)::int as total from public.student_wellness_game_rewards where student_number = $1 and created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'`, [studentNumber]);
    const claimedToday = Number(today.rows[0]?.total || 0);
    const calculatedReward = activityId === "fruit-catcher"
      ? Math.max(1, Math.floor(score / 25))
      : activityId === "image-puzzle"
        ? Math.max(1, Math.floor(score / 30))
        : activityId === "munis-arrival"
          ? Math.max(1, Math.floor(distance / 20) + Math.floor(leaves / 3))
          : activityId === "gentle-pairs"
            ? Math.max(1, Math.floor(score / 50) + rounds)
            : activityId === "unscramble-word"
              ? Math.max(1, Math.floor(score / 40) + Math.max(0, level - 1))
              : 1;
    const rewardTala = Math.max(0, Math.min(calculatedReward, DAILY_TALA_CAP - claimedToday));
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

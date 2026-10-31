const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");
const { normalizeEmotionId, getEmotionLabel, resolveRepresentativeEmotion } = require("../constants/emotions");

const router = express.Router();
router.use(requireStudentOnlyAuth);

const MANILA_TIME_ZONE = "Asia/Manila";
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();

function getManilaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value || "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value || "1");
  const day = Number(parts.find((p) => p.type === "day")?.value || "1");
  return { year, monthIndex: month - 1, day, isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function formatManilaIso(dateOrStr) {
  if (!dateOrStr) return "";
  if (typeof dateOrStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)) {
    return dateOrStr;
  }
  const d = new Date(dateOrStr);
  if (Number.isNaN(d.getTime())) return String(dateOrStr).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns the Sunday-to-Saturday window for the most recently COMPLETED calendar week in Asia/Manila.
 * E.g., if today is Monday Oct 26, 2026:
 * Current week is Sun Oct 25 - Sat Oct 31.
 * Completed recap week is Sun Oct 18 - Sat Oct 24.
 */
function getCompletedRecapWeek(now = new Date()) {
  const today = getManilaDateParts(now);
  const manilaDate = new Date(Date.UTC(today.year, today.monthIndex, today.day));
  const dayOfWeek = manilaDate.getUTCDay(); // 0 is Sunday, 1 is Monday...

  // Most recent completed Sunday-to-Saturday week starts (dayOfWeek + 7) days ago:
  const recapSunday = new Date(manilaDate);
  recapSunday.setUTCDate(manilaDate.getUTCDate() - dayOfWeek - 7);

  const recapSaturday = new Date(recapSunday);
  recapSaturday.setUTCDate(recapSunday.getUTCDate() + 6);

  const formatIso = (d) => d.toISOString().slice(0, 10);
  return {
    startIso: formatIso(recapSunday),
    endIso: formatIso(recapSaturday),
    weekKey: `W-${formatIso(recapSunday)}_to_${formatIso(recapSaturday)}`,
  };
}

async function generateMuniLetterWithAI({ studentName, daysCheckedIn, emotionsList, journalCount, heavyCount, resetsCount, journalSummaries = [] }) {
  const name = studentName || "friend";
  if (!GROQ_API_KEY) {
    return generateFallbackMuniLetter({ studentName: name, daysCheckedIn, emotionsList, journalCount, heavyCount, resetsCount, journalSummaries });
  }

  const emotionsSummary = emotionsList.length ? emotionsList.join(", ") : "quiet reflection";
  const summariesFormatted = journalSummaries.length
    ? journalSummaries.slice(0, 4).map((s) => "- " + s).join("\n")
    : "No detailed journal notes logged this week.";

  const prompt = `You are Muni, a warm, non-judgmental, compassionate AI mental health companion for university students in the Philippines.
Write a personalized 3-to-4 sentence weekly recap letter to student ${name}.
Here is their unique record for the past completed week:
- Check-ins: ${daysCheckedIn} out of 7 days
- Emotions logged: ${emotionsSummary}
- Journals written (${journalCount} total):
${summariesFormatted}
- Challenging moments flagged for gentle care: ${heavyCount}
- Mindful calming resets & exercises completed: ${resetsCount}

Rules:
- Address the student by their first name (${name}).
- Reference specific details from their week (like their logged emotions or specific journal reflection themes).
- Speak warmly and empathetically in natural English. No grading, scolding, or productivity pressure.
- Maximum 4 sentences.
- Output ONLY the letter text without quotation marks.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    const letter = data?.choices?.[0]?.message?.content?.trim();
    if (letter && letter.length > 20) {
      return letter.replace(/^["']|["']$/g, "").trim();
    }
  } catch (err) {
    console.warn("Groq letter generation fallback:", err?.message);
  }

  return generateFallbackMuniLetter({ studentName: name, daysCheckedIn, emotionsList, journalCount, heavyCount, resetsCount, journalSummaries });
}

function generateFallbackMuniLetter({ studentName, daysCheckedIn, emotionsList, journalCount, heavyCount, resetsCount, journalSummaries = [] }) {
  const name = studentName || "friend";
  const emotionPhrase = emotionsList.length
    ? `embracing feelings like ${emotionsList.slice(0, 2).join(" and ")}`
    : "giving yourself space to reflect";

  const themePhrase = journalSummaries.length > 0
    ? `taking time to write about ${journalSummaries[0]}`
    : "";

  if (heavyCount > 0 && resetsCount > 0) {
    const detail = themePhrase ? ` Through ${themePhrase}, you gave your feelings a safe outlet.` : "";
    return `Hello ${name}! Looking back at our week together, I see someone who faced challenging moments with courage and chose to pause rather than rush.${detail} By ${emotionPhrase} and completing mindful resets, you honored your rhythm. Remember that true strength is treating yourself with kindness along the way.`;
  }

  if (journalCount > 0 && themePhrase) {
    return `Hello ${name}! It was meaningful seeing you unpack your thoughts this week by ${themePhrase}. Showing up for ${emotionPhrase} without judgment is a quiet victory. Keep moving forward at your own gentle pace I'm always right here with you.`;
  }

  if (daysCheckedIn >= 3) {
    return `Hello ${name}! You dedicated ${daysCheckedIn} days this week to checking in with your mind and heart. Showing up for ${emotionPhrase} without pressure is a true act of self-care. Keep moving forward gently I'm always in your corner.`;
  }

  return `Hello ${name}! No matter how full or demanding the past seven days were, every quiet breath you took mattered. Wellness isn't about streaks or productivity it's knowing that your feelings are always welcome here under the stars. Take good care of yourself this coming week.`;
}

async function generateFocusSeedWithAI({ studentName, emotionsList, heavyCount, journalSummaries = [] }) {
  const name = studentName || "friend";
  if (!GROQ_API_KEY) {
    return generateFallbackFocusSeed({ heavyCount, emotionsList, journalSummaries });
  }

  const themes = journalSummaries.slice(0, 3).join("; ");
  const prompt = `You are Muni, a gentle mental wellness companion for university students in the Philippines.
Suggest a unique 1-sentence mindful intention or focus habit for student ${name} for next week.
Their week record:
- Emotions: ${emotionsList.join(", ") || "calm"}
- Journal reflections: ${themes || "routine studies"}
- Challenging moments: ${heavyCount > 0 ? "yes" : "none"}
Rules:
- Give a specific, actionable 1-sentence mindful intention tailored to their week.
- Maximum 25 words.
- Output ONLY the 1 sentence without quotes.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    const seed = data?.choices?.[0]?.message?.content?.trim();
    if (seed && seed.length > 10) {
      return seed.replace(/^["']|["']$/g, "").trim();
    }
  } catch (err) {
    console.warn("Groq focus seed fallback:", err?.message);
  }

  return generateFallbackFocusSeed({ heavyCount, emotionsList, journalSummaries });
}

function generateFallbackFocusSeed({ heavyCount, emotionsList, journalSummaries = [] }) {
  const themesStr = journalSummaries.join(" ").toLowerCase();
  if (themesStr.includes("sleep") || themesStr.includes("tired") || themesStr.includes("late")) {
    return "Protect a 15-minute quiet wind-down without screens before sleeping to restore your energy.";
  }
  if (themesStr.includes("exam") || themesStr.includes("deadline") || themesStr.includes("thesis") || heavyCount > 0) {
    return "Break your heaviest academic task into gentle 25-minute focus intervals with short breathers.";
  }
  if (emotionsList.includes("anxiety") || emotionsList.includes("sadness")) {
    return "When tasks feel crowded, step outside for fresh air and ground yourself in the present.";
  }
  if (emotionsList.includes("joy") || emotionsList.includes("contentment")) {
    return "Carry forward this week's peaceful rhythm by celebrating one small win each day.";
  }
  return "Pause for three deep breaths whenever transitioning between study sessions.";
}

router.get("/weekly", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }

  // 1. Calculate actual completed week (Sunday to Saturday)
  const recapWindow = getCompletedRecapWeek();
  const startIso = recapWindow.startIso;
  const endIso = recapWindow.endIso;
  const weekKey = req.query.week ? String(req.query.week).trim() : recapWindow.weekKey;

  try {
    // 1. Check existing record
    const existing = await query(
      `select *, start_date::text as start_date_str, end_date::text as end_date_str from public.student_weekly_recaps where student_number = $1 and week_key = $2 limit 1`,
      [studentNumber, weekKey]
    );

    const existingRow = existing.rows[0];
    const cachedDailyNodes = Array.isArray(existingRow?.daily_nodes) ? existingRow.daily_nodes : [];
    // Older cached recaps only stored the latest emotion per day and no per-day
    // check-in history. Regenerate those so the graph and story reflect the new
    // frequency-based representative emotion and the full daily history.
    const cacheHasCheckInHistory =
      cachedDailyNodes.length === 0 ||
      cachedDailyNodes.every((node) => Array.isArray(node?.checkIns));
    if (existingRow && existingRow.muni_letter && cachedDailyNodes.length && cacheHasCheckInHistory) {
      return res.json({
        ok: true,
        weekKey: existingRow.week_key,
        startIso: existingRow.start_date_str || formatManilaIso(existingRow.start_date) || startIso,
        endIso: existingRow.end_date_str || formatManilaIso(existingRow.end_date) || endIso,
        daysCheckedIn: existingRow.days_checked_in,
        totalJournals: existingRow.total_journals,
        heavyJournalsCount: existingRow.heavy_journals_count || 0,
        totalResets: existingRow.total_resets,
        totalTalaEarned: existingRow.total_tala_earned,
        talaBreakdown: existingRow.tala_breakdown || {},
        dailyNodes: cachedDailyNodes,
        emotionPalette: existingRow.emotion_palette || [],
        journalThemes: existingRow.journal_themes || [],
        mindfulResetsBreakdown: existingRow.mindful_resets_breakdown || [],
        muniLetter: existingRow.muni_letter,
        focusSeed: existingRow.focus_seed,
        focusSeedAdopted: Boolean(existingRow.focus_seed_adopted),
        focusSeedRewarded: Boolean(existingRow.focus_seed_rewarded),
        hasViewed: Boolean(existingRow.has_viewed),
      });
    }

    // 2. Fetch real data from DB for this 7-day window
    const [
      profileRes,
      checkinsRes,
      moodsRes,
      journalsRes,
      wellnessRewardsRes,
      taskProgressRes,
      libraryProgressRes,
      walletRes,
    ] = await Promise.all([
      query(
        `select full_name, nickname from public.student_profiles where student_number = $1 limit 1`,
        [studentNumber]
      ),
      query(
        `select check_in_date::text as check_in_date, cycle_day, base_reward, bonus_reward, total_reward
         from public.student_daily_checkins
         where student_number = $1 and check_in_date between $2 and $3
         order by check_in_date asc`,
        [studentNumber, startIso, endIso]
      ),
      query(
        `select id, mood_date::text as mood_date, mood_id, mood_label, created_at
         from public.student_moods
         where student_number = $1 and mood_date between $2 and $3
         order by created_at asc`,
        [studentNumber, startIso, endIso]
      ),
      query(
        `select id, title, summary, entry_date, risk_level, concern_tags, primary_concern, created_at
         from public.journal_entries
         where student_number = $1 and (entry_date between $2 and $3 or (created_at at time zone 'Asia/Manila')::date between $2 and $3)
           and deleted_by_student_at is null
           and purged_from_student_at is null
         order by created_at asc`,
        [studentNumber, startIso, endIso]
      ),
      query(
        `select activity_id, reward_tala, created_at
         from public.student_wellness_game_rewards
         where student_number = $1 and (created_at at time zone 'Asia/Manila')::date between $2 and $3`,
        [studentNumber, startIso, endIso]
      ),
      query(
        `select task_date::text as task_date, tasks_rewarded_count, daily_bonus_claimed, total_rewarded_tala
         from public.student_daily_task_progress
         where student_number = $1 and task_date between $2 and $3`,
        [studentNumber, startIso, endIso]
      ),
      query(
        `select count(*) as count from public.student_library_progress where student_number = $1 and status = 'COMPLETED'`,
        [studentNumber]
      ),
      query(
        `select total_tala from public.student_tala_wallets where student_number = $1 limit 1`,
        [studentNumber]
      ),
    ]);

    const studentName = profileRes.rows[0]?.nickname || profileRes.rows[0]?.full_name?.split(" ")[0] || "Student";

    const checkedInDates = new Set([
      ...checkinsRes.rows.map((r) => String(r.check_in_date || "").slice(0, 10)),
      ...moodsRes.rows.map((r) => String(r.mood_date || "").slice(0, 10)),
    ].filter(Boolean));

    const daysCheckedIn = checkedInDates.size;
    const totalJournals = journalsRes.rows.length;
    const heavyJournalsCount = journalsRes.rows.filter((j) => j.risk_level && j.risk_level !== "NONE").length;
    const totalResets = wellnessRewardsRes.rows.length;

    const checkinTala = checkinsRes.rows.reduce((sum, r) => sum + Number(r.total_reward || 0), 0);
    const journalTala = totalJournals * 15;
    const tasksTala = taskProgressRes.rows.reduce((sum, r) => sum + Number(r.total_rewarded_tala || 0), 0);
    const gameTala = wellnessRewardsRes.rows.reduce((sum, r) => sum + Number(r.reward_tala || 0), 0);
    const totalTalaEarned = checkinTala + journalTala + tasksTala + gameTala;

    // Generate true Sunday-to-Saturday 7-day nodes
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dailyNodes = [];
    const emotionCounts = {};

    const [sYear, sMonth, sDay] = startIso.split("-").map(Number);
    const weekStartObj = new Date(Date.UTC(sYear, sMonth - 1, sDay));

    for (let i = 0; i < 7; i++) {
      const currentDayDate = new Date(weekStartObj);
      currentDayDate.setUTCDate(weekStartObj.getUTCDate() + i);
      const dateStr = currentDayDate.toISOString().slice(0, 10);
      const dayNum = currentDayDate.getUTCDate();
      const dayName = weekdays[currentDayDate.getUTCDay()];
      const monthName = months[currentDayDate.getUTCMonth()];

      const dayMoods = moodsRes.rows.filter((m) => m.mood_date === dateStr);
      const moodId = resolveRepresentativeEmotion(dayMoods);
      const checkIns = dayMoods.map((m) => ({
        id: m.id,
        moodId: normalizeEmotionId(m.mood_id),
        moodLabel: getEmotionLabel(m.mood_id) || m.mood_label,
        createdAt: m.created_at,
      }));

      if (moodId) {
        emotionCounts[moodId] = (emotionCounts[moodId] || 0) + 1;
      }

      const dayJournals = journalsRes.rows.filter((j) => {
        const jd = j.entry_date || (j.created_at ? new Date(j.created_at).toISOString().slice(0, 10) : "");
        return jd === dateStr;
      });
      const hasHeavy = dayJournals.some((j) => j.risk_level && j.risk_level !== "NONE");
      const hasReset = wellnessRewardsRes.rows.some((w) => {
        const wd = new Date(w.created_at).toISOString().slice(0, 10);
        return wd === dateStr;
      });

      let notes = "";
      if (hasHeavy) {
        notes = "Challenging emotions surfaced. Muni soft-offered breathing and grounding support.";
      } else if (moodId) {
        const repLabel = getEmotionLabel(moodId) || moodId;
        notes = `Logged ${repLabel.toLowerCase()} on this day. Maintained mindful awareness.`;
      } else {
        notes = "Quiet day. No active reflections recorded.";
      }

      dailyNodes.push({
        dayName,
        dayNumber: dayNum,
        monthName,
        dateStr,
        moodId,
        checkIns,
        hasHeavyJournal: hasHeavy,
        hasReset,
        notes,
      });
    }

    const emotionPalette = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count }));

    // Extract true journal themes and summaries
    const journalSummaries = journalsRes.rows.map((j) => j.summary || j.title).filter(Boolean);
    const tagMap = {};
    journalsRes.rows.forEach((j) => {
      if (j.primary_concern) tagMap[j.primary_concern] = (tagMap[j.primary_concern] || 0) + 1;
      if (Array.isArray(j.concern_tags)) {
        j.concern_tags.forEach((t) => {
          tagMap[t] = (tagMap[t] || 0) + 1;
        });
      }
    });
    const journalThemes = Object.keys(tagMap);

    // Calculate real mindful resets breakdown
    const breathingCount = wellnessRewardsRes.rows.filter((r) => r.activity_id === "breathing" || r.activity_id === "wellness-breathing").length;
    const groundingCount = wellnessRewardsRes.rows.filter((r) => r.activity_id === "grounding" || r.activity_id === "wellness-grounding").length;
    const gameCount = wellnessRewardsRes.rows.filter((r) => !["breathing", "wellness-breathing", "grounding", "wellness-grounding"].includes(r.activity_id)).length;

    const mindfulResetsBreakdown = [
      { title: "Diaphragmatic Breathing", sessions: breathingCount, minutes: breathingCount * 4 },
      { title: "5-4-3-2-1 Grounding", sessions: groundingCount, minutes: groundingCount * 4 },
      { title: "Gentle Pairs & Words", games: gameCount, minutes: gameCount * 2 },
    ];

    const talaBreakdown = {
      checkins: checkinTala,
      journals: journalTala,
      tasks: tasksTala,
      resets: gameTala,
    };

    // Generate Muni AI Letter & Focus Seed
    const emotionsList = emotionPalette.map((e) => e.id);
    const [muniLetter, focusSeed] = await Promise.all([
      generateMuniLetterWithAI({
        studentName,
        daysCheckedIn,
        emotionsList,
        journalCount: totalJournals,
        heavyCount: heavyJournalsCount,
        resetsCount: totalResets,
        journalSummaries,
      }),
      generateFocusSeedWithAI({
        studentName,
        emotionsList,
        heavyCount: heavyJournalsCount,
        journalSummaries,
      }),
    ]);

    const hasViewed = existing.rows.length > 0 ? Boolean(existing.rows[0].has_viewed) : false;
    const focusSeedAdopted = existing.rows.length > 0 ? Boolean(existing.rows[0].focus_seed_adopted) : false;
    const focusSeedRewarded = existing.rows.length > 0 ? Boolean(existing.rows[0].focus_seed_rewarded) : false;

    // Upsert into student_weekly_recaps table
    await query(
      `insert into public.student_weekly_recaps (
         student_number, week_key, start_date, end_date,
         days_checked_in, total_journals, heavy_journals_count, total_resets, total_tala_earned,
         tala_breakdown, emotion_palette, daily_nodes, journal_themes, mindful_resets_breakdown,
         muni_letter, focus_seed, focus_seed_adopted, focus_seed_rewarded, has_viewed, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, $17, $18, $19, now())
       on conflict (student_number, week_key) do update
       set days_checked_in = excluded.days_checked_in,
           total_journals = excluded.total_journals,
           heavy_journals_count = excluded.heavy_journals_count,
           total_resets = excluded.total_resets,
           total_tala_earned = excluded.total_tala_earned,
           tala_breakdown = excluded.tala_breakdown,
           emotion_palette = excluded.emotion_palette,
           daily_nodes = excluded.daily_nodes,
           journal_themes = excluded.journal_themes,
           mindful_resets_breakdown = excluded.mindful_resets_breakdown,
           muni_letter = coalesce(public.student_weekly_recaps.muni_letter, excluded.muni_letter),
           focus_seed = coalesce(public.student_weekly_recaps.focus_seed, excluded.focus_seed),
           updated_at = now()`,
      [
        studentNumber,
        weekKey,
        startIso,
        endIso,
        daysCheckedIn,
        totalJournals,
        heavyJournalsCount,
        totalResets,
        totalTalaEarned,
        JSON.stringify(talaBreakdown),
        JSON.stringify(emotionPalette),
        JSON.stringify(dailyNodes),
        JSON.stringify(journalThemes),
        JSON.stringify(mindfulResetsBreakdown),
        muniLetter,
        focusSeed,
        focusSeedAdopted,
        focusSeedRewarded,
        hasViewed,
      ]
    );

    return res.json({
      ok: true,
      weekKey,
      startIso,
      endIso,
      daysCheckedIn,
      totalJournals,
      heavyJournalsCount,
      totalResets,
      totalTalaEarned,
      talaBreakdown,
      libraryReadCount: Number(libraryProgressRes.rows[0]?.count || 0),
      totalWalletTala: Number(walletRes.rows[0]?.total_tala || 0),
      dailyNodes,
      emotionPalette,
      journalThemes,
      mindfulResetsBreakdown,
      muniLetter,
      focusSeed,
      focusSeedAdopted,
      focusSeedRewarded,
      hasViewed,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load weekly recap." });
  }
});

/**
 * POST /api/recap/weekly/adopt-focus
 * Adopts Muni's focus seed intention and awards +15 Tala once
 */
router.post("/weekly/adopt-focus", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }

  const recapWindow = getCompletedRecapWeek();
  const weekKey = req.body?.week ? String(req.body.week).trim() : recapWindow.weekKey;

  try {
    const existing = await query(
      `select focus_seed_adopted, focus_seed_rewarded from public.student_weekly_recaps where student_number = $1 and week_key = $2 limit 1`,
      [studentNumber, weekKey]
    );

    if (existing.rows[0]?.focus_seed_adopted) {
      return res.json({
        ok: true,
        alreadyAdopted: true,
        rewardTala: 0,
        message: "You have already set this focus intention for next week.",
      });
    }

    const FOCUS_REWARD_TALA = 15;

    await query(
      `insert into public.student_tala_wallets (student_number, total_tala, updated_at)
       values ($1, $2, now())
       on conflict (student_number) do update
       set total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
           updated_at = now()`,
      [studentNumber, FOCUS_REWARD_TALA]
    );

    await query(
      `update public.student_weekly_recaps
       set focus_seed_adopted = true,
           focus_seed_rewarded = true,
           updated_at = now()
       where student_number = $1 and week_key = $2`,
      [studentNumber, weekKey]
    );

    const wallet = await query(
      `select total_tala from public.student_tala_wallets where student_number = $1 limit 1`,
      [studentNumber]
    );

    return res.json({
      ok: true,
      alreadyAdopted: false,
      rewardTala: FOCUS_REWARD_TALA,
      totalTala: Number(wallet.rows[0]?.total_tala || 0),
      message: "Focus intention set! +15 Tala added to your wallet.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not set focus intention." });
  }
});

/**
 * POST /api/recap/weekly/viewed
 * Marks the weekly recap as viewed in the cloud database
 */
router.post("/weekly/viewed", async (req, res) => {
  const studentNumber = String(resolveStudentNumber(req) || "").trim();
  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }

  const recapWindow = getCompletedRecapWeek();
  const weekKey = req.body?.week ? String(req.body.week).trim() : recapWindow.weekKey;

  try {
    await query(
      `update public.student_weekly_recaps
       set has_viewed = true,
           viewed_at = now(),
           updated_at = now()
       where student_number = $1 and week_key = $2`,
      [studentNumber, weekKey]
    );

    return res.json({ ok: true, weekKey, hasViewed: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not update viewed state." });
  }
});

module.exports = router;

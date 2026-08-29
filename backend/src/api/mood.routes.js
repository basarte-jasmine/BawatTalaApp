const express = require("express");
const {
  query,
  refreshStudentMoodIdConstraint,
  removeLegacyDailyMoodUniqueness,
} = require("../config/db");
const {
  EMOTION_LABELS,
  createEmotionCounts,
  getEmotionLabel,
  normalizeEmotionId,
} = require("../constants/emotions");

const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");
const router = express.Router();
router.use(requireStudentOnlyAuth);
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function resolveRequestStudentNumber(req) {
  return normalizeStudentNumber(resolveStudentNumber(req) || "");
}

function normalizeMoodId(value) {
  return normalizeEmotionId(value);
}

function normalizeMoodDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return raw;
}

function normalizeMoodSource(value) {
  const source = String(value || "").trim().toUpperCase();
  return source === "JOURNAL" ? "JOURNAL" : "INPUT";
}

function formatMoodSourceValue(value) {
  return normalizeMoodSource(value);
}

function getCurrentManilaMoodDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMoodDateValue(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value || "1970";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw;
}

async function insertMoodCheckIn(studentNumber, moodId, moodDate, moodSource) {
  return query(
    `
      insert into public.student_moods (
        student_number,
        mood_id,
        mood_label,
        mood_date,
        mood_source
      )
      values ($1, $2, $3, $4::date, $5)
      returning id, mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date, mood_source, created_at
    `,
    [studentNumber, moodId, getEmotionLabel(moodId), moodDate, moodSource],
  );
}

router.get("/month", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Valid year and month are required." });
  }

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

  try {
    const result = await query(
      `
        select id, mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date, mood_source, created_at
        from public.student_moods
        where student_number = $1
          and mood_date >= $2::date
          and mood_date < $3::date
        order by mood_date asc, created_at asc
      `,
      [studentNumber, monthStart, nextMonth],
    );

    const counts = createEmotionCounts();

    const entries = result.rows.map((row) => {
      const moodId = normalizeMoodId(row.mood_id);
      if (Object.prototype.hasOwnProperty.call(counts, moodId)) {
        counts[moodId] += 1;
      }

      return {
        id: row.id,
        createdAt: row.created_at,
        moodId,
        moodLabel: getEmotionLabel(moodId) || row.mood_label,
        moodDate: formatMoodDateValue(row.mood_date),
        moodSource: formatMoodSourceValue(row.mood_source),
      };
    });

    const totalCheckIns = entries.length;
    const mostCommonMoodId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const mostCommonMoodCount = mostCommonMoodId ? counts[mostCommonMoodId] : 0;

    return res.json({
      entries,
      counts,
      totalCheckIns,
      mostCommonMoodId: mostCommonMoodCount > 0 ? mostCommonMoodId : null,
      mostCommonMoodLabel: mostCommonMoodCount > 0 ? EMOTION_LABELS[mostCommonMoodId] : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch emotion entries." });
  }
});

router.get("/today", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const moodDate = normalizeMoodDate(req.query.moodDate || "") || getCurrentManilaMoodDate();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !moodDate) {
    return res.status(400).json({ message: "Valid student number and emotion date are required." });
  }

  try {
    const result = await query(
      `
        select id, mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date, mood_source, created_at
        from public.student_moods
        where student_number = $1
          and mood_date = $2::date
        order by created_at desc
      `,
      [studentNumber, moodDate],
    );

    const entries = result.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      moodId: normalizeMoodId(row.mood_id),
      moodLabel: getEmotionLabel(row.mood_id) || row.mood_label,
      moodDate: formatMoodDateValue(row.mood_date),
      moodSource: formatMoodSourceValue(row.mood_source),
    }));
    const row = entries[0];
    return res.json({
      entry: row || null,
      entries,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch today's emotion." });
  }
});

router.post("/", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const moodId = normalizeMoodId(req.body.moodId || "");
  const moodDate = normalizeMoodDate(req.body.moodDate || "") || getCurrentManilaMoodDate();
  const moodSource = normalizeMoodSource(req.body.moodSource || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!EMOTION_LABELS[moodId]) {
    return res.status(400).json({ message: "Valid emotion is required." });
  }
  if (!moodDate) {
    return res.status(400).json({ message: "Valid emotion date is required." });
  }

  try {
    let result;
    try {
      result = await insertMoodCheckIn(studentNumber, moodId, moodDate, moodSource);
    } catch (error) {
      if (error?.code === "23505") {
        await removeLegacyDailyMoodUniqueness();
        result = await insertMoodCheckIn(studentNumber, moodId, moodDate, moodSource);
      } else if (error?.code === "23514" && error?.constraint === "student_moods_mood_id_check") {
        await refreshStudentMoodIdConstraint();
        result = await insertMoodCheckIn(studentNumber, moodId, moodDate, moodSource);
      } else {
        throw error;
      }
    }

    const row = result.rows[0];
    return res.json({
      entry: {
        id: row.id,
        createdAt: row.created_at,
        moodId: normalizeMoodId(row.mood_id),
        moodLabel: getEmotionLabel(row.mood_id) || row.mood_label,
        moodDate: formatMoodDateValue(row.mood_date),
        moodSource: formatMoodSourceValue(row.mood_source),
      },
      message: "Emotion saved.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save emotion." });
  }
});

module.exports = router;

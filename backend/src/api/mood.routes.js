const express = require("express");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const MOOD_LABELS = {
  happy: "Happy",
  calm: "Calm",
  sad: "Sad",
  stressed: "Stressed",
  angry: "Angry",
  anxious: "Anxious",
};

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function normalizeMoodId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMoodDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return raw;
}

function getCurrentManilaMoodDate() {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const manilaDate = new Date(utcTime + 8 * 60 * 60 * 1000);
  const year = manilaDate.getUTCFullYear();
  const month = manilaDate.getUTCMonth() + 1;
  const day = manilaDate.getUTCDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMoodDateValue(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw;
}

router.get("/month", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");
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
        select mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date
        from public.student_moods
        where student_number = $1
          and mood_date >= $2::date
          and mood_date < $3::date
        order by mood_date asc
      `,
      [studentNumber, monthStart, nextMonth],
    );

    const counts = {
      happy: 0,
      calm: 0,
      sad: 0,
      stressed: 0,
      angry: 0,
      anxious: 0,
    };

    const entries = result.rows.map((row) => {
      const moodId = normalizeMoodId(row.mood_id);
      if (Object.prototype.hasOwnProperty.call(counts, moodId)) {
        counts[moodId] += 1;
      }

      return {
        moodId,
        moodLabel: row.mood_label,
        moodDate: formatMoodDateValue(row.mood_date),
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
      mostCommonMoodLabel: mostCommonMoodCount > 0 ? MOOD_LABELS[mostCommonMoodId] : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch mood entries." });
  }
});

router.get("/today", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");
  const moodDate = normalizeMoodDate(req.query.moodDate || "") || getCurrentManilaMoodDate();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !moodDate) {
    return res.status(400).json({ message: "Valid student number and mood date are required." });
  }

  try {
    const result = await query(
      `
        select mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date
        from public.student_moods
        where student_number = $1
          and mood_date = $2::date
        limit 1
      `,
      [studentNumber, moodDate],
    );

    const row = result.rows[0];
    return res.json({
      entry: row
        ? {
            moodId: normalizeMoodId(row.mood_id),
            moodLabel: row.mood_label,
            moodDate: formatMoodDateValue(row.mood_date),
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch today's mood." });
  }
});

router.post("/", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const moodId = normalizeMoodId(req.body.moodId || "");
  const moodDate = normalizeMoodDate(req.body.moodDate || "") || getCurrentManilaMoodDate();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!MOOD_LABELS[moodId]) {
    return res.status(400).json({ message: "Valid mood is required." });
  }
  if (!moodDate) {
    return res.status(400).json({ message: "Valid mood date is required." });
  }

  try {
    const result = await query(
      `
        insert into public.student_moods (
          student_number,
          mood_id,
          mood_label,
          mood_date,
          updated_at
        )
        values ($1, $2, $3, $4::date, now())
        on conflict (student_number, mood_date)
        do update set
          mood_id = excluded.mood_id,
          mood_label = excluded.mood_label,
          updated_at = now()
        returning mood_id, mood_label, to_char(mood_date, 'YYYY-MM-DD') as mood_date
      `,
      [studentNumber, moodId, MOOD_LABELS[moodId], moodDate],
    );

    const row = result.rows[0];
    return res.json({
      entry: {
        moodId: normalizeMoodId(row.mood_id),
        moodLabel: row.mood_label,
        moodDate: formatMoodDateValue(row.mood_date),
      },
      message: "Mood saved.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save mood." });
  }
});

module.exports = router;

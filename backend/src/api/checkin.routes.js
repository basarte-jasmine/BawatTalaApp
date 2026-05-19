const express = require("express");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const DAILY_REWARDS = [10, 20, 30, 50, 70, 100, 150];
const BONUS_REWARDS = [50, 100];

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function getCurrentManilaDateParts() {
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

  return {
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function getDayDiff(previousDate, nextDate) {
  const previous = new Date(`${previousDate}T00:00:00Z`);
  const next = new Date(`${nextDate}T00:00:00Z`);
  return Math.round((next.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function pickBonusReward() {
  return BONUS_REWARDS[Math.floor(Math.random() * BONUS_REWARDS.length)];
}

function getNextCycleProgress(latestCycleDay) {
  if (latestCycleDay >= DAILY_REWARDS.length) {
    return {
      activeDay: 1,
      completedDays: 0,
    };
  }

  return {
    activeDay: latestCycleDay + 1,
    completedDays: latestCycleDay,
  };
}

async function getLatestCheckIn(studentNumber) {
  const result = await query(
    `
      select to_char(check_in_date, 'YYYY-MM-DD') as check_in_date, cycle_day, total_reward, bonus_reward
      from public.student_daily_checkins
      where student_number = $1
      order by check_in_date desc
      limit 1
    `,
    [studentNumber],
  );

  return result.rows[0] || null;
}

async function getCheckInByDate(studentNumber, checkInDate) {
  const result = await query(
    `
      select to_char(check_in_date, 'YYYY-MM-DD') as check_in_date, cycle_day, total_reward, bonus_reward
      from public.student_daily_checkins
      where student_number = $1
        and check_in_date = $2::date
      limit 1
    `,
    [studentNumber, checkInDate],
  );

  return result.rows[0] || null;
}

async function getLatestCheckInBefore(studentNumber, checkInDate) {
  const result = await query(
    `
      select to_char(check_in_date, 'YYYY-MM-DD') as check_in_date, cycle_day, total_reward, bonus_reward
      from public.student_daily_checkins
      where student_number = $1
        and check_in_date < $2::date
      order by check_in_date desc
      limit 1
    `,
    [studentNumber, checkInDate],
  );

  return result.rows[0] || null;
}

async function getWalletTotal(studentNumber) {
  const result = await query(
    `
      select total_tala
      from public.student_tala_wallets
      where student_number = $1
      limit 1
    `,
    [studentNumber],
  );

  return Number(result.rows[0]?.total_tala || 0);
}

async function buildStatus(studentNumber) {
  const today = getCurrentManilaDateParts().isoDate;
  const latest = await getLatestCheckIn(studentNumber);
  const totalTala = await getWalletTotal(studentNumber);

  if (!latest) {
    return {
      activeDay: 1,
      completedDays: 0,
      todayCheckedIn: false,
      totalTala,
    };
  }

  const latestDate = String(latest.check_in_date || "");
  const latestCycleDay = Number(latest.cycle_day || 0);
  const dayDiff = getDayDiff(latestDate, today);

  if (dayDiff === 0) {
    return {
      activeDay: latestCycleDay >= 7 ? 1 : latestCycleDay + 1,
      completedDays: latestCycleDay,
      todayCheckedIn: true,
      todayReward: Number(latest.total_reward || 0),
      todayBonusReward: Number(latest.bonus_reward || 0),
      totalTala,
    };
  }

  if (dayDiff > 0) {
    return {
      ...getNextCycleProgress(latestCycleDay),
      todayCheckedIn: false,
      totalTala,
    };
  }

  return {
    ...getNextCycleProgress(latestCycleDay),
    todayCheckedIn: false,
    totalTala,
  };
}

router.get("/status", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  try {
    const status = await buildStatus(studentNumber);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch check-in status." });
  }
});

router.post("/", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  const today = getCurrentManilaDateParts().isoDate;
  const requestedCheckInDate = normalizeCompactSpaces(req.body.checkInDate || today);

  if (!isValidIsoDate(requestedCheckInDate)) {
    return res.status(400).json({ message: "Valid check-in date is required." });
  }

  if (getDayDiff(today, requestedCheckInDate) > 0) {
    return res.status(400).json({ message: "Future check-ins cannot be claimed." });
  }

  try {
    const existingCheckIn = await getCheckInByDate(studentNumber, requestedCheckInDate);

    if (existingCheckIn) {
      const status = await buildStatus(studentNumber);
      return res.status(409).json({
        ...status,
        message:
          requestedCheckInDate === today
            ? "Today's check-in has already been claimed."
            : "This check-in date has already been claimed.",
      });
    }

    let cycleDay = 1;
    const latest = await getLatestCheckInBefore(studentNumber, requestedCheckInDate);
    if (latest) {
      const latestCycleDay = Number(latest.cycle_day || 0);
      cycleDay = getNextCycleProgress(latestCycleDay).activeDay;
    }

    const baseReward = DAILY_REWARDS[cycleDay - 1];
    const bonusReward = cycleDay === 7 ? pickBonusReward() : 0;
    const totalReward = baseReward + bonusReward;

    await query(
      `
        insert into public.student_daily_checkins (
          student_number,
          check_in_date,
          cycle_day,
          base_reward,
          bonus_reward,
          total_reward,
          updated_at
        )
        values ($1, $2::date, $3, $4, $5, $6, now())
      `,
      [studentNumber, requestedCheckInDate, cycleDay, baseReward, bonusReward, totalReward],
    );

    await query(
      `
        insert into public.student_tala_wallets (
          student_number,
          total_tala,
          updated_at
        )
        values ($1, $2, now())
        on conflict (student_number)
        do update set
          total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
          updated_at = now()
      `,
      [studentNumber, totalReward],
    );

    const status = await buildStatus(studentNumber);
    return res.json({
      ...status,
      baseReward,
      bonusReward,
      totalReward,
      message: "Check-in claimed.",
    });
  } catch (error) {
    if (error?.code === "23505") {
      const status = await buildStatus(studentNumber);
      return res.status(409).json({
        ...status,
        message:
          requestedCheckInDate === today
            ? "Today's check-in has already been claimed."
            : "This check-in date has already been claimed.",
      });
    }

    return res.status(500).json({ message: error.message || "Failed to claim daily check-in." });
  }
});

module.exports = router;

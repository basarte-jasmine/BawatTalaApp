const express = require("express");
const crypto = require("crypto");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireStudentOnlyAuth);

const MAX_REWARDED_TASKS_PER_DAY = 3; // 3 tasks * 10 Tala = 30 Tala
const TASK_REWARD_TALA = 10;
const DAILY_COMPLETE_BONUS_TALA = 20; // 30 + 20 = exactly 50 Tala
const MAX_DAILY_TALA = 50;

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

function getManilaDateString() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

async function getOrCreateProgress(studentNumber, taskDate) {
  const existing = await query(
    `select * from public.student_daily_task_progress where student_number = $1 and task_date = $2 limit 1`,
    [studentNumber, taskDate]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await query(
    `insert into public.student_daily_task_progress (
       student_number, task_date, tasks_rewarded_count, daily_bonus_claimed, total_rewarded_tala
     ) values ($1, $2, 0, false, 0)
     on conflict (student_number, task_date) do update
     set updated_at = now()
     returning *`,
    [studentNumber, taskDate]
  );
  return inserted.rows[0];
}

/**
 * GET /api/tasks
 * Fetches today's tasks and reward progress
 */
router.get("/", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }

  const taskDate = getManilaDateString();
  try {
    const tasksResult = await query(
      `select id, student_number, task_date, title, is_gentle, completed, completed_at, rewarded, created_at, updated_at
       from public.student_daily_tasks
       where student_number = $1 and task_date = $2
       order by completed asc, created_at asc`,
      [studentNumber, taskDate]
    );

    const progress = await getOrCreateProgress(studentNumber, taskDate);
    const tasks = tasksResult.rows;
    const completedCount = tasks.filter((t) => t.completed).length;
    const allTasksDone = tasks.length > 0 && completedCount === tasks.length;

    return res.json({
      date: taskDate,
      tasks,
      progress: {
        tasksRewardedCount: Number(progress.tasks_rewarded_count || 0),
        dailyBonusClaimed: Boolean(progress.daily_bonus_claimed),
        totalRewardedTala: Number(progress.total_rewarded_tala || 0),
        maxDailyTala: MAX_DAILY_TALA,
        allTasksDone,
        completedCount,
        totalTasks: tasks.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not load tasks." });
  }
});

/**
 * POST /api/tasks
 * Add a new task for today
 */
router.post("/", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const title = normalizeCompactSpaces(req.body.title);
  const isGentle = Boolean(req.body.isGentle);
  const clientTaskId = String(req.body.id || "").trim() || crypto.randomUUID();

  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }
  if (!title) {
    return res.status(400).json({ message: "Task title cannot be empty." });
  }

  const taskDate = getManilaDateString();
  try {
    const result = await query(
      `insert into public.student_daily_tasks (
         id, student_number, task_date, title, is_gentle, completed, rewarded, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, false, false, now(), now())
       on conflict (id) do update set title = excluded.title, is_gentle = excluded.is_gentle, updated_at = now()
       returning id, student_number, task_date, title, is_gentle, completed, completed_at, rewarded, created_at, updated_at`,
      [clientTaskId, studentNumber, taskDate, title.slice(0, 200), isGentle]
    );

    return res.status(201).json({
      ok: true,
      task: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save task." });
  }
});

/**
 * PATCH /api/tasks/:id/toggle
 * Toggle completed status and calculate rewards
 */
router.patch("/:id/toggle", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const taskId = String(req.params.id || "").trim();
  const requestedCompleted = typeof req.body.completed === "boolean" ? req.body.completed : null;

  if (!/^\d{2}-\d{4}$/.test(studentNumber) || !taskId) {
    return res.status(400).json({ message: "Valid student and task ID required." });
  }

  const taskDate = getManilaDateString();
  try {
    const existingResult = await query(
      `select * from public.student_daily_tasks where id = $1 and student_number = $2 limit 1`,
      [taskId, studentNumber]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    const currentTask = existingResult.rows[0];
    const nextCompleted = requestedCompleted !== null ? requestedCompleted : !currentTask.completed;

    let rewardTala = 0;
    let bonusClaimed = false;
    let nextRewarded = currentTask.rewarded;

    if (nextCompleted) {
      const progress = await getOrCreateProgress(studentNumber, taskDate);
      let rewardedCount = Number(progress.tasks_rewarded_count || 0);
      let dailyBonusClaimed = Boolean(progress.daily_bonus_claimed);
      let currentTotalTala = Number(progress.total_rewarded_tala || 0);

      // Rule 1: 10 Tala per task up to 3 tasks
      if (!currentTask.rewarded && rewardedCount < MAX_REWARDED_TASKS_PER_DAY) {
        rewardTala += TASK_REWARD_TALA;
        rewardedCount += 1;
        nextRewarded = true;
      }

      // Rule 2: 20 Tala "Daily Complete" bonus if all planned tasks are done (and at least 3 tasks completed total)
      const allTodayTasksRes = await query(
        `select id, completed from public.student_daily_tasks where student_number = $1 and task_date = $2`,
        [studentNumber, taskDate]
      );
      const allTasks = allTodayTasksRes.rows;
      const allWillBeCompleted = allTasks.every((t) => (t.id === taskId ? true : t.completed));

      if (!dailyBonusClaimed && allWillBeCompleted && (rewardedCount >= MAX_REWARDED_TASKS_PER_DAY || allTasks.length >= 3)) {
        rewardTala += DAILY_COMPLETE_BONUS_TALA;
        dailyBonusClaimed = true;
        bonusClaimed = true;
      }

      // Safety cap at 50 Tala
      const potentialTotal = currentTotalTala + rewardTala;
      if (potentialTotal > MAX_DAILY_TALA) {
        rewardTala = Math.max(0, MAX_DAILY_TALA - currentTotalTala);
      }
      const newTotalRewarded = currentTotalTala + rewardTala;

      // Update progress record
      await query(
        `update public.student_daily_task_progress
         set tasks_rewarded_count = $1,
             daily_bonus_claimed = $2,
             total_rewarded_tala = $3,
             updated_at = now()
         where student_number = $4 and task_date = $5`,
        [rewardedCount, dailyBonusClaimed, newTotalRewarded, studentNumber, taskDate]
      );
    }

    // Update task row
    const updatedTaskRes = await query(
      `update public.student_daily_tasks
       set completed = $1,
           completed_at = case when $1 then now() else null end,
           rewarded = $2,
           updated_at = now()
       where id = $3 and student_number = $4
       returning id, student_number, task_date, title, is_gentle, completed, completed_at, rewarded, created_at, updated_at`,
      [nextCompleted, nextRewarded, taskId, studentNumber]
    );

    let totalWalletTala = 0;
    if (rewardTala > 0) {
      const wallet = await query(
        `insert into public.student_tala_wallets (student_number, total_tala, updated_at)
         values ($1, $2, now())
         on conflict (student_number) do update
         set total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
             updated_at = now()
         returning total_tala`,
        [studentNumber, rewardTala]
      );
      totalWalletTala = Number(wallet.rows[0]?.total_tala || 0);

      // Send notification for celebratory milestones
      if (bonusClaimed) {
        await query(
          `insert into public.student_notifications (student_number, kind, title, message, metadata)
           values ($1, 'DAILY_TASKS_COMPLETE', $2, $3, $4::jsonb)`,
          [
            studentNumber,
            "Araw ng Tagumpay! ✨",
            `Natapos mo ang lahat ng iyong mga hakbang ngayong araw! Nakatanggap ka ng +${DAILY_COMPLETE_BONUS_TALA} Tala bonus.`,
            JSON.stringify({ rewardTala, bonusClaimed: true, taskDate }),
          ]
        );
      }
    } else {
      const wallet = await query(
        `select total_tala from public.student_tala_wallets where student_number = $1 limit 1`,
        [studentNumber]
      );
      totalWalletTala = Number(wallet.rows[0]?.total_tala || 0);
    }

    return res.json({
      ok: true,
      task: updatedTaskRes.rows[0],
      rewardTala,
      bonusClaimed,
      totalTala: totalWalletTala,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not update task." });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete("/:id", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const taskId = String(req.params.id || "").trim();

  if (!/^\d{2}-\d{4}$/.test(studentNumber) || !taskId) {
    return res.status(400).json({ message: "Valid student and task ID required." });
  }

  try {
    const existing = await query(
      `select completed from public.student_daily_tasks where id = $1 and student_number = $2 limit 1`,
      [taskId, studentNumber]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Task not found." });
    }
    if (existing.rows[0].completed) {
      return res.status(400).json({ message: "Completed tasks cannot be deleted." });
    }

    await query(
      `delete from public.student_daily_tasks where id = $1 and student_number = $2`,
      [taskId, studentNumber]
    );
    return res.json({ ok: true, id: taskId });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete task." });
  }
});

/**
 * GET /api/tasks/reflection
 * Prepares a mindful reflection prompt connecting today's completed tasks to the journal
 */
router.get("/reflection", async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!/^\d{2}-\d{4}$/.test(studentNumber)) {
    return res.status(400).json({ message: "A valid student number is required." });
  }

  const taskDate = getManilaDateString();
  try {
    const tasksResult = await query(
      `select title, completed, is_gentle from public.student_daily_tasks
       where student_number = $1 and task_date = $2 and completed = true
       order by completed_at asc`,
      [studentNumber, taskDate]
    );

    const completedTasks = tasksResult.rows;
    if (completedTasks.length === 0) {
      return res.json({
        hasCompletedTasks: false,
        prompt: "Ngayong araw, nais kong pagnilayan ang aking mga ginawa at kung paano ko inalagaan ang aking sarili.",
      });
    }

    const taskBulletPoints = completedTasks.map((t) => `• ${t.title}`).join("\n");
    const prompt = `Ngayong araw, ito ang mga munting tala at hakbang na natapos ko:\n${taskBulletPoints}\n\nKamusta ang pakiramdam ko habang ginagawa ang mga ito? Ano ang isang bagay na ipinagpapasalamat ko sa aking sarili ngayon?`;

    return res.json({
      hasCompletedTasks: true,
      completedCount: completedTasks.length,
      prompt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not generate reflection." });
  }
});

module.exports = router;


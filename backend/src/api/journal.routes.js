const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");
const { supabaseAdminClient } = require("../config/supabase");
const { analyzeJournalConversation, analyzeJournalEntryFinal } = require("../services/journal-ai.service");
const {
  JOURNAL_TAG_OPTIONS,
  inferJournalTagsFromText,
  normalizeJournalTag,
  normalizeJournalTags,
  resolveJournalEntryTags,
} = require("../constants/journal-tags");

const router = express.Router();
router.use(requireStudentOnlyAuth);
const JOURNAL_MAX_WORDS = 1000;

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeStudentNumber(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

function resolveRequestStudentNumber(req) {
  return normalizeStudentNumber(resolveStudentNumber(req) || "");
}

function getManilaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return {
    day: Number(day),
    isoDate: `${year}-${month}-${day}`,
    month: Number(month),
    year: Number(year),
  };
}

function formatEntryDateLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildEntryTitle(messageText) {
  const words = String(messageText || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);
  return words.join(" ");
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeVoiceSessionMessages(value) {
  if (!Array.isArray(value)) return null;

  return value
    .slice(0, 100)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "",
      text: String(item?.text || "").trim().slice(0, 12000),
    }))
    .filter((item) => item.role && item.text);
}

function summarizeJournalMessages(messages) {
  const text = buildEntryContentText(messages)
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const excerpt = text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
  return `This entry reflects: ${excerpt}`;
}

function normalizeConcernValue(value) {
  return normalizeJournalTag(value);
}

function normalizeConcernTags(value) {
  return normalizeJournalTags(value);
}

function normalizeSummaryRating(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "HELPFUL" || normalized === "NEEDS_WORK") {
    return normalized;
  }
  return "";
}

function normalizeSummaryFeedbackReason(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getStudentProfile(studentNumber) {
  const { data } = await supabaseAdminClient
    .from("student_profiles")
    .select("full_name,email")
    .eq("student_number", studentNumber)
    .maybeSingle();

  return {
    email: data?.email || "",
    fullName: data?.full_name || "",
    firstName: String(data?.full_name || "").trim().split(/\s+/)[0] || "Student",
  };
}

async function getOpenEntryByStudentAndDate(studentNumber, entryDate) {
  const result = await query(
    `
      select id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
             sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
             insights, risk_level, admin_flag_reason,
             primary_concern, concern_tags,
             ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
             created_at, updated_at
      from public.journal_entries
      where student_number = $1 and entry_date = $2 and is_finished = false and deleted_by_student_at is null
      order by created_at desc
      limit 1
    `,
    [studentNumber, entryDate],
  );

  return result.rows[0] || null;
}

async function createEntry(studentNumber, entryDate, aiEnabled) {
  const result = await query(
    `
      insert into public.journal_entries (student_number, entry_date, ai_enabled)
      values ($1, $2, $3)
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [studentNumber, entryDate, aiEnabled],
  );

  return result.rows[0];
}

async function listEntryMessages(entryId) {
  const result = await query(
    `
      select id, role, message_text, created_at
      from public.journal_entry_messages
      where entry_id = $1
      order by created_at asc, id asc
    `,
    [entryId],
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    role: row.role,
    text: row.message_text,
  }));
}

async function replaceEntryMessagesFromTranscript({ entryId, studentNumber, messages }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return;
  }

  await query(
    `
      with deleted as (
        delete from public.journal_entry_messages
        where entry_id = $1 and student_number = $2
        returning id
      )
      insert into public.journal_entry_messages (entry_id, student_number, role, message_text, created_at)
      select $1, $2, item->>'role', item->>'text', now() - interval '1 second' + ((turn_order - 1) * interval '1 millisecond')
      from jsonb_array_elements($3::jsonb) with ordinality as transcript(item, turn_order)
      cross join (select count(*) from deleted) deletion
      order by turn_order
    `,
    [entryId, studentNumber, JSON.stringify(messages)],
  );
}

async function getEntryById(studentNumber, entryId) {
  const result = await query(
    `
      select id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
             sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
             insights, risk_level, admin_flag_reason,
             primary_concern, concern_tags,
             ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
             created_at, updated_at
      from public.journal_entries
      where id = $1 and student_number = $2 and deleted_by_student_at is null
      limit 1
    `,
    [entryId, studentNumber],
  );

  return result.rows[0] || null;
}

function mapEntryRow(row) {
  const concernTags = resolveJournalEntryTags(row);
  return {
    adminFlagReason: row.admin_flag_reason || null,
    aiEnabled: Boolean(row.ai_enabled),
    concernTags,
    createdAt: row.created_at,
    entryDate: formatEntryDateLabel(row.entry_date),
    finishedAt: row.finished_at || null,
    id: row.id,
    insights: Array.isArray(row.insights) ? row.insights : [],
    isFinished: Boolean(row.is_finished),
    primaryConcern: normalizeConcernValue(row.primary_concern) || concernTags[0] || null,
    riskLevel: String(row.risk_level || "NONE"),
    dominantEmotion: row.dominant_emotion || null,
    sentimentConfidence: row.sentiment_confidence == null ? null : Number(row.sentiment_confidence),
    sentimentLabel: row.sentiment_label || null,
    sentimentScore: row.sentiment_score == null ? null : Number(row.sentiment_score),
    summary: row.summary || "",
    summaryFeedbackReason: row.summary_feedback_reason || null,
    summaryRatedAt: row.summary_rated_at || null,
    summaryRating: row.summary_rating || null,
    supportPromptShownAt: row.support_prompt_shown_at || null,
    supportResponse: row.support_response || null,
    supportResponseAt: row.support_response_at || null,
    title: row.title || "",
    updatedAt: row.updated_at,
  };
}

function buildEntryContentText(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((item) => item.role === "user")
    .map((item) => String(item.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

async function removeOrSoftDeleteEntry({ studentNumber, entryId, requireOpen }) {
  const entryLookup = await query(
    `
      select id, risk_level, is_finished
      from public.journal_entries
      where id = $1 and student_number = $2
      limit 1
    `,
    [entryId, studentNumber],
  );

  const entry = entryLookup.rows[0] || null;
  if (!entry) {
    return { found: false, removed: false, softDeleted: false };
  }

  if (requireOpen && entry.is_finished) {
    return { found: true, removed: false, softDeleted: false, invalidState: true };
  }

  if (String(entry.risk_level || "").toUpperCase() === "HIGH") {
    const result = await query(
      `
        update public.journal_entries
        set deleted_by_student_at = now(), updated_at = now()
        where id = $1 and student_number = $2 and deleted_by_student_at is null
        returning id
      `,
      [entryId, studentNumber],
    );

    return {
      found: true,
      removed: result.rowCount > 0,
      softDeleted: result.rowCount > 0,
    };
  }

  const deleteResult = await query(
    `
      delete from public.journal_entries
      where id = $1 and student_number = $2
      returning id
    `,
    [entryId, studentNumber],
  );

  return {
    found: true,
    removed: deleteResult.rowCount > 0,
    softDeleted: false,
  };
}

async function cleanupStaleEmptyDrafts(studentNumber) {
  if (!studentNumber) {
    return 0;
  }

  const result = await query(
    `
      delete from public.journal_entries je
      where je.student_number = $1
        and je.is_finished = false
        and je.created_at < now() - interval '2 hours'
        and not exists (
          select 1
          from public.journal_entry_messages jem
          where jem.entry_id = je.id
          limit 1
        )
      returning je.id
    `,
    [studentNumber],
  );

  return result.rowCount || 0;
}

function buildVisibleEntriesWhereClause(alias = "je") {
  return `
    ${alias}.deleted_by_student_at is null
    and ${alias}.is_finished = true
  `;
}

router.get("/entries/recent", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const windowDays = Math.max(1, Math.min(30, Number(req.query.windowDays || 20)));
  const requestedLimit = Number(req.query.limit);
  const entryLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(50, Math.trunc(requestedLimit)))
    : 20;
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  await cleanupStaleEmptyDrafts(studentNumber);

  const today = getManilaDateParts();
  const monthStart = `${today.year}-${String(today.month).padStart(2, "0")}-01`;
  const nextMonthYear = today.month === 12 ? today.year + 1 : today.year;
  const nextMonth = today.month === 12 ? 1 : today.month + 1;
  const nextMonthStart = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const windowStartResult = await query(
    `
      select ($1::date - ($2::int - 1))::date as start_date
    `,
    [today.isoDate, windowDays],
  );
  const windowStart = formatEntryDateLabel(windowStartResult.rows[0]?.start_date);

  const [entriesResult, progressResult] = await Promise.all([
    query(
      `
        select je.id, je.entry_date, je.created_at, je.summary, je.title,
               je.is_finished,
               coalesce(last_user.message_text, '') as preview
        from public.journal_entries je
        left join lateral (
          select jem.message_text
          from public.journal_entry_messages jem
          where jem.entry_id = je.id and jem.role = 'user'
          order by jem.created_at desc, jem.id desc
          limit 1
        ) last_user on true
        where je.student_number = $1
          and je.entry_date >= $2::date
          and ${buildVisibleEntriesWhereClause("je")}
        order by je.entry_date desc, je.created_at desc
        limit $3
      `,
      [studentNumber, windowStart, entryLimit],
    ),
    query(
      `
        select
          count(*) filter (
            where entry_date = $2
              and ${buildVisibleEntriesWhereClause("public.journal_entries")}
          )::int as today_count,
          count(*) filter (
            where entry_date >= $3
              and entry_date < $4
              and ${buildVisibleEntriesWhereClause("public.journal_entries")}
          )::int as monthly_count,
          count(*)::int as total_count
        from public.journal_entries
        where student_number = $1
          and ${buildVisibleEntriesWhereClause("public.journal_entries")}
      `,
      [studentNumber, today.isoDate, monthStart, nextMonthStart],
    ),
  ]);

  const progressRow = progressResult.rows[0] || {};
  const totalCount = Number(progressRow.total_count || 0);

  return res.json({
    entries: entriesResult.rows.map((row) => ({
      createdAt: row.created_at,
      entryDate: formatEntryDateLabel(row.entry_date),
      id: row.id,
      isFinished: Boolean(row.is_finished),
      preview: row.preview || "",
      summary: row.summary || "",
      title: row.title || "",
    })),
    progress: {
      monthlyCount: Number(progressRow.monthly_count || 0),
      todayCount: Number(progressRow.today_count || 0),
      totalCount,
    },
    totalCount,
  });
}));

router.get("/entries/by-date", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryDate = formatEntryDateLabel(req.query.date);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryDate) {
    return res.status(400).json({ message: "Date is required." });
  }

  await cleanupStaleEmptyDrafts(studentNumber);

  const result = await query(
    `
      select je.id, je.entry_date, je.created_at, je.summary, je.title, je.insights, je.is_finished,
             coalesce(last_user.message_text, '') as preview
      from public.journal_entries je
      left join lateral (
        select jem.message_text
        from public.journal_entry_messages jem
        where jem.entry_id = je.id and jem.role = 'user'
        order by jem.created_at desc, jem.id desc
        limit 1
      ) last_user on true
      where je.student_number = $1
        and je.entry_date = $2::date
        and ${buildVisibleEntriesWhereClause("je")}
      order by je.created_at desc
    `,
    [studentNumber, entryDate],
  );

  return res.json({
    date: entryDate,
    entries: result.rows.map((row) => ({
      createdAt: row.created_at,
      entryDate: formatEntryDateLabel(row.entry_date),
      id: row.id,
      insights: Array.isArray(row.insights) ? row.insights : [],
      isFinished: Boolean(row.is_finished),
      preview: row.preview || "",
      summary: row.summary || "",
      title: row.title || "",
    })),
  });
}));

router.get("/entries/calendar", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const year = Number(req.query.year || 0);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!year || Number.isNaN(year)) {
    return res.status(400).json({ message: "Year is required." });
  }

  await cleanupStaleEmptyDrafts(studentNumber);

  const result = await query(
    `
      select
        extract(month from entry_date)::int as month_index,
        extract(day from entry_date)::int as day_number,
        count(*)::int as entry_count
      from public.journal_entries
      where student_number = $1
        and extract(year from entry_date) = $2
        and ${buildVisibleEntriesWhereClause("public.journal_entries")}
      group by extract(month from entry_date), extract(day from entry_date)
      order by month_index asc, day_number asc
    `,
      [studentNumber, year],
  );

  const writtenDaysByMonth = {};
  const entryCountsByMonth = {};
  for (const row of result.rows) {
    const monthIndex = Number(row.month_index) - 1;
    if (!writtenDaysByMonth[monthIndex]) {
      writtenDaysByMonth[monthIndex] = [];
    }
    writtenDaysByMonth[monthIndex].push(Number(row.day_number));
    if (!entryCountsByMonth[monthIndex]) {
      entryCountsByMonth[monthIndex] = {};
    }
    entryCountsByMonth[monthIndex][Number(row.day_number)] = Number(row.entry_count || 0);
  }

  return res.json({ entryCountsByMonth, writtenDaysByMonth, year });
}));

router.get("/session/today", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  await cleanupStaleEmptyDrafts(studentNumber);

  const today = getManilaDateParts().isoDate;
  const entry = await getOpenEntryByStudentAndDate(studentNumber, today);

  if (!entry) {
    return res.json({
      entry: null,
      messages: [],
    });
  }

  const messages = await listEntryMessages(entry.id);
  return res.json({
    entry: mapEntryRow(entry),
    messages,
  });
}));

router.get("/entries/:entryId", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.params.entryId || "").trim();

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryId) {
    return res.status(400).json({ message: "Entry id is required." });
  }

  let entry = await getEntryById(studentNumber, entryId);
  if (!entry) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  const messages = await listEntryMessages(entry.id);
  const needsFinalAnalysis =
    Boolean(entry.is_finished) &&
    (!String(entry.summary || "").trim() || !String(entry.sentiment_label || "").trim());
  if (needsFinalAnalysis) {
    await analyzeFinalEntry({ entryId: entry.id, existingMessages: messages, studentNumber });
    entry = await getEntryById(studentNumber, entryId) || entry;
  }

  return res.json({
    entry: {
      ...mapEntryRow(entry),
      contentText: buildEntryContentText(messages),
    },
    messages,
  });
}));

router.post("/entries/:entryId/summary-rating", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.params.entryId || "").trim();
  const summaryRating = normalizeSummaryRating(req.body.rating);
  const feedbackReason = normalizeSummaryFeedbackReason(req.body.reason);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryId) {
    return res.status(400).json({ message: "Entry id is required." });
  }
  if (!summaryRating) {
    return res.status(400).json({ message: "A valid summary rating is required." });
  }
  if (summaryRating === "NEEDS_WORK" && !feedbackReason) {
    return res.status(400).json({ message: "Please add a short reason so Muni can improve future summaries." });
  }
  if (countWords(feedbackReason) > 250) {
    return res.status(400).json({ message: "Summary feedback reason must be 250 words or fewer." });
  }

  const existingResult = await query(
    `
      select summary_rating
      from public.journal_entries
      where id = $1 and student_number = $2 and deleted_by_student_at is null
      limit 1
    `,
    [entryId, studentNumber],
  );

  if (existingResult.rowCount === 0) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  if (existingResult.rows[0]?.summary_rating) {
    return res.status(409).json({ message: "Summary feedback has already been saved and cannot be changed." });
  }

  const result = await query(
    `
      update public.journal_entries
      set
        summary_rating = $3,
        summary_feedback_reason = $4,
        summary_rated_at = now(),
        updated_at = now()
      where id = $1 and student_number = $2 and deleted_by_student_at is null
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entryId, studentNumber, summaryRating, summaryRating === "NEEDS_WORK" ? feedbackReason : null],
  );

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    message: "Summary feedback saved.",
  });
}));

router.delete("/entries/:entryId", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.params.entryId || "").trim();

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryId) {
    return res.status(400).json({ message: "Entry id is required." });
  }

  const result = await removeOrSoftDeleteEntry({
    entryId,
    requireOpen: false,
    studentNumber,
  });

  if (!result.found || !result.removed) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  return res.json({
    message: result.softDeleted
      ? "High-risk journal entry hidden from student view but retained for admin review."
      : "Journal entry deleted.",
    removed: true,
    softDeleted: result.softDeleted,
  });
}));

router.post("/session/create", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const aiEnabled = req.body.aiEnabled !== false;
  const forceNew = req.body.forceNew === true;

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  await cleanupStaleEmptyDrafts(studentNumber);

  const today = getManilaDateParts().isoDate;
  const existingEntry = forceNew ? null : await getOpenEntryByStudentAndDate(studentNumber, today);
  const entry = existingEntry || (await createEntry(studentNumber, today, aiEnabled));

  return res.json({
    entry: mapEntryRow(entry),
    messages: existingEntry ? await listEntryMessages(existingEntry.id) : [],
  });
}));

async function analyzeFinalEntry({ entryId, studentNumber, existingMessages }) {
  const userMessages = existingMessages.filter((item) => item.role === "user" && String(item.text || "").trim());
  const profile = await getStudentProfile(studentNumber);
  const feedbackResult = await query(
    `
      select summary_feedback_reason
      from public.journal_entries
      where student_number = $1
        and id <> $2
        and summary_rating = 'NEEDS_WORK'
        and coalesce(summary_feedback_reason, '') <> ''
        and deleted_by_student_at is null
      order by summary_rated_at desc nulls last, updated_at desc
      limit 3
    `,
    [studentNumber, entryId],
  );
  const summaryFeedbackGuidance = feedbackResult.rows
    .map((row) => normalizeSummaryFeedbackReason(row.summary_feedback_reason))
    .filter(Boolean);
  const latestUserMessage = userMessages[userMessages.length - 1]?.text || "";
  const history = existingMessages.map((item) => ({
    role: item.role,
    text: item.text,
  }));
  const analysis = await analyzeJournalEntryFinal({
    firstName: profile.firstName,
    history,
    latestUserMessage,
    summaryFeedbackGuidance,
  });
  const fallbackText = userMessages.map((item) => item.text).join("\n");
  const suggestedTags = normalizeConcernTags(analysis.suggested_tags);

  await query(
    `
      update public.journal_entries
      set
        summary = $2,
        insights = $3::jsonb,
        risk_level = $4,
        admin_flag_reason = $5,
        sentiment_label = $6,
        sentiment_score = $7,
        dominant_emotion = $8,
        sentiment_confidence = $9,
        updated_at = now()
      where id = $1
    `,
    [
      entryId,
      analysis.summary,
      JSON.stringify(analysis.insights),
      analysis.risk_level,
      analysis.admin_flag_reason,
      analysis.sentiment_label,
      analysis.sentiment_score,
      analysis.dominant_emotion,
      analysis.sentiment_confidence,
    ],
  );

  return {
    ...analysis,
    suggested_tags: suggestedTags.length ? suggestedTags : inferJournalTagsFromText(fallbackText),
  };
}

router.post("/session/tag-suggestions", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryId) {
    return res.status(400).json({ message: "Entry id is required." });
  }

  const entry = await getEntryById(studentNumber, entryId);
  if (!entry) {
    return res.status(404).json({ message: "Journal entry not found." });
  }
  if (entry.is_finished) {
    return res.status(400).json({ message: "This journal entry is already finished." });
  }

  const existingMessages = await listEntryMessages(entryId);
  const userMessages = existingMessages.filter((item) => item.role === "user" && String(item.text || "").trim());
  if (userMessages.length === 0) {
    await removeOrSoftDeleteEntry({
      entryId,
      requireOpen: true,
      studentNumber,
    });
    return res.status(400).json({ message: "Write something first before finishing your journal entry." });
  }

  const analysis = await analyzeFinalEntry({ entryId, existingMessages, studentNumber });

  const result = await query(
    `
      select id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
             sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
             insights, risk_level, admin_flag_reason,
             primary_concern, concern_tags,
             ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
             created_at, updated_at
      from public.journal_entries
      where id = $1 and student_number = $2
      limit 1
    `,
    [entryId, studentNumber],
  );

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    messages: existingMessages,
    suggestedTags: analysis.suggested_tags,
    tagOptions: JOURNAL_TAG_OPTIONS,
    message: "Journal tags suggested.",
  });
}));

router.post("/session/finish", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();
  const requestedTags = normalizeConcernTags(req.body.concernTags);
  const requestedPrimary = normalizeConcernValue(req.body.primaryConcern);
  const forceAnalyze = req.body.forceAnalyze === true;
  const voiceMessages = normalizeVoiceSessionMessages(req.body.messages);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryId) {
    return res.status(400).json({ message: "Entry id is required." });
  }

  const entry = await getEntryById(studentNumber, entryId);
  if (!entry) {
    return res.status(404).json({ message: "Journal entry not found." });
  }
  if (entry.is_finished) {
    return res.status(400).json({ message: "This journal entry is already finished." });
  }

  if (voiceMessages) {
    await replaceEntryMessagesFromTranscript({ entryId, messages: voiceMessages, studentNumber });
  }

  const existingMessages = await listEntryMessages(entryId);
  const userMessages = existingMessages.filter((item) => item.role === "user" && String(item.text || "").trim());
  if (userMessages.length === 0) {
    await removeOrSoftDeleteEntry({
      entryId,
      requireOpen: true,
      studentNumber,
    });
    return res.status(400).json({ message: "Write something first before finishing your journal entry." });
  }

  const existingTags = resolveJournalEntryTags(entry);
  let finalTags = requestedTags.length ? requestedTags : existingTags;
  let analysis = null;
  const hasStoredAnalysis =
    Boolean(String(entry.summary || "").trim()) ||
    (Array.isArray(entry.insights) && entry.insights.length > 0);
  const hasStoredSentiment = Boolean(String(entry.sentiment_label || "").trim());

  if (forceAnalyze || !hasStoredAnalysis || !hasStoredSentiment || finalTags.length === 0) {
    analysis = await analyzeFinalEntry({ entryId, existingMessages, studentNumber });
    if (forceAnalyze || finalTags.length === 0) {
      finalTags = normalizeConcernTags(analysis.suggested_tags);
    }
  }

  if (finalTags.length === 0) {
    finalTags = inferJournalTagsFromText(userMessages.map((item) => item.text).join("\n"));
  }

  const primaryConcern = requestedPrimary && finalTags.includes(requestedPrimary)
    ? requestedPrimary
    : finalTags[0] || "Others";

  const result = await query(
    `
      update public.journal_entries
      set
        primary_concern = $3,
        concern_tags = $4::jsonb,
        is_finished = true,
        finished_at = now(),
        updated_at = now()
      where id = $1 and student_number = $2 and is_finished = false
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entryId, studentNumber, primaryConcern, JSON.stringify(finalTags)],
  );

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    messages: existingMessages,
    message: "Journal entry finished.",
  });
}));

router.post("/session/discard-empty", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();

  if (!studentNumber || !entryId) {
    return res.json({ removed: false });
  }

  const messages = await listEntryMessages(entryId);
  const hasUserContent = messages.some((item) => item.role === "user" && String(item.text || "").trim());

  if (hasUserContent) {
    return res.json({ removed: false });
  }

  await removeOrSoftDeleteEntry({
    entryId,
    requireOpen: true,
    studentNumber,
  });

  return res.json({ removed: true });
}));

router.post("/session/discard", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();

  if (!studentNumber || !entryId) {
    return res.status(400).json({ message: "Student number and entry id are required." });
  }

  const result = await removeOrSoftDeleteEntry({
    entryId,
    requireOpen: true,
    studentNumber,
  });

  if (!result.found || !result.removed || result.invalidState) {
    return res.status(404).json({ message: "Open journal entry not found." });
  }

  return res.json({
    message: result.softDeleted
      ? "High-risk journal entry hidden from student view but retained for admin review."
      : "Journal entry discarded.",
    removed: true,
    softDeleted: result.softDeleted,
  });
}));

router.post("/session/concerns", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();
  const primaryConcern = normalizeConcernValue(req.body.primaryConcern);
  const concernTags = normalizeConcernTags(req.body.concernTags);

  if (!studentNumber || !entryId) {
    return res.status(400).json({ message: "Student number and entry id are required." });
  }
  if (!primaryConcern) {
    return res.status(400).json({ message: "A valid primary concern is required." });
  }

  const normalizedTags = concernTags.length > 0 ? concernTags : [primaryConcern];

  const result = await query(
    `
      update public.journal_entries
        set
          primary_concern = $3,
          concern_tags = $4::jsonb,
          updated_at = now()
      where id = $1 and student_number = $2
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entryId, studentNumber, primaryConcern, JSON.stringify(normalizedTags)],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    message: "Journal concern saved.",
  });
}));

router.post("/session/support-response", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const entryId = String(req.body.entryId || "").trim();
  const response = String(req.body.response || "").trim().toUpperCase();

  if (!studentNumber || !entryId) {
    return res.status(400).json({ message: "Student number and entry id are required." });
  }
  if (response !== "CONTACTED" && response !== "DECLINED") {
    return res.status(400).json({ message: "A valid support response is required." });
  }

  const result = await query(
    `
      update public.journal_entries
      set
        support_prompt_shown_at = coalesce(support_prompt_shown_at, now()),
        support_response = $3,
        support_response_at = now(),
        updated_at = now()
      where id = $1 and student_number = $2
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entryId, studentNumber, response],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    message: "Support response saved.",
  });
}));

router.post("/message", asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const aiEnabled = req.body.aiEnabled !== false;
  const message = String(req.body.message || "").trim();
  const entryId = String(req.body.entryId || "").trim();
  const requireExistingEntry = req.body.requireExistingEntry === true;
  const submittedMessages = normalizeVoiceSessionMessages(req.body.messages) || [];
  const wordCount = countWords(message);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }
  if (requireExistingEntry && !entryId) {
    return res.status(400).json({ message: "Voice journal session is missing." });
  }
  if (wordCount > JOURNAL_MAX_WORDS) {
    return res.status(400).json({
      message: `Journal entry must not exceed ${JOURNAL_MAX_WORDS} words.`,
    });
  }

  const today = getManilaDateParts().isoDate;
  const profile = await getStudentProfile(studentNumber);
  if (!profile.fullName) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  let entry = null;

  if (entryId) {
      const entryResult = await query(
        `
        select id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
               sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
               insights, risk_level, admin_flag_reason,
               primary_concern, concern_tags,
               ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
               created_at, updated_at
        from public.journal_entries
        where id = $1 and student_number = $2
        limit 1
      `,
      [entryId, studentNumber],
    );
    entry = entryResult.rows[0] || null;
    if (!entry && requireExistingEntry) {
      if (submittedMessages.length === 0) {
        return res.status(404).json({ message: "Voice journal session was not found." });
      }
      entry = await createEntry(studentNumber, today, aiEnabled);
      await replaceEntryMessagesFromTranscript({
        entryId: entry.id,
        messages: submittedMessages,
        studentNumber,
      });
    }
    if (entry?.is_finished) {
      return res.status(400).json({ message: "This journal entry is already finished." });
    }
  }

  if (!entry && !requireExistingEntry) {
    entry = await getOpenEntryByStudentAndDate(studentNumber, today);
  }
  if (!entry && !requireExistingEntry) {
    entry = await createEntry(studentNumber, today, aiEnabled);
  }
  if (!entry) {
    return res.status(404).json({ message: "Journal entry not found." });
  } else if (Boolean(entry.ai_enabled) !== aiEnabled) {
    const updateAiResult = await query(
      `
        update public.journal_entries
        set ai_enabled = $2, updated_at = now()
        where id = $1
        returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                  sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                  insights, risk_level, admin_flag_reason,
                  primary_concern, concern_tags,
                  ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                  created_at, updated_at
      `,
      [entry.id, aiEnabled],
    );
    entry = updateAiResult.rows[0];
  }

  await query(
    `
      insert into public.journal_entry_messages (entry_id, student_number, role, message_text)
      values ($1, $2, 'user', $3)
    `,
    [entry.id, studentNumber, message],
  );

  const currentMessages = await listEntryMessages(entry.id);
  let aiReply = null;
  let aiMessage = null;
  let summary = entry.summary || "";
  let insights = Array.isArray(entry.insights) ? entry.insights : [];
  let riskLevel = String(entry.risk_level || "NONE");
  let adminFlagReason = entry.admin_flag_reason || null;

  if (aiEnabled) {
    const analysis = await analyzeJournalConversation({
      firstName: profile.firstName,
      history: currentMessages.map((item) => ({
        role: item.role,
        text: item.text,
      })),
      latestUserMessage: message,
    });

    aiReply = analysis.pet_reply;
    aiMessage = analysis.unavailable_reason || null;
    summary = String(analysis.summary || "").trim() || summary || summarizeJournalMessages(currentMessages);
    insights = analysis.insights;
    riskLevel = analysis.risk_level;
    adminFlagReason = analysis.admin_flag_reason;

    if (aiReply) {
      await query(
        `
          insert into public.journal_entry_messages (entry_id, student_number, role, message_text)
          values ($1, $2, 'assistant', $3)
        `,
        [entry.id, studentNumber, aiReply],
      );
    }
  }

  const title = entry.title || buildEntryTitle(message);
  const updatedEntryResult = await query(
    `
      update public.journal_entries
      set
        title = $2,
        summary = $3,
        insights = $4::jsonb,
        risk_level = $5,
        admin_flag_reason = $6,
        ai_enabled = $7,
        updated_at = now()
      where id = $1
      returning id, student_number, entry_date, title, summary, summary_rating, summary_feedback_reason, summary_rated_at,
                sentiment_label, sentiment_score, dominant_emotion, sentiment_confidence,
                insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entry.id, title, summary, JSON.stringify(insights), riskLevel, adminFlagReason, aiEnabled],
  );

  const updatedEntry = updatedEntryResult.rows[0];
  const messages = await listEntryMessages(updatedEntry.id);

  return res.json({
    aiReply,
    entry: mapEntryRow(updatedEntry),
    message:
      aiMessage === "ai_temporarily_unavailable"
        ? "Muni is temporarily unavailable. Please try again in a bit."
        : undefined,
    messages,
  });
}));

module.exports = router;

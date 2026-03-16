const express = require("express");
const { query } = require("../config/db");
const { supabaseAdminClient } = require("../config/supabase");
const { analyzeJournalConversation, analyzeJournalEntryFinal } = require("../services/gemini.service");

const router = express.Router();
const JOURNAL_MAX_WORDS = 1000;
const CONCERN_OPTIONS = [
  "Academic Stress",
  "Anxiety / Stress",
  "Relationships",
  "Family Issues",
  "Career Guidance",
  "Financial Concerns",
  "Burnout / Exhaustion",
  "Bullying",
  "Others",
];

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

function normalizeConcernValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const aliases = {
    "academic": "Academic Stress",
    "academic stress": "Academic Stress",
    "anxiety": "Anxiety / Stress",
    "stress": "Anxiety / Stress",
    "anxiety/stress": "Anxiety / Stress",
    "anxiety / stress": "Anxiety / Stress",
    "relationships": "Relationships",
    "relationship": "Relationships",
    "family": "Family Issues",
    "family issues": "Family Issues",
    "career": "Career Guidance",
    "career guidance": "Career Guidance",
    "financial": "Financial Concerns",
    "financial concerns": "Financial Concerns",
    "burnout": "Burnout / Exhaustion",
    "burnout / exhaustion": "Burnout / Exhaustion",
    "burnout/exhaustion": "Burnout / Exhaustion",
    "bullying": "Bullying",
    "other": "Others",
    "others": "Others",
  };

  return aliases[normalized] || "";
}

function normalizeConcernTags(value) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const deduped = [];
  for (const item of rawItems) {
    const normalized = normalizeConcernValue(item);
    if (normalized && !deduped.includes(normalized)) {
      deduped.push(normalized);
    }
  }
  return deduped;
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
      select id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
      returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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

async function getEntryById(studentNumber, entryId) {
  const result = await query(
    `
      select id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
  return {
    adminFlagReason: row.admin_flag_reason || null,
    aiEnabled: Boolean(row.ai_enabled),
    concernTags: Array.isArray(row.concern_tags) ? row.concern_tags : [],
    createdAt: row.created_at,
    entryDate: formatEntryDateLabel(row.entry_date),
    finishedAt: row.finished_at || null,
    id: row.id,
    insights: Array.isArray(row.insights) ? row.insights : [],
    isFinished: Boolean(row.is_finished),
    primaryConcern: row.primary_concern || null,
    riskLevel: String(row.risk_level || "NONE"),
    summary: row.summary || "",
    supportPromptShownAt: row.support_prompt_shown_at || null,
    supportResponse: row.support_response || null,
    supportResponseAt: row.support_response_at || null,
    title: row.title || "",
    updatedAt: row.updated_at,
  };
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

router.get("/entries/recent", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
  const windowDays = Math.max(1, Math.min(30, Number(req.query.windowDays || 20)));
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

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
          and je.deleted_by_student_at is null
        order by je.entry_date desc, je.created_at desc
        limit 100
      `,
      [studentNumber, windowStart],
    ),
    query(
      `
        select
          count(*) filter (where entry_date = $2)::int as today_count,
          count(*) filter (where entry_date >= $3 and entry_date < $4)::int as monthly_count,
          count(*)::int as total_count
        from public.journal_entries
        where student_number = $1
          and deleted_by_student_at is null
      `,
      [studentNumber, today.isoDate, monthStart, nextMonthStart],
    ),
  ]);

  const progressRow = progressResult.rows[0] || {};

  return res.json({
    entries: entriesResult.rows.map((row) => ({
      createdAt: row.created_at,
      entryDate: formatEntryDateLabel(row.entry_date),
      id: row.id,
      isFinished: Boolean(row.is_finished),
      preview: row.preview || row.summary || "",
      summary: row.summary || "",
      title: row.title || "",
    })),
    progress: {
      monthlyCount: Number(progressRow.monthly_count || 0),
      todayCount: Number(progressRow.today_count || 0),
      totalCount: Number(progressRow.total_count || 0),
    },
  });
}));

router.get("/entries/by-date", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
  const entryDate = formatEntryDateLabel(req.query.date);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!entryDate) {
    return res.status(400).json({ message: "Date is required." });
  }

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
        and je.deleted_by_student_at is null
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
      preview: row.preview || row.summary || "",
      summary: row.summary || "",
      title: row.title || "",
    })),
  });
}));

router.get("/entries/calendar", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
  const year = Number(req.query.year || 0);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!year || Number.isNaN(year)) {
    return res.status(400).json({ message: "Year is required." });
  }

  const result = await query(
    `
      select
        extract(month from entry_date)::int as month_index,
        extract(day from entry_date)::int as day_number,
        count(*)::int as entry_count
      from public.journal_entries
      where student_number = $1 and extract(year from entry_date) = $2 and deleted_by_student_at is null
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
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

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
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
  const entryId = String(req.params.entryId || "").trim();

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

  const messages = await listEntryMessages(entry.id);
  return res.json({
    entry: mapEntryRow(entry),
    messages,
  });
}));

router.delete("/entries/:entryId", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
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
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
  const aiEnabled = req.body.aiEnabled !== false;
  const forceNew = req.body.forceNew === true;

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  const today = getManilaDateParts().isoDate;
  const existingEntry = forceNew ? null : await getOpenEntryByStudentAndDate(studentNumber, today);
  const entry = existingEntry || (await createEntry(studentNumber, today, aiEnabled));

  return res.json({
    entry: mapEntryRow(entry),
    messages: existingEntry ? await listEntryMessages(existingEntry.id) : [],
  });
}));

router.post("/session/finish", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
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
  if (!normalizeConcernValue(entry.primary_concern)) {
    return res.status(400).json({ message: "Select a primary concern before finishing your journal entry." });
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

  if (userMessages.length > 0) {
    const profile = await getStudentProfile(studentNumber);
    const latestUserMessage = userMessages[userMessages.length - 1]?.text || "";
    const analysis = await analyzeJournalEntryFinal({
      firstName: profile.firstName,
      history: existingMessages.map((item) => ({
        role: item.role,
        text: item.text,
      })),
      latestUserMessage,
    });

    await query(
      `
        update public.journal_entries
        set
          summary = $2,
          insights = $3::jsonb,
          risk_level = $4,
          admin_flag_reason = $5,
          updated_at = now()
        where id = $1
      `,
      [
        entryId,
        analysis.summary,
        JSON.stringify(analysis.insights),
        analysis.risk_level,
        analysis.admin_flag_reason,
      ],
    );
  }

  const result = await query(
    `
      update public.journal_entries
      set is_finished = true, finished_at = now(), updated_at = now()
      where id = $1 and student_number = $2 and is_finished = false
      returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
                primary_concern, concern_tags,
                ai_enabled, is_finished, finished_at, support_prompt_shown_at, support_response, support_response_at,
                created_at, updated_at
    `,
    [entryId, studentNumber],
  );

  return res.json({
    entry: mapEntryRow(result.rows[0]),
    message: "Journal entry finished.",
  });
}));

router.post("/session/discard-empty", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
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
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
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
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
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
      returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
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
      returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
  const aiEnabled = req.body.aiEnabled !== false;
  const message = String(req.body.message || "").trim();
  const entryId = String(req.body.entryId || "").trim();
  const wordCount = countWords(message);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
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
        select id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
    if (entry?.is_finished) {
      return res.status(400).json({ message: "This journal entry is already finished." });
    }
  }

  if (!entry) {
    entry = await getOpenEntryByStudentAndDate(studentNumber, today);
  }
  if (!entry) {
    entry = await createEntry(studentNumber, today, aiEnabled);
  } else if (Boolean(entry.ai_enabled) !== aiEnabled) {
    const updateAiResult = await query(
      `
        update public.journal_entries
        set ai_enabled = $2, updated_at = now()
        where id = $1
        returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
    summary = analysis.summary;
    insights = analysis.insights;
    riskLevel = analysis.risk_level;
    adminFlagReason = analysis.admin_flag_reason;

    await query(
      `
        insert into public.journal_entry_messages (entry_id, student_number, role, message_text)
        values ($1, $2, 'assistant', $3)
      `,
      [entry.id, studentNumber, aiReply],
    );
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
      returning id, student_number, entry_date, title, summary, insights, risk_level, admin_flag_reason,
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
    messages,
  });
}));

module.exports = router;

const crypto = require("crypto");
const express = require("express");
const { query } = require("../config/db");

const { requireStudentOnlyAuth } = require("../middleware/auth.middleware");
const router = express.Router();
router.use(requireStudentOnlyAuth);
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const MANILA_TIME_ZONE = "Asia/Manila";

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
  const fromAuth = normalizeStudentNumber(req.student?.studentNumber || "");
  if (fromAuth) return fromAuth;
  return "";
}

function normalizeMessage(value) {
  return String(value || "")
    .trim()
    .slice(0, 500);
}

function parseDeliveryAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getManilaNowMs(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value || "0");
  return Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
}

function isStrictlyAfterManilaNow(date) {
  return getManilaNowMs(date) > getManilaNowMs();
}

function mapMessageRow(row) {
  if (!row) return null;
  const deliveryAt = parseDeliveryAt(row.delivery_at);
  const pending = Boolean(deliveryAt && isStrictlyAfterManilaNow(deliveryAt));
  return {
    canDelete: true,
    canEdit: pending,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
    deliveryAt: row.delivery_at,
    id: row.id,
    message: row.message,
    status: pending ? "PENDING" : "ARRIVED",
    studentNumber: row.student_number,
    updatedAt: row.updated_at,
  };
}

async function findOwnedMessage(studentNumber, messageId) {
  const result = await query(
    `
      select id, student_number, message, delivery_at, created_at, updated_at, deleted_at
      from public.future_self_messages
      where id = $1
        and student_number = $2
        and deleted_at is null
      limit 1
    `,
    [messageId, studentNumber],
  );
  return result.rows[0] || null;
}

function isPendingRow(row) {
  if (!row) return false;
  const deliveryAt = parseDeliveryAt(row.delivery_at);
  return Boolean(deliveryAt && isStrictlyAfterManilaNow(deliveryAt));
}

router.get(["/messages/current", "/current"], asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  const result = await query(
    `
      select id, student_number, message, delivery_at, created_at, updated_at
      from public.future_self_messages
      where student_number = $1
        and deleted_at is null
      order by updated_at desc, created_at desc
      limit 1
    `,
    [studentNumber],
  );

  const current = mapMessageRow(result.rows[0]);
  return res.json({ futureSelfMessage: current, letter: current });
}));

router.get(["/messages", "/"], asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  const result = await query(
    `
      select id, student_number, message, delivery_at, created_at, updated_at
      from public.future_self_messages
      where student_number = $1
        and deleted_at is null
      order by delivery_at asc, created_at asc
    `,
    [studentNumber],
  );

  const letters = result.rows.map(mapMessageRow);
  return res.json({ futureSelfMessages: letters, letters });
}));

router.post(["/messages", "/"], asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const message = normalizeMessage(req.body.message);
  const deliveryAt = parseDeliveryAt(req.body.deliveryAt);
  const id = crypto.randomUUID();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }
  if (!deliveryAt || !isStrictlyAfterManilaNow(deliveryAt)) {
    return res.status(400).json({ message: "Choose a future delivery date in Philippine time." });
  }

  const result = await query(
    `
      insert into public.future_self_messages (
        id, student_number, message, delivery_at, created_at, updated_at, deleted_at
      )
      values ($1, $2, $3, $4, now(), now(), null)
      returning id, student_number, message, delivery_at, created_at, updated_at
    `,
    [id, studentNumber, message, deliveryAt.toISOString()],
  );

  const saved = mapMessageRow(result.rows[0]);
  return res.status(201).json({
    message: "Future Me message saved.",
    futureSelfMessage: saved,
    letter: saved,
  });
}));

router.patch(["/messages/:messageId", "/:messageId"], asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const messageId = String(req.params.messageId || "").trim();
  const hasMessage = Object.prototype.hasOwnProperty.call(req.body || {}, "message");
  const hasDeliveryAt = Object.prototype.hasOwnProperty.call(req.body || {}, "deliveryAt");
  const message = hasMessage ? normalizeMessage(req.body.message) : "";
  const deliveryAt = hasDeliveryAt ? parseDeliveryAt(req.body.deliveryAt) : null;

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!messageId) {
    return res.status(400).json({ message: "Message id is required." });
  }
  if (!hasMessage && !hasDeliveryAt) {
    return res.status(400).json({ message: "Message or delivery date is required." });
  }
  if (hasMessage && !message) {
    return res.status(400).json({ message: "Message is required." });
  }
  if (hasDeliveryAt && (!deliveryAt || !isStrictlyAfterManilaNow(deliveryAt))) {
    return res.status(400).json({ message: "Choose a future delivery date in Philippine time." });
  }

  const existing = await findOwnedMessage(studentNumber, messageId);
  if (!existing) {
    return res.status(404).json({ message: "Letter not found." });
  }
  if (!isPendingRow(existing)) {
    return res.status(409).json({ message: "Arrived letters cannot be edited." });
  }

  const nextMessage = hasMessage ? message : existing.message;
  const nextDeliveryAt = hasDeliveryAt ? deliveryAt : parseDeliveryAt(existing.delivery_at);
  if (!nextDeliveryAt || !isStrictlyAfterManilaNow(nextDeliveryAt)) {
    return res.status(400).json({ message: "Choose a future delivery date in Philippine time." });
  }

  const result = await query(
    `
      update public.future_self_messages
      set message = $3,
          delivery_at = $4,
          updated_at = now()
      where id = $1
        and student_number = $2
        and deleted_at is null
      returning id, student_number, message, delivery_at, created_at, updated_at
    `,
    [messageId, studentNumber, nextMessage, nextDeliveryAt.toISOString()],
  );

  const updated = mapMessageRow(result.rows[0]);
  return res.json({
    message: "Future Me message updated.",
    futureSelfMessage: updated,
    letter: updated,
  });
}));

router.delete(["/messages/:messageId", "/:messageId"], asyncHandler(async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const messageId = String(req.params.messageId || "").trim();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!messageId) {
    return res.status(400).json({ message: "Message id is required." });
  }

  const existing = await findOwnedMessage(studentNumber, messageId);
  if (!existing) {
    return res.status(404).json({ message: "Letter not found." });
  }

  await query(
    `
      update public.future_self_messages
      set deleted_at = now(),
          updated_at = now()
      where id = $1
        and student_number = $2
        and deleted_at is null
    `,
    [messageId, studentNumber],
  );

  await query(
    `
      update public.student_notifications
      set deleted_at = now()
      where student_number = $2
        and deleted_at is null
        and kind like 'FUTURE_SELF%'
        and metadata->>'futureSelfMessageId' = $1
    `,
    [messageId, studentNumber],
  );

  return res.json({ message: "Future Me message deleted.", ok: true, id: messageId });
}));

module.exports = router;

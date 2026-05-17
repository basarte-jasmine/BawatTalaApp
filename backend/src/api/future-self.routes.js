const express = require("express");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;

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

function normalizeMessageId(value) {
  return String(value || "")
    .trim()
    .slice(0, 120);
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

function mapMessageRow(row) {
  if (!row) return null;
  return {
    createdAt: row.created_at,
    deliveryAt: row.delivery_at,
    id: row.id,
    message: row.message,
    studentNumber: row.student_number,
    updatedAt: row.updated_at,
  };
}

router.get("/messages/current", asyncHandler(async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber);
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

  return res.json({ futureSelfMessage: mapMessageRow(result.rows[0]) });
}));

router.post("/messages", asyncHandler(async (req, res) => {
  const id = normalizeMessageId(req.body.id);
  const studentNumber = normalizeStudentNumber(req.body.studentNumber);
  const message = normalizeMessage(req.body.message);
  const deliveryAt = parseDeliveryAt(req.body.deliveryAt);

  if (!id) {
    return res.status(400).json({ message: "Message id is required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }
  if (!deliveryAt || deliveryAt.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Choose a future delivery date." });
  }

  const result = await query(
    `
      insert into public.future_self_messages (
        id, student_number, message, delivery_at, created_at, updated_at, deleted_at
      )
      values ($1, $2, $3, $4, now(), now(), null)
      on conflict (id) do update
      set student_number = excluded.student_number,
          message = excluded.message,
          delivery_at = excluded.delivery_at,
          updated_at = now(),
          deleted_at = null
      returning id, student_number, message, delivery_at, created_at, updated_at
    `,
    [id, studentNumber, message, deliveryAt.toISOString()],
  );

  return res.json({
    message: "Future Me message saved.",
    futureSelfMessage: mapMessageRow(result.rows[0]),
  });
}));

module.exports = router;

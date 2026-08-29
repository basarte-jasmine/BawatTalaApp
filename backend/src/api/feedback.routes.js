const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireStudentOnlyAuth);

const FEEDBACK_CATEGORIES = new Set(["Bug", "Suggestion", "Question", "Support", "Experience", "Concern", "Other"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  return normalizeCompactSpaces(value).toUpperCase();
}

function normalizeFeedbackCategory(value) {
  const normalized = normalizeCompactSpaces(value);
  return FEEDBACK_CATEGORIES.has(normalized) ? normalized : "Other";
}

function parseAttachment(value) {
  if (!value) return null;
  if (typeof value !== "object") {
    throw new Error("Invalid attachment.");
  }

  const dataUrl = String(value.dataUrl || "").trim();
  const contentType = String(value.contentType || "").trim().toLowerCase();
  const fileName = normalizeCompactSpaces(value.fileName || "feedback-image");
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/);

  if (!match) {
    throw new Error("Invalid image attachment.");
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2];
  if (!IMAGE_TYPES.has(mimeType) || (contentType && !IMAGE_TYPES.has(contentType))) {
    throw new Error("Please attach a JPG, PNG, or WEBP image.");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new Error("Attached image is empty.");
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attached image must be 5 MB or smaller.");
  }

  return {
    contentType: mimeType,
    dataUrl,
    fileName: fileName.slice(0, 160),
  };
}

function mapFeedbackRow(row) {
  return {
    id: row.id,
    studentNumber: row.student_number,
    studentName: row.student_name || "",
    studentEmail: row.student_email || "",
    category: row.category,
    message: row.message,
    status: row.status,
    priority: row.priority,
    attachment: row.attachment_data_url
      ? {
          contentType: row.attachment_content_type || "",
          dataUrl: row.attachment_data_url,
          fileName: row.attachment_file_name || "feedback-image",
        }
      : null,
    adminNotes: row.admin_notes || "",
    reviewedByEmail: row.reviewed_by_email || "",
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.post("/", async (req, res) => {
  const studentNumber = normalizeStudentNumber(resolveStudentNumber(req) || "");
  const category = normalizeFeedbackCategory(req.body?.category);
  const message = normalizeCompactSpaces(req.body?.message);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Feedback message is required." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ message: "Feedback must be 2000 characters or fewer." });
  }

  let attachment = null;
  try {
    attachment = parseAttachment(req.body?.attachment);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Invalid attachment." });
  }

  try {
    const result = await query(
      `
        insert into public.student_feedbacks (
          student_number,
          category,
          message,
          attachment_data_url,
          attachment_file_name,
          attachment_content_type
        )
        values ($1, $2, $3, $4, $5, $6)
        returning id, student_number, category, message, status, priority, attachment_data_url,
          attachment_file_name, attachment_content_type, admin_notes, reviewed_by_email,
          reviewed_at, created_at, updated_at
      `,
      [
        studentNumber,
        category,
        message,
        attachment?.dataUrl || null,
        attachment?.fileName || null,
        attachment?.contentType || null,
      ],
    );

    return res.status(201).json({
      feedback: mapFeedbackRow(result.rows[0]),
      message: "Feedback sent. Thank you for helping improve Bawat Tala.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to save feedback." });
  }
});

module.exports = {
  feedbackRouter: router,
  mapFeedbackRow,
};

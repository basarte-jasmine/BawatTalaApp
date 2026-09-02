const express = require("express");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(requireStudentOnlyAuth);

const SUBMISSION_TYPES = new Set(["FEEDBACK", "SUPPORT"]);
const FEEDBACK_CATEGORIES = new Set(["Suggestion", "App Experience", "Bug Report", "Other"]);
const SUPPORT_CATEGORIES = new Set(["Account Issue", "Consultation/Booking Help", "Technical Issue", "Other"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_SUBJECT_CHARS = 120;
const MAX_MESSAGE_CHARS = 2000;

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  return normalizeCompactSpaces(value).toUpperCase();
}

function normalizeSubmissionType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "FEEDBACK";
  return SUBMISSION_TYPES.has(normalized) ? normalized : null;
}

function normalizeFeedbackCategory(value, submissionType) {
  const raw = normalizeCompactSpaces(value);
  const allowed = submissionType === "SUPPORT" ? SUPPORT_CATEGORIES : FEEDBACK_CATEGORIES;
  if (!raw) return "Other";
  const key = raw.toLowerCase();
  const aliasMap = {
    suggestion: "Suggestion",
    experience: "App Experience",
    "app experience": "App Experience",
    bug: "Bug Report",
    "bug report": "Bug Report",
    other: "Other",
    "account issue": "Account Issue",
    consultation: "Consultation/Booking Help",
    booking: "Consultation/Booking Help",
    "consultation/booking help": "Consultation/Booking Help",
    "technical issue": "Technical Issue",
  };
  const mapped = aliasMap[key] || raw;
  return allowed.has(mapped) ? mapped : null;
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
    submissionType: row.submission_type || "FEEDBACK",
    subject: row.subject || "",
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
  const submissionType = normalizeSubmissionType(req.body?.submissionType ?? req.body?.type);
  const category = normalizeFeedbackCategory(req.body?.category, submissionType || "FEEDBACK");
  if (!category) {
    return res.status(400).json({ message: "Choose a valid category." });
  }
  const subject = normalizeCompactSpaces(req.body?.subject ?? req.body?.title ?? "");
  const message = normalizeCompactSpaces(req.body?.message);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!submissionType) {
    return res.status(400).json({ message: "Choose a valid submission type." });
  }
  if (subject.length > MAX_SUBJECT_CHARS) {
    return res.status(400).json({ message: "Subject must be 120 characters or fewer." });
  }
  if (!message) {
    return res.status(400).json({ message: "Feedback message is required." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
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
          submission_type,
          subject,
          category,
          message,
          attachment_data_url,
          attachment_file_name,
          attachment_content_type
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, student_number, submission_type, subject, category, message, status, priority, attachment_data_url,
          attachment_file_name, attachment_content_type, admin_notes, reviewed_by_email,
          reviewed_at, created_at, updated_at
      `,
      [
        studentNumber,
        submissionType,
        subject || null,
        category,
        message,
        attachment?.dataUrl || null,
        attachment?.fileName || null,
        attachment?.contentType || null,
      ],
    );

    return res.status(201).json({
      feedback: mapFeedbackRow(result.rows[0]),
      message: submissionType === "SUPPORT"
        ? "Support request sent. We'll get back to you."
        : "Feedback sent. Thank you for helping improve Bawat Tala.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to save feedback." });
  }
});

module.exports = {
  feedbackRouter: router,
  mapFeedbackRow,
};
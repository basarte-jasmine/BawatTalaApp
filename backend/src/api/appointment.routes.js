const express = require("express");
const { createHash, randomBytes } = require("crypto");
const { dbPool } = require("../config/db");
const { query } = require("../config/db");
const { getAuthenticatedStudent, requireAdminAuth, requireRoles, requireStudentOnlyAuth, requireStudentOrAdminAuth, resolveStudentNumber } = require("../middleware/auth.middleware");
const { supabaseAdminClient } = require("../config/supabase");
const {
  APPOINTMENT_CONCERN_OPTIONS,
  APPOINTMENT_CONCERN_SUBCATEGORIES,
  normalizeAppointmentConcern,
} = require("../constants/appointment-concerns");

const router = express.Router();
router.use("/admin", requireAdminAuth);

const MANILA_TIME_ZONE = "Asia/Manila";
const DEFAULT_SLOT_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"];
const MOBILE_BOOKING_LEAD_DAYS = 2;
const APPOINTMENT_DECISION_WINDOW_HOURS = 24;
const APPOINTMENT_EXPIRY_CHECK_MS = 5 * 60 * 1000;
const APPOINTMENT_REMINDER_LEAD_MINUTES = 10;
const PEER_PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const CONCERN_OPTIONS = APPOINTMENT_CONCERN_OPTIONS;
const PEER_CONCERN_OPTIONS = CONCERN_OPTIONS.filter(
  (item) => !["Career guidance", "Financial guidance"].includes(item),
);
const PEER_CONCERN_VALUES = new Set([
  ...PEER_CONCERN_OPTIONS,
  ...Object.values(APPOINTMENT_CONCERN_SUBCATEGORIES).flat(),
]);
const PEER_GENDER_VALUES = new Set(["Male", "Female"]);
const PEER_INVITATION_STATUS_VALUES = new Set(["PENDING", "ACCEPTED", "DECLINED"]);
const BOOKING_SOURCES = new Set(["MOBILE_APP", "ADMIN_PANEL"]);
const SUPPORT_TYPE_GUIDANCE = "GUIDANCE";
const SUPPORT_TYPE_PEER = "PEER";
const COUNSELING_TYPE_OPTIONS = ["1-on-1", "Group"];
const COUNSELING_TYPE_VALUES = new Set(COUNSELING_TYPE_OPTIONS);
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;

function resolveRequestStudentNumber(req) {
  const fromAuth = resolveStudentNumber(req) || getAuthenticatedStudent(req)?.studentNumber;
  return String(fromAuth || "").trim();
}


function parseNotificationMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }
  return typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function followUpThreadKey(metadata) {
  const meta = parseNotificationMetadata(metadata);
  const counselorId = String(meta.counselorId || "").trim();
  if (counselorId) return counselorId;
  return String(meta.actorEmail || "").trim().toLowerCase();
}

function groupFollowUpThreads(rows) {
  const emailToCounselorId = new Map();
  for (const row of rows) {
    const meta = parseNotificationMetadata(row.metadata);
    const counselorId = String(meta.counselorId || "").trim();
    const actorEmail = String(meta.actorEmail || "").trim().toLowerCase();
    if (counselorId && actorEmail) {
      emailToCounselorId.set(actorEmail, counselorId);
    }
  }

  const groups = new Map();
  for (const row of rows) {
    const meta = parseNotificationMetadata(row.metadata);
    const counselorId = String(meta.counselorId || "").trim();
    const actorEmail = String(meta.actorEmail || "").trim().toLowerCase();
    const key = counselorId || emailToCounselorId.get(actorEmail) || actorEmail;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function serializeFollowUpMessage(row) {
  const meta = parseNotificationMetadata(row.metadata);
  const counselorId = String(meta.counselorId || "").trim() || followUpThreadKey(meta);
  const name = String(meta.actorName || meta.counselorName || row.title || "").trim();
  const role = String(meta.actorRole || "").trim();
  return {
    id: row.id,
    createdAt: row.created_at,
    body: row.message,
    from: {
      counselorId,
      name,
      role,
    },
  };
}

function serializeStudentMessageThread(counselorId, rows, profile) {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const last = sorted[sorted.length - 1];
  const lastMeta = parseNotificationMetadata(last?.metadata);
  const counselorName = String(
    profile?.full_name || lastMeta.actorName || lastMeta.counselorName || last?.title || "",
  ).trim();
  const pictureUrl = String(
    profile?.profile_picture_url || lastMeta.pictureUrl || lastMeta.profilePictureUrl || "",
  ).trim();
  const actorEmail = String(profile?.email || lastMeta.actorEmail || lastMeta.email || "").trim();
  const allRead = sorted.every((row) => Boolean(row.is_read));
  const lastRead = [...sorted].reverse().find((row) => row.read_at)?.read_at || null;
  return {
    id: counselorId,
    kind: "ADMIN_MESSAGE",
    title: counselorName || last?.title || "Message",
    message: last?.message || "",
    pictureUrl,
    profilePictureUrl: pictureUrl,
    counselorName,
    metadata: {
      counselorId,
      counselorName,
      actorName: counselorName,
      actorEmail,
      pictureUrl,
      profilePictureUrl: pictureUrl,
      thread: true,
      messageCount: sorted.length,
      route: "/messages",
    },
    isRead: allRead,
    readAt: allRead ? lastRead : null,
    createdAt: last?.created_at,
    timeLabel: formatRelativeDateTime(last?.created_at),
    source: "CONSULT",
    route: "/messages",
  };
}

function isCounselorUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function loadCounselorProfiles(ids) {
  const unique = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(isCounselorUuid))];
  if (!unique.length) return new Map();
  const result = await query(
    `
      select
        id::text as id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        role,
        coalesce(profile_picture_url, '') as profile_picture_url
      from public.admin_accounts
      where id = any($1::uuid[])
    `,
    [unique],
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}



function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getManilaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    isoDate: `${year}-${month}-${day}`,
  };
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function normalizeMonth(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function normalizeSlotTime(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return getManilaDateParts(value).isoDate;
  }

  const raw = String(value).trim();
  const exactMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactMatch) {
    return `${exactMatch[1]}-${exactMatch[2]}-${exactMatch[3]}`;
  }

  const prefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (prefixMatch) {
    return `${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return getManilaDateParts(parsed).isoDate;
}

function toDayOfWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00+08:00`);
  return date.getUTCDay();
}

function toReadableTime(slotTime) {
  const [hourText = "00", minuteText = "00"] = String(slotTime || "00:00").split(":");
  const hourValue = Number(hourText);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const normalizedHour = hourValue % 12 || 12;
  return `${normalizedHour}:${minuteText} ${suffix}`;
}

function normalizeSupportType(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (["PEER", "PEER_COUNSELOR", "PEER COUNSELOR"].includes(normalized)) {
    return SUPPORT_TYPE_PEER;
  }
  return SUPPORT_TYPE_GUIDANCE;
}

function normalizeCounselingType(value) {
  const normalized = normalizeCompactSpaces(value).toLowerCase();
  if (!normalized) return "";
  if (["1 on 1", "1-on-1", "one on one", "one-on-one", "individual"].includes(normalized)) {
    return "1-on-1";
  }
  if (["group", "by group", "group session"].includes(normalized)) {
    return "Group";
  }
  const exact = COUNSELING_TYPE_OPTIONS.find((item) => item.toLowerCase() === normalized);
  return exact || "";
}

function normalizePeerGender(value) {
  const gender = String(value || "").trim();
  return PEER_GENDER_VALUES.has(gender) ? gender : "";
}

function normalizePeerInvitationStatus(value, fallback = "PENDING") {
  const normalized = String(value || "").trim().toUpperCase();
  return PEER_INVITATION_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function isPeerSupportType(value) {
  return normalizeSupportType(value) === SUPPORT_TYPE_PEER;
}

function toRoleLabel(role, supportType = SUPPORT_TYPE_GUIDANCE) {
  if (isPeerSupportType(supportType)) return "Peer Counselor";
  return role === "HEAD_COUNSELOR" ? "Head Counselor" : "Counselor";
}

function normalizeConcern(value) {
  return normalizeAppointmentConcern(value);
}

function formatDateLong(value) {
  if (!value) return "";
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(`${value}T12:00:00+08:00`);
  }
  if (Number.isNaN(date?.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

function formatRelativeDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getAppointmentStartDateTime(appointmentDate, slotTime) {
  const normalizedDate = normalizeDateValue(appointmentDate);
  const normalizedSlot = normalizeSlotTime(slotTime);
  if (!normalizedDate || !normalizedSlot) return null;
  const parsed = new Date(`${normalizedDate}T${normalizedSlot}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAppointmentDateTime(appointmentDate, slotTime) {
  const appointmentDateTime = getAppointmentStartDateTime(appointmentDate, slotTime);
  if (!appointmentDateTime) {
    return `${formatDateLong(appointmentDate)} at ${toReadableTime(slotTime)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(appointmentDateTime);
}

function addDaysToIsoDate(isoDate, days) {
  const anchor = new Date(`${isoDate}T12:00:00+08:00`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return getManilaDateParts(anchor).isoDate;
}

function getMinimumStudentBookingDate() {
  return addDaysToIsoDate(getManilaDateParts().isoDate, MOBILE_BOOKING_LEAD_DAYS);
}

function getDecisionDeadlineIso(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + APPOINTMENT_DECISION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

function isActiveAppointmentStatus(status) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(String(status || "").toUpperCase());
}

function isPendingAppointment(status) {
  return String(status || "").toUpperCase() === "PENDING";
}

function toStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "Pending";
  if (normalized === "DECLINED") return "Declined";
  if (normalized === "CANCELLED") return "Cancelled";
  if (normalized === "COMPLETED") return "Completed";
  return "Confirmed";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikePlaceholderSecret(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === "your_resend_api_key" ||
    normalized === "changeme" ||
    normalized === "replace_me" ||
    normalized.includes("your_") ||
    normalized.includes("example")
  );
}

function isLikelyEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function getAppointmentCounselorName(appointment) {
  return appointment?.counselor_name || appointment?.counselor_full_name || (isPeerSupportType(appointment?.support_type) ? "Peer Counselor" : "Guidance Counselor");
}

function getFirstName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.split(/\s+/)[0] || normalized;
}

function getRequestBaseUrl(req) {
  const configured = String(
    process.env.BACKEND_PUBLIC_URL ||
      process.env.API_PUBLIC_URL ||
      process.env.APPOINTMENT_API_BASE_URL ||
      "",
  ).trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = String(req?.get?.("host") || "").trim();
  if (!host) return "http://localhost:4000";
  const forwardedProto = String(req?.get?.("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req?.protocol || "http";
  return `${protocol}://${host}`;
}

function getAdminWebUrl() {
  return String(process.env.ADMIN_WEB_URL || "https://bawattalapro.online/").trim();
}

function hashPeerInviteToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function createPeerInviteToken() {
  return randomBytes(32).toString("base64url");
}

function getPeerProfilePictureBucket() {
  return normalizeCompactSpaces(
    process.env.SUPABASE_PEER_AVATAR_BUCKET ||
      process.env.SUPABASE_ADMIN_AVATAR_BUCKET ||
      "admin-profile-pictures",
  );
}

function sanitizeFileName(value) {
  const normalized = normalizeCompactSpaces(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "profile-image";
}

function parsePeerProfilePicturePayload(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error("Please upload a profile picture.");
  }

  const dataUrl = String(rawValue.dataUrl || "").trim();
  const fileName = sanitizeFileName(rawValue.fileName || "profile-image");
  const contentType = String(rawValue.contentType || "").trim().toLowerCase();
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid uploaded image format.");
  }

  const mimeType = match[1].toLowerCase();
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("Only JPG, PNG, or WEBP profile pictures are allowed.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new Error("Uploaded image is empty.");
  }
  if (buffer.length >= PEER_PROFILE_PICTURE_LIMIT_BYTES) {
    throw new Error("Profile picture must be less than 5 MB.");
  }

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";

  return {
    buffer,
    contentType: contentType || mimeType,
    extension,
    fileName,
  };
}

async function ensurePeerProfilePictureBucket() {
  const bucketName = getPeerProfilePictureBucket();
  const { data: buckets, error: listError } = await supabaseAdminClient.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message || "Unable to verify storage bucket.");
  }

  const exists = Array.isArray(buckets) && buckets.some((bucket) => bucket.name === bucketName);
  if (exists) {
    return bucketName;
  }

  const { error: createError } = await supabaseAdminClient.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: `${PEER_PROFILE_PICTURE_LIMIT_BYTES}`,
  });

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw new Error(createError.message || "Unable to create storage bucket.");
  }

  return bucketName;
}

async function uploadPeerProfilePicture({ peerCounselorId, uploadedImage }) {
  const bucketName = await ensurePeerProfilePictureBucket();
  const filePath = `peer-counselors/${peerCounselorId}/${Date.now()}-${uploadedImage.fileName}.${uploadedImage.extension}`;
  const { error: uploadError } = await supabaseAdminClient.storage
    .from(bucketName)
    .upload(filePath, uploadedImage.buffer, {
      cacheControl: "3600",
      contentType: uploadedImage.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload profile picture.");
  }

  const { data } = supabaseAdminClient.storage.from(bucketName).getPublicUrl(filePath);
  return data?.publicUrl || "";
}

async function withDbTransaction(operation) {
  if (!dbPool) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL, SUPABASE_DB_URL, POSTGRES_URL, or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  const client = await dbPool.connect();
  const run = (text, params = []) => client.query(text, params);
  try {
    await client.query("begin");
    const result = await operation(run);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function deletePeerCounselorFromDatabase(peerCounselorId, run = query) {
  const appointmentDeleteResult = await run(
    `
      delete from public.counselor_appointments
      where peer_counselor_id = $1::uuid
    `,
    [peerCounselorId],
  );

  const peerCounselorDeleteResult = await run(
    `
      delete from public.peer_counselors
      where id = $1::uuid
      returning id, email, full_name
    `,
    [peerCounselorId],
  );

  return {
    deletedAppointmentCount: appointmentDeleteResult.rowCount || 0,
    peerCounselor: peerCounselorDeleteResult.rows[0] || null,
  };
}

async function deletePendingPeerInvitationFromDatabase(invitation) {
  const result = await query(
    `
      delete from public.peer_counselors
      where id = $1::uuid
        and invitation_token_hash = $2
      returning id, email, full_name
    `,
    [invitation.id, invitation.invitation_token_hash],
  );

  return result.rows[0] || null;
}

function getPeerInvitationActionUrl(req, token, action) {
  const baseUrl = getRequestBaseUrl(req);
  return `${baseUrl}/api/appointments/peer-counselors/invitations/${encodeURIComponent(token)}/${action}`;
}

function resolveStudentInboxRoute({ kind, metadata, title, message }) {
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const kindUpper = String(kind || "").toUpperCase();
  const storedRoute = String(meta.route || "").trim();
  const haystack = [
    kindUpper,
    String(title || ""),
    String(message || ""),
    String(meta.status || ""),
    String(meta.appointmentStatus || ""),
    String(meta.newStatus || ""),
  ].join(" ").toUpperCase();

  if (kindUpper.startsWith("FUTURE_SELF")) {
    return storedRoute || "/home";
  }

  if (
    /DISAPPROV|DECLINE|DENIED/.test(kindUpper) ||
    /DISAPPROV|DECLINE|DENIED/.test(haystack)
  ) {
    return storedRoute && storedRoute !== "/consult" ? storedRoute : "/notifications";
  }

  if (kindUpper.includes("ADMIN_MESSAGE")) {
    return "/messages";
  }

  if (kindUpper.includes("APPOINTMENT") || kindUpper.includes("CONSULT")) {
    return "/profile-settings?section=schedule";
  }

  return storedRoute && storedRoute !== "/consult" ? storedRoute : "/notifications";
}

function getAppointmentNotificationMetadata(appointment, extra = {}) {
  const supportType = normalizeSupportType(appointment?.support_type);
  const kind = extra.kind;
  const { kind: _kind, ...rest } = extra;
  const metadata = {
    appointmentId: appointment?.id || null,
    appointmentDate: normalizeDateValue(appointment?.appointment_date || appointment?.appointmentDate),
    counselorId: appointment?.counselor_id || appointment?.peer_counselor_id || null,
    counselorName: getAppointmentCounselorName(appointment),
    counselingType: appointment?.counseling_type || appointment?.counselingType || null,
    supportType,
    ...rest,
  };
  if (!Object.prototype.hasOwnProperty.call(rest, "route")) {
    metadata.route = "/profile-settings?section=schedule";
  }
  return metadata;
}

function buildAppointmentSummaryRows(appointment) {
  return [
    { label: "Client", value: appointment.student_name || appointment.student_full_name || appointment.student_number || "Student" },
    { label: "Date", value: formatDateLong(appointment.appointment_date) },
    { label: "Time", value: toReadableTime(appointment.slot_time) },
    appointment.counseling_type ? { label: "Counseling Type", value: appointment.counseling_type } : null,
    { label: "Concern", value: appointment.concern },
    { label: "Assigned Counselor", value: getAppointmentCounselorName(appointment) },
    !isPeerSupportType(appointment.support_type) && appointment.student_note
      ? { label: "Note", value: appointment.student_note }
      : null,
  ].filter(Boolean);
}

async function sendAppointmentEmail({
  to,
  subject,
  intro,
  appointment,
  ctaText = "",
  context = "appointment update",
  greeting = "",
  actionLabel = "",
  actionUrl = "",
  closingText = "",
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.APPOINTMENT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "",
  ).trim();
  const recipient = String(to || "").trim();
  const appointmentId = String(appointment?.id || "").trim();
  const logContext = appointmentId ? `${context} [appointment ${appointmentId}]` : context;

  if (!recipient) {
    console.warn(`Appointment email skipped for ${logContext}: missing recipient address.`);
    return { ok: false, skipped: true, reason: "missing-recipient" };
  }

  if (!isLikelyEmailAddress(recipient)) {
    console.warn(`Appointment email skipped for ${logContext}: invalid recipient address "${recipient}".`);
    return { ok: false, skipped: true, reason: "invalid-recipient" };
  }

  if (looksLikePlaceholderSecret(apiKey)) {
    console.warn(`Appointment email skipped for ${logContext}: RESEND_API_KEY is missing or still a placeholder.`);
    return { ok: false, skipped: true, reason: "invalid-api-key" };
  }

  if (!from) {
    console.warn(`Appointment email skipped for ${logContext}: missing sender address.`);
    return { ok: false, skipped: true, reason: "missing-sender" };
  }

  if (!isLikelyEmailAddress(from)) {
    console.warn(`Appointment email skipped for ${logContext}: invalid sender address "${from}".`);
    return { ok: false, skipped: true, reason: "invalid-sender" };
  }

  const lines = [
    greeting,
    greeting ? "" : null,
    intro,
    "",
    `Client: ${appointment.student_name || appointment.student_full_name || appointment.student_number || "Student"}`,
    `Date: ${formatDateLong(appointment.appointment_date)}`,
    `Time: ${toReadableTime(appointment.slot_time)}`,
    appointment.counseling_type ? `Counseling Type: ${appointment.counseling_type}` : "",
    `Concern: ${appointment.concern}`,
    `Assigned Counselor: ${getAppointmentCounselorName(appointment)}`,
    ctaText ? `Note: ${ctaText}` : "",
    actionLabel && actionUrl ? `${actionLabel}: ${actionUrl}` : "",
    closingText ? "" : null,
    closingText || "",
  ].filter(Boolean);

  const summaryRows = buildAppointmentSummaryRows(appointment);

  const html = `
    <div style="margin: 0; padding: 24px 12px; background: #eef6ea; font-family: Arial, sans-serif; color: #203126;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #d7e6d0; border-radius: 18px; overflow: hidden;">
        <tr>
          <td style="padding: 20px 24px; background: linear-gradient(135deg, #386641 0%, #6a994e 100%); color: #ffffff;">
            <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.88;">Bawat Tala Counseling</div>
            <div style="margin-top: 8px; font-size: 24px; line-height: 1.3; font-weight: 700;">${escapeHtml(subject)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            ${greeting ? `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7; color: #2b3d31;">${escapeHtml(greeting)}</p>` : ""}
            <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.7; color: #2b3d31;">${escapeHtml(intro)}</p>
            <div style="margin: 0 0 18px; padding: 16px 18px; border-radius: 16px; background: #f6fbf3; border: 1px solid #dbead5;">
              <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #55785e; margin-bottom: 12px;">Appointment Summary</div>
              ${summaryRows
                .map(
                  (row) => `
                    <div style="padding: 10px 0; border-top: ${row.label === "Date" ? "none" : "1px solid #dfeadc"};">
                      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6a7f70; margin-bottom: 4px;">${escapeHtml(row.label)}</div>
                      <div style="font-size: 16px; font-weight: 700; color: #22352a;">${escapeHtml(row.value)}</div>
                    </div>
                  `,
                )
                .join("")}
            </div>
            ${ctaText ? `<div style="padding: 14px 16px; border-radius: 14px; background: #fff8df; border: 1px solid #f0e0a1; color: #5b4a16; font-size: 14px; line-height: 1.6;"><strong>Next step:</strong> ${escapeHtml(ctaText)}</div>` : ""}
            ${actionLabel && actionUrl ? `<div style="margin-top: 18px;"><a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #386641; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;">${escapeHtml(actionLabel)}</a></div>` : ""}
            ${closingText ? `<p style="margin: 18px 0 0; font-size: 15px; line-height: 1.8; color: #465749; white-space: pre-line;">${escapeHtml(closingText)}</p>` : ""}
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text: lines.join("\n"),
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `Appointment email failed for ${logContext} to ${recipient}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      );
      return { ok: false, skipped: false, reason: "provider-error" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`Failed to send appointment email for ${logContext} to ${recipient}:`, error);
    return { ok: false, skipped: false, reason: "request-error" };
  }
}

async function sendPeerCounselorInvitationEmail({
  peerCounselor,
  invitedByName = "",
  acceptUrl,
  declineUrl,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.APPOINTMENT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "",
  ).trim();
  const recipient = String(peerCounselor?.email || "").trim();
  const subject = "Peer counselor invitation for Bawat Tala";
  const logContext = `peer counselor invitation [${recipient || "missing-recipient"}]`;

  if (!recipient || !isLikelyEmailAddress(recipient)) {
    console.warn(`Peer invitation email skipped for ${logContext}: invalid recipient.`);
    return { ok: false, skipped: true, reason: "invalid-recipient" };
  }
  if (looksLikePlaceholderSecret(apiKey)) {
    console.warn(`Peer invitation email skipped for ${logContext}: RESEND_API_KEY is missing or still a placeholder.`);
    return { ok: false, skipped: true, reason: "invalid-api-key" };
  }
  if (!from || !isLikelyEmailAddress(from)) {
    console.warn(`Peer invitation email skipped for ${logContext}: invalid sender address.`);
    return { ok: false, skipped: true, reason: "invalid-sender" };
  }

  const greetingName = getFirstName(peerCounselor?.full_name) || "Peer Counselor";
  const inviterLine = invitedByName ? `${invitedByName} invited you to join the Bawat Tala peer counseling team.` : "You have been invited to join the Bawat Tala peer counseling team.";
  const text = [
    `Hi ${greetingName},`,
    "",
    inviterLine,
    "Please accept or decline this invitation from this email. Accepting opens a secure page where you will upload a JPG, PNG, or WEBP profile picture under 5 MB.",
    "",
    `Accept: ${acceptUrl}`,
    `Decline: ${declineUrl}`,
    "",
    "Best regards,",
    "Bawattala Pro Team",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px 12px;background:#eef6ea;font-family:Arial,sans-serif;color:#203126;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d7e6d0;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:linear-gradient(135deg,#386641 0%,#6a994e 100%);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.88;">Bawat Tala Peer Support</div>
            <div style="margin-top:8px;font-size:24px;line-height:1.3;font-weight:700;">Peer counselor invitation</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#2b3d31;">Hi ${escapeHtml(greetingName)},</p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#2b3d31;">${escapeHtml(inviterLine)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#465749;">Please accept or decline this invitation from this email. Accepting opens a secure page where you will upload a JPG, PNG, or WEBP profile picture under 5 MB.</p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;">
              <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#386641;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accept invitation</a>
              <a href="${escapeHtml(declineUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#f8fafc;color:#475569;border:1px solid #cbd5e1;font-size:14px;font-weight:700;text-decoration:none;">Decline</a>
            </div>
            <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#64748b;">Best regards,<br/>Bawattala Pro Team</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Peer invitation email failed for ${recipient}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
      return { ok: false, skipped: false, reason: "provider-error" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`Failed to send peer invitation email for ${recipient}:`, error);
    return { ok: false, skipped: false, reason: "request-error" };
  }
}

async function findAdminByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role,
        coalesce(settings, '{}'::jsonb) as settings
      from public.admin_accounts
      where lower(email) = $1
      limit 1
    `,
    [normalizedEmail],
  );

  return result.rows[0] || null;
}

async function writeAdminActivityLog({
  actionType,
  actorEmail = "",
  actorName = "",
  actorRole = "",
  description = "",
  entityType,
  metadata = {},
  title,
}) {
  await query(
    `
      insert into public.admin_activity_logs (
        actor_email,
        actor_name,
        actor_role,
        action_type,
        entity_type,
        title,
        description,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      actorEmail || null,
      actorName || null,
      actorRole || null,
      actionType,
      entityType,
      title,
      description,
      JSON.stringify(metadata || {}),
    ],
  );
}


async function syncDueFutureSelfNotifications(studentNumber) {
  await query(
    `
      insert into public.student_notifications (
        student_number,
        kind,
        title,
        message,
        metadata
      )
      select
        m.student_number,
        'FUTURE_SELF_DELIVERED',
        'A letter from your past self arrived',
        left(m.message, 180),
        jsonb_build_object(
          'futureSelfMessageId', m.id,
          'deliveryAt', m.delivery_at,
          'route', '/home'
        )
      from public.future_self_messages m
      where m.student_number = $1
        and m.deleted_at is null
        and m.delivery_at <= now()
        and not exists (
          select 1
          from public.student_notifications n
          where n.student_number = m.student_number
            and n.kind = 'FUTURE_SELF_DELIVERED'
            and n.deleted_at is null
            and n.metadata->>'futureSelfMessageId' = m.id
        )
    `,
    [studentNumber],
  );
}

async function createStudentNotification({
  studentNumber,
  kind,
  title,
  message,
  metadata = {},
}) {
  await query(
    `
      insert into public.student_notifications (
        student_number,
        kind,
        title,
        message,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [studentNumber, kind, title, message, JSON.stringify(metadata || {})],
  );
}

async function createAdminNotification({
  adminEmail,
  kind,
  title,
  message,
  metadata = {},
}) {
  const normalizedEmail = String(adminEmail || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  await query(
    `
      insert into public.admin_notifications (
        admin_email,
        kind,
        title,
        message,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [normalizedEmail, kind, title, message, JSON.stringify(metadata || {})],
  );
}

async function listSchedulingAdmins() {
  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role
      from public.admin_accounts
      where is_active = true
        and coalesce(role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
      order by case when coalesce(role, 'COUNSELOR') = 'HEAD_COUNSELOR' then 0 else 1 end, full_name asc
    `,
  );

  return result.rows;
}

async function markAppointmentReminderSent(appointmentId, columnName) {
  const allowedColumns = new Set([
    "appointment_reminder_sent_at",
    "admin_appointment_reminder_sent_at",
    "pending_expiry_warning_sent_at",
  ]);
  if (!allowedColumns.has(columnName)) {
    throw new Error("Invalid appointment reminder column.");
  }

  await query(
    `
      update public.counselor_appointments
      set ${columnName} = coalesce(${columnName}, now()), updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );
}

async function findStudentProfileByStudentNumber(studentNumber) {
  const result = await query(
    `
      select
        student_number,
        coalesce(full_name, student_number) as full_name,
        coalesce(email, '') as email
      from public.student_profiles
      where student_number = $1
      limit 1
    `,
    [studentNumber],
  );

  return result.rows[0] || null;
}

async function ensureStudentHasNoActiveAppointmentOnDate({
  studentNumber,
  appointmentDate,
  excludeAppointmentId = "",
}) {
  const result = await query(
    `
      select id
      from public.counselor_appointments
      where student_number = $1
        and appointment_date = $2::date
        and status = any($3::text[])
        and ($4::uuid is null or id <> $4::uuid)
      limit 1
    `,
    [studentNumber, appointmentDate, ACTIVE_APPOINTMENT_STATUSES, excludeAppointmentId || null],
  );

  if (result.rowCount > 0) {
    throw new Error("This student already has an appointment request on that date.");
  }
}

async function processUpcomingConfirmedAppointmentReminders() {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.counselor_id as guidance_counselor_id,
        ca.peer_counselor_id,
        coalesce(ca.peer_counselor_id, ca.counselor_id) as counselor_id,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        ca.counseling_type,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.appointment_reminder_sent_at,
        ca.admin_appointment_reminder_sent_at,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email,
        coalesce(aa.email, pc.email) as counselor_email,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        (
          (ca.appointment_date::text || 'T' || ca.slot_time || ':00+08:00')::timestamptz
        ) as appointment_starts_at
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.status = 'CONFIRMED'
        and (
          ca.appointment_reminder_sent_at is null
          or ca.admin_appointment_reminder_sent_at is null
        )
        and (
          (ca.appointment_date::text || 'T' || ca.slot_time || ':00+08:00')::timestamptz
        ) > now()
        and (
          (ca.appointment_date::text || 'T' || ca.slot_time || ':00+08:00')::timestamptz
        ) - ($1::int * interval '1 minute') <= now()
      order by appointment_starts_at asc
    `,
    [APPOINTMENT_REMINDER_LEAD_MINUTES],
  );

  for (const row of result.rows) {
    const reminderMetadata = getAppointmentNotificationMetadata(row, {
      appointmentStartsAt: row.appointment_starts_at,
    });

    if (!row.appointment_reminder_sent_at) {
      await createStudentNotification({
        studentNumber: row.student_number,
        kind: "APPOINTMENT_REMINDER",
        title: "Appointment starts in 10 minutes",
        message: `Your session with ${row.counselor_name} is set for ${formatAppointmentDateTime(row.appointment_date, row.slot_time)}. Please be ready to meet your counselor.`,
        metadata: reminderMetadata,
      });

      await sendAppointmentEmail({
        to: row.student_email,
        subject: "Your counseling appointment starts in 10 minutes",
        intro: `Your counseling session with ${row.counselor_name} starts in about 10 minutes.`,
        appointment: row,
        ctaText: "Please head to your scheduled session and arrive a few minutes early if possible.",
        context: "student appointment reminder",
      });

      await markAppointmentReminderSent(row.id, "appointment_reminder_sent_at");
    }

    if (!row.admin_appointment_reminder_sent_at) {
      if (!isPeerSupportType(row.support_type)) {
        await createAdminNotification({
          adminEmail: row.counselor_email,
          kind: "APPOINTMENT_REMINDER",
          title: "Appointment starts in 10 minutes",
          message: `${row.student_name}'s counseling appointment starts at ${toReadableTime(row.slot_time)}. Please be ready for the scheduled session.`,
          metadata: reminderMetadata,
        });
      }

      await sendAppointmentEmail({
        to: row.counselor_email,
        subject: isPeerSupportType(row.support_type)
          ? "A peer counseling session starts in 10 minutes"
          : "A counseling appointment starts in 10 minutes",
        intro: `${row.student_name}'s ${isPeerSupportType(row.support_type) ? "peer counseling" : "counseling"} session with you starts in about 10 minutes.`,
        appointment: row,
        ctaText: "Please prepare for the scheduled counseling session.",
        context: isPeerSupportType(row.support_type) ? "peer counselor appointment reminder" : "admin appointment reminder",
      });

      await markAppointmentReminderSent(row.id, "admin_appointment_reminder_sent_at");
    }
  }

  return result.rowCount;
}

async function processPendingAppointmentExpiryWarnings() {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.counselor_id as guidance_counselor_id,
        ca.peer_counselor_id,
        coalesce(ca.peer_counselor_id, ca.counselor_id) as counselor_id,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        ca.counseling_type,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.created_at,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email,
        coalesce(aa.email, pc.email) as counselor_email,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        (ca.created_at + ($1::int * interval '1 hour')) as decision_deadline
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.status = 'PENDING'
        and ca.pending_expiry_warning_sent_at is null
        and (ca.created_at + ($1::int * interval '1 hour')) > now()
        and (ca.created_at + ($1::int * interval '1 hour')) - ($2::int * interval '1 minute') <= now()
      order by decision_deadline asc
    `,
    [APPOINTMENT_DECISION_WINDOW_HOURS, APPOINTMENT_REMINDER_LEAD_MINUTES],
  );

  for (const row of result.rows) {
    const warningMetadata = getAppointmentNotificationMetadata(row, {
      appointmentDate: normalizeDateValue(row.appointment_date),
      decisionDeadline: row.decision_deadline,
      ownerCounselorId: row.counselor_id,
      slotTime: row.slot_time,
      studentNumber: row.student_number,
    });

    if (isPeerSupportType(row.support_type)) {
      const admins = await listSchedulingAdmins();
      for (const admin of admins) {
        await createAdminNotification({
          adminEmail: admin.email,
          kind: "PEER_APPOINTMENT_PENDING_EXPIRY_WARNING",
          title: "Peer request expires in 10 minutes",
          message: `${row.student_name}'s peer counseling request for ${formatAppointmentDateTime(row.appointment_date, row.slot_time)} will auto-decline in 10 minutes unless an admin responds now.`,
          metadata: warningMetadata,
        });

        await sendAppointmentEmail({
          to: admin.email,
          subject: "Peer counseling request expires in 10 minutes",
          intro: `${row.student_name}'s peer counseling request will be automatically declined in 10 minutes unless it is confirmed, declined, or rescheduled now.`,
          appointment: row,
          ctaText: "Please open the admin scheduling panel now if you want to respond before the request expires.",
          context: "admin peer pending expiry warning",
        });
      }
    } else {
      await createAdminNotification({
        adminEmail: row.counselor_email,
        kind: "APPOINTMENT_PENDING_EXPIRY_WARNING",
        title: "Pending request expires in 10 minutes",
        message: `${row.student_name}'s request for ${formatAppointmentDateTime(row.appointment_date, row.slot_time)} will auto-decline in 10 minutes unless you respond now.`,
        metadata: warningMetadata,
      });

      await sendAppointmentEmail({
        to: row.counselor_email,
        subject: "Pending counseling request expires in 10 minutes",
        intro: `${row.student_name}'s request will be automatically declined in 10 minutes unless it is confirmed, declined, or rescheduled now.`,
        appointment: row,
        ctaText: "Please open the admin scheduling panel now if you want to respond before the request expires.",
        context: "counselor pending expiry warning",
      });
    }

    await markAppointmentReminderSent(row.id, "pending_expiry_warning_sent_at");
  }

  return result.rowCount;
}

function canManageCounselorDecision(actorAdmin, appointment) {
  if (!actorAdmin || !appointment) return false;
  const role = String(actorAdmin.role || "").toUpperCase();
  if (role === "HEAD_COUNSELOR") return true;
  if (role !== "COUNSELOR") return false;
  const adminId = actorAdmin.id;
  const adminEmail = String(actorAdmin.email || "").trim().toLowerCase();
  const assignedId = appointment.guidance_counselor_id
    || (isPeerSupportType(appointment.support_type) ? null : appointment.counselor_id);
  if (adminId && assignedId && String(adminId) === String(assignedId)) return true;
  const createdBy = String(appointment.created_by_admin_email || "").trim().toLowerCase();
  if (adminEmail && createdBy && adminEmail === createdBy) return true;
  return false;
}

function rejectUnownedAppointment(req, res, appointment) {
  if (canManageCounselorDecision(req.admin, appointment)) return false;
  res.status(403).json({ message: "You can only manage your own appointments." });
  return true;
}

function sessionActorAdmin(req) {
  return {
    id: req.admin?.id || null,
    email: String(req.admin?.email || "").trim().toLowerCase(),
    full_name: String(req.admin?.fullName || req.admin?.email || "Admin").trim(),
    role: req.admin?.role || "COUNSELOR",
  };
}

function rejectForeignAvailability(req, res, counselorId, supportType) {
  const role = String(req.admin?.role || "").toUpperCase();
  if (role === "HEAD_COUNSELOR") return false;
  const ownId = String(req.admin?.id || "");
  if (!isPeerSupportType(supportType) && ownId && String(counselorId) === ownId) return false;
  res.status(403).json({ message: "You don't have access to this action." });
  return true;
}

async function expirePendingAppointments() {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.concern,
        ca.counseling_type,
        ca.appointment_date,
        ca.slot_time,
        ca.created_at,
        ca.counselor_id as guidance_counselor_id,
        ca.peer_counselor_id,
        coalesce(ca.peer_counselor_id, ca.counselor_id) as counselor_id,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        coalesce(aa.email, pc.email) as counselor_email,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.status = 'PENDING'
        and ca.created_at <= now() - interval '24 hours'
    `,
  );

  if (result.rowCount === 0) {
    return 0;
  }

  const appointmentIds = result.rows.map((row) => row.id);
  await query(
    `
      update public.counselor_appointments
      set status = 'DECLINED', updated_at = now()
      where id = any($1::uuid[])
        and status = 'PENDING'
    `,
    [appointmentIds],
  );

  for (const row of result.rows) {
    const adminExpiryMetadata = getAppointmentNotificationMetadata(row, {
      appointmentDate: normalizeDateValue(row.appointment_date),
      ownerCounselorId: row.counselor_id,
      slotTime: row.slot_time,
      studentNumber: row.student_number,
    });
    const studentExpiryMetadata = getAppointmentNotificationMetadata(row);

    await writeAdminActivityLog({
      actionType: "APPOINTMENT_AUTO_DECLINED",
      actorEmail: "system@bawattala.local",
      actorName: "System",
      actorRole: "System",
      entityType: "APPOINTMENT",
      title: `System auto-declined ${toReadableTime(row.slot_time)}`,
      description: `${row.student_name} was auto-declined for ${row.counselor_name} on ${formatDateLong(row.appointment_date)} after no response within 24 hours.`,
      metadata: {
        appointmentId: row.id,
        appointmentDate: normalizeDateValue(row.appointment_date),
        counselorId: row.counselor_id,
        counselorName: row.counselor_name,
        ownerCounselorId: row.counselor_id,
        slotTime: row.slot_time,
        studentNumber: row.student_number,
      },
    });

    if (isPeerSupportType(row.support_type)) {
      const admins = await listSchedulingAdmins();
      for (const admin of admins) {
        await createAdminNotification({
          adminEmail: admin.email,
          kind: "PEER_APPOINTMENT_AUTO_DECLINED",
          title: "A peer request was auto-declined",
          message: `${row.student_name}'s peer counseling request for ${toReadableTime(row.slot_time)} on ${formatDateLong(row.appointment_date)} expired after 24 hours without an admin response.`,
          metadata: {
            ...adminExpiryMetadata,
            studentNumber: row.student_number,
          },
        });
      }
    } else {
      await createAdminNotification({
        adminEmail: row.counselor_email,
        kind: "APPOINTMENT_AUTO_DECLINED",
        title: "A pending appointment was auto-declined",
        message: `${row.student_name}'s request for ${toReadableTime(row.slot_time)} on ${formatDateLong(row.appointment_date)} expired after 24 hours without a response.`,
        metadata: {
          ...adminExpiryMetadata,
          studentNumber: row.student_number,
        },
      });
    }

    await createStudentNotification({
      studentNumber: row.student_number,
      kind: "APPOINTMENT_AUTO_DECLINED",
      title: "Appointment request expired",
      message: `Your appointment request for ${formatDateLong(row.appointment_date)} at ${toReadableTime(row.slot_time)} was automatically declined because no counselor response was recorded within 24 hours.`,
      metadata: studentExpiryMetadata,
    });

    await sendAppointmentEmail({
      to: row.student_email,
      subject: "Your counseling appointment request expired",
      intro: `Your appointment request with ${row.counselor_name} was automatically declined because it was not confirmed within 24 hours.`,
      appointment: row,
      ctaText: "Please open the app to request a new schedule.",
      context: "student expiry notification",
    });

    if (!isPeerSupportType(row.support_type)) {
      await sendAppointmentEmail({
        to: row.counselor_email,
        subject: "A pending counseling appointment was auto-declined",
        intro: `${row.student_name}'s pending appointment request was automatically declined after the 24-hour confirmation window expired.`,
        appointment: row,
        ctaText: "Open the admin scheduling panel if you want to offer the student a new slot.",
        context: "counselor expiry notification",
      });
    }
  }

  return result.rowCount;
}

let pendingAppointmentExpiryWorker = null;

function startPendingAppointmentExpiryWorker() {
  if (pendingAppointmentExpiryWorker) {
    return pendingAppointmentExpiryWorker;
  }

  const run = async () => {
    try {
      await processPendingAppointmentExpiryWarnings();
      await processUpcomingConfirmedAppointmentReminders();
      await expirePendingAppointments();
    } catch (error) {
      console.error("Pending appointment expiry check failed:", error?.message || error);
    }
  };

  void run();
  pendingAppointmentExpiryWorker = setInterval(run, APPOINTMENT_EXPIRY_CHECK_MS);

  if (typeof pendingAppointmentExpiryWorker?.unref === "function") {
    pendingAppointmentExpiryWorker.unref();
  }

  return pendingAppointmentExpiryWorker;
}

async function loadAppointmentContext(appointmentId) {
  const appointment = await findAppointmentById(appointmentId);
  if (!appointment) return null;
  const student = await findStudentProfileByStudentNumber(appointment.student_number);
  return {
    appointment,
    student,
  };
}

async function notifyStudentAboutAppointment({
  appointment,
  student,
  title,
  message,
  kind,
  emailSubject,
  emailIntro,
  emailCta = "",
}) {
  const studentNotificationMetadata = getAppointmentNotificationMetadata(appointment, { kind });

  await createStudentNotification({
    studentNumber: appointment.student_number,
    kind,
    title,
    message,
    metadata: studentNotificationMetadata,
  });

  if (emailSubject && emailIntro) {
    await sendAppointmentEmail({
      to: student?.email,
      subject: emailSubject,
      intro: emailIntro,
      appointment,
      ctaText: emailCta,
      context: `student notification (${kind})`,
    });
  }
}

async function notifyPeerCounselorAboutScheduledAppointment({
  appointment,
  student,
  context = "peer counselor schedule notification",
}) {
  if (!isPeerSupportType(appointment?.support_type)) {
    return;
  }

  await sendAppointmentEmail({
    to: appointment.counselor_email,
    subject: "Your peer counseling session is scheduled",
    greeting: `Hi ${getFirstName(appointment.counselor_name) || "Peer Counselor"},`,
    intro: `${student?.full_name || appointment.student_number}'s talk-to-peer session with you has been scheduled.`,
    appointment,
    ctaText: "Please be ready for the scheduled peer counseling conversation.",
    closingText: "Thank you for supporting your fellow students.\n\nBest regards,\nBawattala Pro Team",
    context,
  });
}

async function notifyPeerCounselorAboutCancelledAppointment({
  appointment,
  context = "peer counselor cancellation notification",
}) {
  if (!isPeerSupportType(appointment?.support_type)) {
    return;
  }

  await sendAppointmentEmail({
    to: appointment.counselor_email,
    subject: "Your peer counseling session was cancelled",
    greeting: `Hi ${getFirstName(appointment.counselor_name) || "Peer Counselor"},`,
    intro: `The talk-to-peer session with ${appointment.student_name || appointment.student_number} has been cancelled.`,
    appointment,
    ctaText: "No action is needed from your side.",
    closingText: "Thank you for supporting your fellow students.\n\nBest regards,\nBawattala Pro Team",
    context,
  });
}

async function notifyCounselorAboutPendingAppointment({ appointment, student }) {
  const adminWebUrl = getAdminWebUrl();
  const counselorFirstName = getFirstName(appointment.counselor_name);

  const pendingReviewMetadata = getAppointmentNotificationMetadata(appointment, {
    studentNumber: appointment.student_number,
  });

  if (isPeerSupportType(appointment.support_type)) {
    const admins = await listSchedulingAdmins();
    for (const admin of admins) {
      await createAdminNotification({
        adminEmail: admin.email,
        kind: "PEER_APPOINTMENT_PENDING_REVIEW",
        title: "New peer counseling request needs admin review",
        message: `${student?.full_name || appointment.student_number} requested ${toReadableTime(appointment.slot_time)} on ${formatDateLong(appointment.appointment_date)} with ${appointment.counselor_name}. Please confirm, decline, or reschedule within 24 hours.`,
        metadata: {
          ...pendingReviewMetadata,
          ownerCounselorId: appointment.counselor_id,
          peerCounselorId: appointment.peer_counselor_id || appointment.counselor_id,
        },
      });

      await sendAppointmentEmail({
        to: admin.email,
        subject: "New peer counseling request needs admin review",
        greeting: `Hi ${getFirstName(admin.full_name) || "Admin"},`,
        intro: "A new talk-to-peer session request is waiting for admin confirmation.",
        appointment,
        ctaText: "Please review the request and choose to confirm, reschedule, or decline the session.",
        actionLabel: "View Request",
        actionUrl: adminWebUrl,
        closingText: "Best regards,\nBawattala Pro Team",
        context: "admin peer pending request notification",
      });
    }
    return;
  }

  await createAdminNotification({
    adminEmail: appointment.counselor_email,
    kind: "APPOINTMENT_PENDING_REVIEW",
    title: "New counseling appointment needs your response",
    message: `${student?.full_name || appointment.student_number} requested ${toReadableTime(appointment.slot_time)} on ${formatDateLong(appointment.appointment_date)}. Please confirm, decline, or reschedule within 24 hours.`,
    metadata: pendingReviewMetadata,
  });

  await sendAppointmentEmail({
    to: appointment.counselor_email,
    subject: "New counseling appointment needs your response",
    greeting: `Hi ${counselorFirstName || "Counselor"},`,
    intro: "A new counseling session has been requested and is awaiting your response. Please note that this request will automatically expire if no action is taken within 24 hours.",
    appointment,
    ctaText: "Please review the request and choose to confirm, reschedule, or decline the session.",
    actionLabel: "View Request",
    actionUrl: adminWebUrl,
    closingText: "If you need any assistance, feel free to reach out.\n\nBest regards,\nBawattala Pro Team",
    context: "counselor pending request notification",
  });
}

async function ensurePendingAppointmentStillOpen(appointment) {
  if (!isPendingAppointment(appointment?.status)) {
    return true;
  }

  const decisionDeadline = getDecisionDeadlineIso(appointment.created_at);
  if (decisionDeadline && decisionDeadline <= new Date().toISOString()) {
    await expirePendingAppointments();
    return false;
  }

  return true;
}

async function ensureStudentHasNoConfirmedAppointmentOnDate({
  studentNumber,
  appointmentDate,
  excludeAppointmentId = "",
}) {
  return ensureStudentHasNoActiveAppointmentOnDate({
    studentNumber,
    appointmentDate,
    excludeAppointmentId,
  });
}

async function findAppointmentById(appointmentId) {
  const result = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.counselor_id as guidance_counselor_id,
        ca.peer_counselor_id,
        coalesce(ca.peer_counselor_id, ca.counselor_id) as counselor_id,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        ca.counseling_type,
        ca.concern,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.counselor_gender_preference,
        ca.booking_source,
        ca.created_by_admin_email,
        ca.created_at,
        ca.updated_at,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.email, '') as student_email,
        coalesce(sp.program, '') as program,
        coalesce(aa.email, pc.email) as counselor_email,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        case when coalesce(ca.support_type, 'GUIDANCE') = 'PEER' then 'PEER_COUNSELOR' else coalesce(aa.role, 'COUNSELOR') end as counselor_role,
        coalesce(aa.gender, pc.gender, 'Prefer not to say') as counselor_gender,
        coalesce(nullif(aa.profile_picture_url, ''), nullif(pc.profile_picture_url, ''), '') as counselor_picture_url,
        coalesce(pc.student_number, '') as peer_student_number,
        coalesce(pc.program, '') as peer_program
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      where ca.id = $1::uuid
      limit 1
    `,
    [appointmentId],
  );

  return result.rows[0] || null;
}

function toAppointmentResponse(row) {
  return {
    id: row.id,
    studentNumber: row.student_number,
    studentName: row.student_name || row.student_number,
    supportType: normalizeSupportType(row.support_type),
    counselingType: row.counseling_type || "",
    concern: row.concern,
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    studentNote: row.student_note || "",
    counselorGenderPreference: row.counselor_gender_preference || "No Preference",
    bookingSource: row.booking_source || "MOBILE_APP",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
    counselor: {
      id: row.counselor_id,
      fullName: row.counselor_name,
      role: toRoleLabel(row.counselor_role, row.support_type),
      gender: row.counselor_gender,
      pictureUrl: row.counselor_picture_url || "",
      studentNumber: row.peer_student_number || "",
      program: row.peer_program || "",
      supportType: normalizeSupportType(row.support_type),
    },
  };
}

async function listCounselors() {
  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role,
        coalesce(nullif(gender, ''), 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties
      from public.admin_accounts
      where is_active = true
        and coalesce(role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
      order by case when coalesce(role, 'COUNSELOR') = 'HEAD_COUNSELOR' then 0 else 1 end, full_name asc
    `,
  );

  return result.rows;
}

async function listPeerCounselors({ includeInactive = false } = {}) {
  const result = await query(
    `
      select
        id,
        email,
        full_name,
        gender,
        coalesce(student_number, '') as student_number,
        coalesce(program, '') as program,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(google_profile_picture_url, '') as google_profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties,
        coalesce(invitation_status, case when is_active then 'ACCEPTED' else 'DECLINED' end) as invitation_status,
        invitation_sent_at,
        invitation_responded_at,
        is_active,
        created_at,
        updated_at
      from public.peer_counselors
      where (
        $1::boolean = true
        or (is_active = true and coalesce(invitation_status, 'ACCEPTED') = 'ACCEPTED')
      )
      order by full_name asc
    `,
    [Boolean(includeInactive)],
  );

  return result.rows.map((row) => ({
    ...row,
    role: "PEER_COUNSELOR",
    support_type: SUPPORT_TYPE_PEER,
    profile_picture_url: row.profile_picture_url || "",
  }));
}

function getAvailabilityStorage(supportType) {
  if (isPeerSupportType(supportType)) {
    return {
      tableName: "public.peer_counselor_availability",
      idColumn: "peer_counselor_id",
    };
  }

  return {
    tableName: "public.counselor_availability",
    idColumn: "counselor_id",
  };
}

function getAppointmentAssigneeColumn(supportType) {
  return isPeerSupportType(supportType) ? "peer_counselor_id" : "counselor_id";
}

async function ensureDefaultAvailability(counselorId, supportType = SUPPORT_TYPE_GUIDANCE) {
  const { tableName, idColumn } = getAvailabilityStorage(supportType);
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    for (const slotTime of DEFAULT_SLOT_TIMES) {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, true)`);
      params.push(counselorId, dayOfWeek, slotTime);
      paramIndex += 3;
    }
  }

  await query(
    `
      insert into ${tableName} (${idColumn}, day_of_week, slot_time, is_enabled)
      values ${values.join(", ")}
      on conflict (${idColumn}, day_of_week, slot_time)
      where override_date is null
      do nothing
    `,
    params,
  );
}

async function ensureAvailabilityTemplates(supportType = SUPPORT_TYPE_GUIDANCE) {
  const counselors = isPeerSupportType(supportType)
    ? await listPeerCounselors()
    : await listCounselors();
  for (const counselor of counselors) {
    await ensureDefaultAvailability(counselor.id, supportType);
  }
  return counselors;
}

async function getAvailabilityMap(counselorId, supportType = SUPPORT_TYPE_GUIDANCE) {
  const { tableName, idColumn } = getAvailabilityStorage(supportType);
  const result = await query(
    `
      select day_of_week, slot_time, is_enabled
      from ${tableName}
      where ${idColumn} = $1
        and override_date is null
      order by day_of_week asc, slot_time asc
    `,
    [counselorId],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = `${row.day_of_week}:${row.slot_time}`;
    map.set(key, Boolean(row.is_enabled));
  }
  return map;
}

async function getAvailabilityOverrideMap(counselorId, startDate, endDate, supportType = SUPPORT_TYPE_GUIDANCE) {
  const { tableName, idColumn } = getAvailabilityStorage(supportType);
  const result = await query(
    `
      select override_date, slot_time, is_enabled
      from ${tableName}
      where ${idColumn} = $1
        and override_date is not null
        and override_date between $2::date and $3::date
      order by override_date asc, slot_time asc
    `,
    [counselorId, startDate, endDate],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = `${normalizeDateValue(row.override_date)}:${row.slot_time}`;
    map.set(key, Boolean(row.is_enabled));
  }
  return map;
}

async function getStudentBookedDateSet(studentNumber, startDate, endDate, excludeAppointmentId = "") {
  if (!studentNumber) {
    return new Set();
  }

  const result = await query(
    `
      select distinct appointment_date
      from public.counselor_appointments
      where student_number = $1
        and appointment_date between $2::date and $3::date
        and status = any($4::text[])
        and ($5::uuid is null or id <> $5::uuid)
    `,
    [studentNumber, startDate, endDate, ACTIVE_APPOINTMENT_STATUSES, excludeAppointmentId || null],
  );

  return new Set(result.rows.map((row) => normalizeDateValue(row.appointment_date)));
}

async function isCounselorSlotEnabledForDate(counselorId, isoDate, slotTime, supportType = SUPPORT_TYPE_GUIDANCE) {
  await ensureDefaultAvailability(counselorId, supportType);
  const { tableName, idColumn } = getAvailabilityStorage(supportType);
  const dayOfWeek = toDayOfWeek(isoDate);
  const result = await query(
    `
      select coalesce(
        (
          select cao.is_enabled
          from ${tableName} cao
          where cao.${idColumn} = $1
            and cao.override_date = $2::date
            and cao.slot_time = $3
          limit 1
        ),
        (
          select ca.is_enabled
          from ${tableName} ca
          where ca.${idColumn} = $1
            and ca.override_date is null
            and ca.day_of_week = $4
            and ca.slot_time = $3
          limit 1
        ),
        false
      ) as is_enabled
    `,
    [counselorId, isoDate, slotTime, dayOfWeek],
  );

  return Boolean(result.rows[0]?.is_enabled);
}

async function getBookedSlotMap(counselorId, startDate, endDate, supportType = SUPPORT_TYPE_GUIDANCE) {
  const assigneeColumn = getAppointmentAssigneeColumn(supportType);
  const result = await query(
    `
      select appointment_date, slot_time
      from public.counselor_appointments
      where ${assigneeColumn} = $1
        and support_type = $5
        and appointment_date >= $2::date
        and appointment_date <= $3::date
        and status = any($4::text[])
    `,
    [counselorId, startDate, endDate, ACTIVE_APPOINTMENT_STATUSES, normalizeSupportType(supportType)],
  );

  const booked = new Set();
  for (const row of result.rows) {
    const isoDate = normalizeDateValue(row.appointment_date);
    if (!isoDate) continue;
    booked.add(`${isoDate}:${row.slot_time}`);
  }
  return booked;
}

async function findCounselorById(counselorId) {
  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(nullif(role, ''), 'COUNSELOR') as role,
        coalesce(nullif(gender, ''), 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties
      from public.admin_accounts
      where id = $1
        and is_active = true
        and coalesce(role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
      limit 1
    `,
    [counselorId],
  );

  const row = result.rows[0];
  return row ? { ...row, support_type: SUPPORT_TYPE_GUIDANCE } : null;
}

async function findPeerCounselorById(peerCounselorId) {
  const result = await query(
    `
      select
        id,
        email,
        full_name,
        'PEER_COUNSELOR' as role,
        gender,
        coalesce(student_number, '') as student_number,
        coalesce(program, '') as program,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties,
        is_active
      from public.peer_counselors
      where id = $1
        and is_active = true
        and coalesce(invitation_status, 'ACCEPTED') = 'ACCEPTED'
      limit 1
    `,
    [peerCounselorId],
  );

  const row = result.rows[0];
  return row ? { ...row, support_type: SUPPORT_TYPE_PEER } : null;
}

async function findSupportCounselorById(counselorId, requestedSupportType = "") {
  if (isPeerSupportType(requestedSupportType)) {
    return findPeerCounselorById(counselorId);
  }

  const counselor = await findCounselorById(counselorId);
  if (counselor) return counselor;
  return findPeerCounselorById(counselorId);
}

function renderPeerInvitationResult(res, { title, message, tone = "success" }) {
  const accent = tone === "error" ? "#b42318" : tone === "warning" ? "#b7791f" : "#386641";
  return res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#eef6ea;font-family:Arial,sans-serif;color:#203126;">
        <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
          <section style="max-width:520px;width:100%;border:1px solid #d7e6d0;border-radius:22px;background:#fff;padding:28px;box-shadow:0 18px 44px rgba(32,49,38,0.12);">
            <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6a7f70;">Bawat Tala Peer Support</div>
            <h1 style="margin:12px 0 10px;font-size:28px;line-height:1.2;color:${accent};">${escapeHtml(title)}</h1>
            <p style="margin:0;font-size:16px;line-height:1.7;color:#465749;">${escapeHtml(message)}</p>
          </section>
        </main>
      </body>
    </html>
  `);
}

function renderPeerInvitationUploadForm(res, { invitation, token, req }) {
  const actionUrl = getPeerInvitationActionUrl(req, token, "accept");
  const name = invitation?.full_name || "Peer Counselor";
  return res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Accept peer counselor invitation</title>
      </head>
      <body style="margin:0;background:#eef6ea;font-family:Arial,sans-serif;color:#203126;">
        <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
          <section id="card" style="max-width:560px;width:100%;border:1px solid #d7e6d0;border-radius:22px;background:#fff;padding:28px;box-shadow:0 18px 44px rgba(32,49,38,0.12);">
            <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6a7f70;">Bawat Tala Peer Support</div>
            <h1 style="margin:12px 0 10px;font-size:28px;line-height:1.2;color:#386641;">Accept invitation</h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#465749;">Hi ${escapeHtml(getFirstName(name) || name)}, upload a profile picture to finish accepting your peer counselor invitation.</p>
            <form id="peerInviteForm">
              <label style="display:block;font-size:14px;font-weight:700;color:#203126;margin-bottom:8px;" for="profilePicture">Profile picture</label>
              <input id="profilePicture" name="profilePicture" type="file" accept="image/jpeg,image/png,image/webp" required style="display:block;width:100%;box-sizing:border-box;border:1px solid #cbd5c9;border-radius:14px;padding:12px;background:#f8fbf6;color:#203126;" />
              <p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#64748b;">JPG, PNG, or WEBP only. File must be less than 5 MB.</p>
              <div id="message" style="display:none;margin-top:16px;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.5;"></div>
              <button id="submitButton" type="submit" style="margin-top:20px;width:100%;border:0;border-radius:999px;background:#386641;color:#fff;font-size:15px;font-weight:700;padding:13px 18px;cursor:pointer;">Accept invitation</button>
            </form>
          </section>
        </main>
        <script>
          const form = document.getElementById("peerInviteForm");
          const fileInput = document.getElementById("profilePicture");
          const button = document.getElementById("submitButton");
          const messageBox = document.getElementById("message");
          const maxBytes = ${PEER_PROFILE_PICTURE_LIMIT_BYTES};
          const postUrl = ${JSON.stringify(actionUrl)};

          function showMessage(text, tone) {
            messageBox.style.display = "block";
            messageBox.textContent = text;
            if (tone === "success") {
              messageBox.style.background = "#edf7ed";
              messageBox.style.color = "#386641";
              messageBox.style.border = "1px solid #cfe8cf";
            } else {
              messageBox.style.background = "#fff1f2";
              messageBox.style.color = "#b42318";
              messageBox.style.border = "1px solid #fecdd3";
            }
          }

          function readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error("Could not read selected image."));
              reader.readAsDataURL(file);
            });
          }

          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
              showMessage("Please choose a profile picture.", "error");
              return;
            }
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              showMessage("Only JPG, PNG, or WEBP profile pictures are allowed.", "error");
              return;
            }
            if (file.size >= maxBytes) {
              showMessage("Profile picture must be less than 5 MB.", "error");
              return;
            }

            button.disabled = true;
            button.textContent = "Uploading...";
            try {
              const dataUrl = await readFileAsDataUrl(file);
              const response = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uploadedProfilePicture: {
                    dataUrl,
                    fileName: file.name,
                    contentType: file.type,
                  },
                }),
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(result.message || "Unable to accept invitation.");
              }
              form.innerHTML = '<div style="border-radius:16px;background:#edf7ed;border:1px solid #cfe8cf;padding:16px;color:#386641;font-size:15px;line-height:1.6;font-weight:700;">' + (result.message || "Invitation accepted.") + '</div>';
            } catch (error) {
              showMessage(error.message || "Unable to accept invitation.", "error");
              button.disabled = false;
              button.textContent = "Accept invitation";
            }
          });
        </script>
      </body>
    </html>
  `);
}

async function findPeerInvitationByToken(token) {
  const tokenHash = hashPeerInviteToken(token);
  const result = await query(
    `
      select
        id,
        email,
        full_name,
        gender,
        student_number,
        program,
        is_active,
        coalesce(invitation_status, case when is_active then 'ACCEPTED' else 'PENDING' end) as invitation_status,
        invitation_token_hash,
        profile_picture_url,
        google_profile_picture_url
      from public.peer_counselors
      where invitation_token_hash = $1
      limit 1
    `,
    [tokenHash],
  );
  return result.rows[0] || null;
}

async function acceptPeerInvitation({ token, profilePictureUrl = "" }) {
  const invitation = await findPeerInvitationByToken(token);
  if (!invitation) {
    return { ok: false, tone: "error", title: "Invitation not available", message: "This peer counselor invitation is invalid or has already been used." };
  }

  const currentStatus = normalizePeerInvitationStatus(invitation.invitation_status);
  if (currentStatus === "ACCEPTED") {
    await query(
      `
        update public.peer_counselors
        set invitation_token_hash = null, updated_at = now()
        where id = $1::uuid
          and invitation_token_hash = $2
      `,
      [invitation.id, invitation.invitation_token_hash],
    );
    return { ok: false, tone: "warning", title: "Invitation already accepted", message: "This invitation has already been accepted." };
  }
  if (currentStatus === "DECLINED") {
    return { ok: false, tone: "warning", title: "Invitation already declined", message: "This invitation was already declined." };
  }

  const normalizedProfilePictureUrl = normalizeCompactSpaces(profilePictureUrl);
  if (!normalizedProfilePictureUrl) {
    return { ok: false, tone: "error", title: "Profile picture required", message: "Please upload a profile picture before accepting." };
  }

  const updateResult = await query(
    `
      update public.peer_counselors
      set
        is_active = true,
        invitation_status = 'ACCEPTED',
        invitation_responded_at = now(),
        profile_picture_url = nullif($2, ''),
        google_profile_picture_url = null,
        invitation_token_hash = null,
        updated_at = now()
      where id = $1::uuid
        and invitation_token_hash = $3
      returning id, email, full_name, gender, student_number, program, profile_picture_url, google_profile_picture_url, is_active, invitation_status
    `,
    [invitation.id, normalizedProfilePictureUrl, invitation.invitation_token_hash],
  );

  const peerCounselor = updateResult.rows[0];
  if (!peerCounselor) {
    return { ok: false, tone: "error", title: "Invitation not available", message: "This peer counselor invitation has already been used." };
  }
  await ensureDefaultAvailability(peerCounselor.id, SUPPORT_TYPE_PEER);
  return {
    ok: true,
    peerCounselor,
    title: "Invitation accepted",
    message: "Thank you. You are now active as a Bawat Tala peer counselor. Future session schedules will be sent by email.",
  };
}

async function notifyAdminsAboutPeerInvitationAccepted(peerCounselor) {
  const admins = await listSchedulingAdmins();
  for (const admin of admins) {
    await createAdminNotification({
      adminEmail: admin.email,
      kind: "PEER_COUNSELOR_INVITATION_ACCEPTED",
      title: "Peer counselor invitation accepted",
      message: `${peerCounselor.full_name || peerCounselor.email} accepted the peer counselor invitation and is now active.`,
      metadata: {
        peerCounselorId: peerCounselor.id,
        peerCounselorEmail: peerCounselor.email,
        peerCounselorName: peerCounselor.full_name,
        route: "/peer-counselors",
        supportType: SUPPORT_TYPE_PEER,
      },
    });
  }
}

async function notifyAdminsAboutPeerInvitationDeclined(invitation) {
  const admins = await listSchedulingAdmins();
  for (const admin of admins) {
    await createAdminNotification({
      adminEmail: admin.email,
      kind: "PEER_COUNSELOR_INVITATION_DECLINED",
      title: "Peer counselor invitation declined",
      message: `${invitation.full_name || invitation.email} declined the peer counselor invitation.`,
      metadata: {
        peerCounselorId: invitation.id,
        peerCounselorEmail: invitation.email,
        peerCounselorName: invitation.full_name,
        route: "/peer-counselors",
        supportType: SUPPORT_TYPE_PEER,
      },
    });
  }
}

async function declinePeerInvitation(token) {
  const invitation = await findPeerInvitationByToken(token);
  if (!invitation) {
    return { ok: false, tone: "error", title: "Invitation not available", message: "This peer counselor invitation is invalid or has already been used." };
  }

  const currentStatus = normalizePeerInvitationStatus(invitation.invitation_status);
  if (currentStatus === "ACCEPTED") {
    await query(
      `
        update public.peer_counselors
        set invitation_token_hash = null, updated_at = now()
        where id = $1::uuid
          and invitation_token_hash = $2
      `,
      [invitation.id, invitation.invitation_token_hash],
    );
    return { ok: false, tone: "warning", title: "Invitation already accepted", message: "This invitation has already been accepted." };
  }
  if (currentStatus === "DECLINED") {
    await deletePendingPeerInvitationFromDatabase(invitation);
    return { ok: true, tone: "warning", title: "Invitation already declined", message: "This invitation was already declined." };
  }

  try {
    await notifyAdminsAboutPeerInvitationDeclined(invitation);
  } catch (error) {
    console.warn("Failed to notify admins about declined peer invitation:", error?.message || error);
  }
  const deletedInvitation = await deletePendingPeerInvitationFromDatabase(invitation);
  if (!deletedInvitation) {
    return { ok: false, tone: "error", title: "Invitation not available", message: "This peer counselor invitation has already been used." };
  }

  return {
    ok: true,
    tone: "warning",
    title: "Invitation declined",
    message: "Your response has been recorded, and your pending peer counselor profile was not kept.",
  };
}

router.get("/peer-counselors/invitations/:token/accept", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) {
    return renderPeerInvitationResult(res, {
      tone: "error",
      title: "Invitation not found",
      message: "This peer counselor invitation link is invalid.",
    });
  }

  const invitation = await findPeerInvitationByToken(token);
  if (!invitation) {
    return renderPeerInvitationResult(res, {
      tone: "error",
      title: "Invitation not available",
      message: "This peer counselor invitation is invalid or has already been used.",
    });
  }

  const currentStatus = normalizePeerInvitationStatus(invitation.invitation_status);
  if (currentStatus === "ACCEPTED") {
    await query(
      `
        update public.peer_counselors
        set invitation_token_hash = null, updated_at = now()
        where id = $1::uuid
          and invitation_token_hash = $2
      `,
      [invitation.id, invitation.invitation_token_hash],
    );
    return renderPeerInvitationResult(res, {
      tone: "warning",
      title: "Invitation already accepted",
      message: "This invitation has already been accepted.",
    });
  }
  if (currentStatus === "DECLINED") {
    return renderPeerInvitationResult(res, {
      tone: "warning",
      title: "Invitation already declined",
      message: "This invitation was already declined.",
    });
  }

  return renderPeerInvitationUploadForm(res, { invitation, token, req });
});

router.post("/peer-counselors/invitations/:token/accept", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) {
    return res.status(400).json({ message: "This peer counselor invitation link is invalid." });
  }

  try {
    const invitation = await findPeerInvitationByToken(token);
    if (!invitation) {
      return res.status(410).json({ message: "This peer counselor invitation is invalid or has already been used." });
    }
    const currentStatus = normalizePeerInvitationStatus(invitation.invitation_status);
    if (currentStatus !== "PENDING") {
      return res.status(410).json({ message: "This peer counselor invitation has already been used." });
    }

    const uploadedProfilePicture = parsePeerProfilePicturePayload(req.body.uploadedProfilePicture);
    const profilePictureUrl = await uploadPeerProfilePicture({
      peerCounselorId: invitation.id,
      uploadedImage: uploadedProfilePicture,
    });
    const result = await acceptPeerInvitation({ token, profilePictureUrl });
    if (!result.ok) {
      return res.status(409).json({ message: result.message || "This peer counselor invitation has already been used." });
    }
    try {
      await notifyAdminsAboutPeerInvitationAccepted(result.peerCounselor);
    } catch (error) {
      console.warn("Failed to notify admins about accepted peer invitation:", error?.message || error);
    }
    return res.json({ message: result.message || "Invitation accepted." });
  } catch (error) {
    return res.status(400).json({ message: error?.message || "Unable to accept invitation." });
  }
});

router.get("/peer-counselors/invitations/:token/decline", async (req, res) => {
  const token = String(req.params.token || "").trim();
  const result = token
    ? await declinePeerInvitation(token)
    : { tone: "error", title: "Invitation not found", message: "This peer counselor invitation link is invalid." };
  return renderPeerInvitationResult(res, result);
});

router.get("/counselors", requireStudentOrAdminAuth, async (req, res) => {
  const counselors = await ensureAvailabilityTemplates(SUPPORT_TYPE_GUIDANCE);
  const peerCounselors = await ensureAvailabilityTemplates(SUPPORT_TYPE_PEER);
  const includeCounselorEmail = Boolean(req.admin?.email);
  return res.json({
    counselors: [
      ...counselors.map((row) => ({
        id: row.id,
        ...(includeCounselorEmail ? { email: row.email } : {}),
        fullName: row.full_name,
        role: toRoleLabel(row.role, SUPPORT_TYPE_GUIDANCE),
        gender: row.gender,
        pictureUrl: row.profile_picture_url || "",
        specialties: Array.isArray(row.specialties) ? row.specialties : [],
        supportType: SUPPORT_TYPE_GUIDANCE,
      })),
      ...peerCounselors.map((row) => ({
        id: row.id,
        ...(includeCounselorEmail ? { email: row.email } : {}),
        fullName: row.full_name,
        role: toRoleLabel(row.role, SUPPORT_TYPE_PEER),
        gender: row.gender,
        pictureUrl: row.profile_picture_url || "",
        specialties: [],
        studentNumber: row.student_number || "",
        program: row.program || "",
        supportType: SUPPORT_TYPE_PEER,
      })),
    ],
    concernOptions: CONCERN_OPTIONS,
    concernSubcategories: APPOINTMENT_CONCERN_SUBCATEGORIES,
    peerConcernOptions: PEER_CONCERN_OPTIONS,
    slotTimes: DEFAULT_SLOT_TIMES.map((item) => ({
      value: item,
      label: toReadableTime(item),
    })),
  });
});

router.get("/availability", async (req, res) => {
  await expirePendingAppointments();
  const counselorId = String(req.query.counselorId || "").trim();
  const requestedSupportType = normalizeSupportType(req.query.supportType || "");
  const month = normalizeMonth(req.query.month || "");
  let studentNumber;
  try {
    studentNumber = resolveRequestStudentNumber(req);
  } catch (error) {
    if (error?.statusCode === 403) {
      return res.status(403).json({ message: "Access denied." });
    }
    throw error;
  }
  if (!counselorId || !month) {
    return res.status(400).json({ message: "Counselor and month are required." });
  }

  const counselor = await findSupportCounselorById(counselorId, requestedSupportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const supportType = normalizeSupportType(counselor.support_type);

  await ensureDefaultAvailability(counselorId, supportType);
  const availabilityMap = await getAvailabilityMap(counselorId, supportType);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const startIsoDate = `${yearText}-${monthText}-01`;
  const endIsoDate = `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`;
  const overrideMap = await getAvailabilityOverrideMap(counselorId, startIsoDate, endIsoDate, supportType);
  const bookedSlots = await getBookedSlotMap(counselorId, startIsoDate, endIsoDate, supportType);
  const studentBookedDates = await getStudentBookedDateSet(studentNumber, startIsoDate, endIsoDate);
  const todayIsoDate = getManilaDateParts().isoDate;
  const minimumStudentBookingDate = studentNumber ? getMinimumStudentBookingDate() : todayIsoDate;

  const days = Array.from({ length: lastDay }, (_, index) => {
    const dayNumber = index + 1;
    const isoDate = `${yearText}-${monthText}-${String(dayNumber).padStart(2, "0")}`;
    const dayOfWeek = toDayOfWeek(isoDate);
    const studentHasAppointmentOnDate = studentBookedDates.has(isoDate);
    const slots = DEFAULT_SLOT_TIMES.map((slotTime) => {
      const weeklyKey = `${dayOfWeek}:${slotTime}`;
      const overrideKey = `${isoDate}:${slotTime}`;
      const enabled = overrideMap.has(overrideKey)
        ? overrideMap.get(overrideKey) === true
        : availabilityMap.get(weeklyKey) === true;
      const isPast = isoDate < todayIsoDate;
      const blockedByLeadTime = studentNumber ? isoDate < minimumStudentBookingDate : false;
      const booked = bookedSlots.has(`${isoDate}:${slotTime}`);
      return {
        time: slotTime,
        label: toReadableTime(slotTime),
        available: enabled && !booked && !isPast && !studentHasAppointmentOnDate && !blockedByLeadTime,
        booked,
        blockedByLeadTime,
        enabled,
      };
    });

    return {
      blockedByLeadTime: studentNumber ? isoDate < minimumStudentBookingDate : false,
      date: isoDate,
      dayNumber,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      isPast: isoDate < todayIsoDate,
      blockedByStudentSchedule: studentHasAppointmentOnDate,
      availableSlots: slots.filter((slot) => slot.available),
      slots,
    };
  });

  return res.json({
    counselor: {
      id: counselor.id,
      fullName: counselor.full_name,
      role: toRoleLabel(counselor.role, supportType),
      gender: counselor.gender,
      pictureUrl: counselor.profile_picture_url || "",
      studentNumber: counselor.student_number || "",
      program: counselor.program || "",
      supportType,
    },
    month,
    days,
  });
});

router.post("/admin/book", async (req, res) => {
  await expirePendingAppointments();
  const studentNumber = String(req.body.studentNumber || "").trim();
  const counselorId = String(req.body.counselorId || "").trim();
  const appointmentDate = normalizeDate(req.body.appointmentDate || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const concern = normalizeConcern(req.body.concern || "");
  const studentNote = String(req.body.studentNote || "").trim();
  const rawCounselingType = String(req.body.counselingType || req.body.appointmentType || "").trim();
  const counselingType = normalizeCounselingType(rawCounselingType);
  const counselorGenderPreference = String(req.body.counselorGenderPreference || "No Preference").trim();
  const bookingSource = "ADMIN_PANEL";
  const actorEmail = String(req.admin?.email || "").trim().toLowerCase();
  const actorName = String(req.admin?.fullName || actorEmail || "Admin").trim();
  const actorRole = toRoleLabel(req.admin?.role || "COUNSELOR");
  const requestedSupportType = normalizeSupportType(req.body.supportType || "");

  if (!studentNumber || !counselorId || !appointmentDate || !slotTime || !concern) {
    return res.status(400).json({ message: "Student, counselor, concern, date, and time are required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!DEFAULT_SLOT_TIMES.includes(slotTime)) {
    return res.status(400).json({ message: "Invalid appointment time." });
  }
  if (
    String(req.admin?.role || "").toUpperCase() === "COUNSELOR"
    && String(counselorId) !== String(req.admin?.id || "")
  ) {
    return res.status(403).json({ message: "You can only manage your own appointments." });
  }

  const todayIsoDate = getManilaDateParts().isoDate;
  if (appointmentDate < todayIsoDate) {
    return res.status(400).json({ message: "You cannot book a past appointment date." });
  }

  const counselor = await findSupportCounselorById(counselorId, requestedSupportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const supportType = normalizeSupportType(counselor.support_type);
  const student = await findStudentProfileByStudentNumber(studentNumber);
  if (!student) {
    return res.status(404).json({ message: "Student number is not registered." });
  }
  if (isPeerSupportType(supportType) && !PEER_CONCERN_VALUES.has(concern)) {
    return res.status(400).json({ message: "That concern is not available for peer counseling." });
  }
  if (!isPeerSupportType(supportType) && rawCounselingType && !COUNSELING_TYPE_VALUES.has(counselingType)) {
    return res.status(400).json({ message: "Choose a valid counseling type." });
  }
  const resolvedCounselingType = isPeerSupportType(supportType) ? null : counselingType || "1-on-1";
  const resolvedStudentNote = isPeerSupportType(supportType) ? "" : studentNote;

  await ensureDefaultAvailability(counselorId, supportType);
  const isEnabled = await isCounselorSlotEnabledForDate(counselorId, appointmentDate, slotTime, supportType);
  if (!isEnabled) {
    return res.status(409).json({ message: "That time slot is not available for this counselor." });
  }

  const assigneeColumn = getAppointmentAssigneeColumn(supportType);
  const conflictResult = await query(
    `
      select id
      from public.counselor_appointments
      where ${assigneeColumn} = $1
        and support_type = $5
        and appointment_date = $2::date
        and slot_time = $3
        and status = any($4::text[])
      limit 1
    `,
    [counselorId, appointmentDate, slotTime, ACTIVE_APPOINTMENT_STATUSES, supportType],
  );

  if (conflictResult.rowCount > 0) {
    return res.status(409).json({ message: "That time slot has already been booked." });
  }

  try {
    await ensureStudentHasNoActiveAppointmentOnDate({
      studentNumber,
      appointmentDate,
    });
  } catch (error) {
    return res.status(409).json({ message: error.message || "This student already has an appointment on that date." });
  }

  const insertResult = await query(
    `
      insert into public.counselor_appointments (
        student_number,
        counselor_id,
        peer_counselor_id,
        support_type,
        counseling_type,
        concern,
        appointment_date,
        slot_time,
        status,
        student_note,
        counselor_gender_preference,
        booking_source,
        created_by_admin_email
      )
      values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13)
      returning id, student_number, counseling_type, concern, appointment_date, slot_time, status, student_note, counselor_gender_preference, booking_source, created_by_admin_email, created_at
    `,
    [
      studentNumber,
      isPeerSupportType(supportType) ? null : counselorId,
      isPeerSupportType(supportType) ? counselorId : null,
      supportType,
      resolvedCounselingType,
      concern,
      appointmentDate,
      slotTime,
      "CONFIRMED",
      resolvedStudentNote || null,
      counselorGenderPreference || null,
      bookingSource,
      actorEmail || null,
    ],
  );

  const appointment = insertResult.rows[0];
  const fullAppointment = await findAppointmentById(appointment.id);
  await writeAdminActivityLog({
    actionType: "APPOINTMENT_CREATED",
    actorEmail: actorEmail,
    actorName: actorName,
    actorRole: actorRole,
    entityType: "APPOINTMENT",
    title: `${actorName} created ${toReadableTime(appointment.slot_time)}`,
    description: `${studentNumber} scheduled with ${counselor.full_name} on ${formatDateLong(appointment.appointment_date)}`,
    metadata: {
      appointmentId: appointment.id,
      appointmentDate,
      actorAdminId: req.admin?.id || null,
      counselorId,
      counselorName: counselor.full_name,
      ownerCounselorId: counselorId,
      supportType,
      slotTime,
      studentNumber,
    },
  });

  if (fullAppointment) {
    await notifyStudentAboutAppointment({
      appointment: fullAppointment,
      student,
      kind: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      message: resolvedStudentNote
        ? `Your session with ${counselor.full_name} is set for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)}. Note from guidance: ${resolvedStudentNote}`
        : `Your session with ${counselor.full_name} is set for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)}.`,
      emailSubject: "Your counseling appointment is confirmed",
      emailIntro: `Your counseling appointment with ${counselor.full_name} has been confirmed.`,
      emailCta: resolvedStudentNote
        ? `Please arrive a few minutes early for your session. Note from guidance: ${resolvedStudentNote}`
        : "Please arrive a few minutes early for your session.",
    });
    if (isPeerSupportType(supportType)) {
      await notifyPeerCounselorAboutScheduledAppointment({
        appointment: fullAppointment,
        student,
        context: "peer counselor admin-created appointment notification",
      });
    }
  }

  return res.status(201).json({
    message: "Appointment confirmed.",
    appointment: {
      id: appointment.id,
      studentNumber: appointment.student_number,
      counselingType: appointment.counseling_type || "",
      concern: appointment.concern,
      appointmentDate: appointment.appointment_date,
      appointmentDateLabel: formatDateLong(appointment.appointment_date),
      slotTime: appointment.slot_time,
      slotLabel: toReadableTime(appointment.slot_time),
      status: appointment.status,
      studentNote: appointment.student_note || "",
      supportType,
      counselorGenderPreference: appointment.counselor_gender_preference || "No Preference",
      bookingSource: appointment.booking_source || bookingSource,
      counselor: {
        id: counselor.id,
        fullName: counselor.full_name,
        role: toRoleLabel(counselor.role, supportType),
        gender: counselor.gender,
        pictureUrl: counselor.profile_picture_url || "",
        studentNumber: counselor.student_number || "",
        program: counselor.program || "",
        supportType,
      },
      decisionDueAt: getDecisionDeadlineIso(appointment.created_at),
    },
  });
});

router.post("/book", requireStudentOnlyAuth, async (req, res) => {
  await expirePendingAppointments();
  const studentNumber = resolveRequestStudentNumber(req);
  const counselorId = String(req.body.counselorId || "").trim();
  const appointmentDate = normalizeDate(req.body.appointmentDate || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const concern = normalizeConcern(req.body.concern || "");
  const studentNote = String(req.body.studentNote || "").trim();
  const rawCounselingType = String(req.body.counselingType || req.body.appointmentType || "").trim();
  const counselingType = normalizeCounselingType(rawCounselingType);
  const counselorGenderPreference = String(req.body.counselorGenderPreference || "No Preference").trim();
  const bookingSource = String(req.body.bookingSource || "MOBILE_APP").trim().toUpperCase();
  const actorEmail = String(req.body.actorEmail || "").trim().toLowerCase();
  const requestedSupportType = normalizeSupportType(req.body.supportType || "");

  if (!studentNumber || !counselorId || !appointmentDate || !slotTime || !concern) {
    return res.status(400).json({ message: "Student, counselor, concern, date, and time are required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!DEFAULT_SLOT_TIMES.includes(slotTime)) {
    return res.status(400).json({ message: "Invalid appointment time." });
  }
  if (!BOOKING_SOURCES.has(bookingSource)) {
    return res.status(400).json({ message: "Invalid booking source." });
  }

  const todayIsoDate = getManilaDateParts().isoDate;
  if (appointmentDate < todayIsoDate) {
    return res.status(400).json({ message: "You cannot book a past appointment date." });
  }
  if (appointmentDate < getMinimumStudentBookingDate()) {
    return res.status(400).json({
      message: `Appointments must be booked at least ${MOBILE_BOOKING_LEAD_DAYS} days ahead.`,
    });
  }

  const counselor = await findSupportCounselorById(counselorId, requestedSupportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const supportType = normalizeSupportType(counselor.support_type);
  const student = await findStudentProfileByStudentNumber(studentNumber);
  if (!student) {
    return res.status(404).json({ message: "Student number is not registered." });
  }
  if (isPeerSupportType(supportType) && !PEER_CONCERN_VALUES.has(concern)) {
    return res.status(400).json({ message: "That concern is not available for peer counseling." });
  }
  if (!isPeerSupportType(supportType) && rawCounselingType && !COUNSELING_TYPE_VALUES.has(counselingType)) {
    return res.status(400).json({ message: "Choose a valid counseling type." });
  }
  const resolvedCounselingType = isPeerSupportType(supportType) ? null : counselingType || "1-on-1";
  const resolvedStudentNote = isPeerSupportType(supportType) ? "" : studentNote;

  await ensureDefaultAvailability(counselorId, supportType);
  const isEnabled = await isCounselorSlotEnabledForDate(counselorId, appointmentDate, slotTime, supportType);
  if (!isEnabled) {
    return res.status(409).json({ message: "That time slot is not available for this counselor." });
  }

  const assigneeColumn = getAppointmentAssigneeColumn(supportType);
  const conflictResult = await query(
    `
      select id
      from public.counselor_appointments
      where ${assigneeColumn} = $1
        and support_type = $5
        and appointment_date = $2::date
        and slot_time = $3
        and status = any($4::text[])
      limit 1
    `,
    [counselorId, appointmentDate, slotTime, ACTIVE_APPOINTMENT_STATUSES, supportType],
  );

  if (conflictResult.rowCount > 0) {
    return res.status(409).json({ message: "That time slot has already been booked." });
  }

  const actorAdmin = bookingSource === "ADMIN_PANEL" ? await findAdminByEmail(actorEmail) : null;

  try {
    await ensureStudentHasNoActiveAppointmentOnDate({
      studentNumber,
      appointmentDate,
    });
  } catch (error) {
    return res.status(409).json({ message: error.message || "This student already has an appointment on that date." });
  }

  const insertResult = await query(
    `
      insert into public.counselor_appointments (
        student_number,
        counselor_id,
        peer_counselor_id,
        support_type,
        counseling_type,
        concern,
        appointment_date,
        slot_time,
        status,
        student_note,
        counselor_gender_preference,
        booking_source,
        created_by_admin_email
      )
      values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13)
      returning id, student_number, counseling_type, concern, appointment_date, slot_time, status, student_note, counselor_gender_preference, booking_source, created_by_admin_email, created_at
    `,
    [
      studentNumber,
      isPeerSupportType(supportType) ? null : counselorId,
      isPeerSupportType(supportType) ? counselorId : null,
      supportType,
      resolvedCounselingType,
      concern,
      appointmentDate,
      slotTime,
      bookingSource === "ADMIN_PANEL" ? "CONFIRMED" : "PENDING",
      resolvedStudentNote || null,
      counselorGenderPreference || null,
      bookingSource,
      actorAdmin?.email || null,
    ],
  );

  const appointment = insertResult.rows[0];
  const fullAppointment = await findAppointmentById(appointment.id);
  if (bookingSource === "ADMIN_PANEL") {
    await writeAdminActivityLog({
      actionType: "APPOINTMENT_CREATED",
      actorEmail: actorAdmin?.email || actorEmail,
      actorName: actorAdmin?.full_name || actorEmail || "Admin",
      actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
      entityType: "APPOINTMENT",
      title: `${actorAdmin?.full_name || actorEmail || "Admin"} created ${toReadableTime(appointment.slot_time)}`,
      description: `${studentNumber} scheduled with ${counselor.full_name} on ${formatDateLong(appointment.appointment_date)}`,
      metadata: {
        appointmentId: appointment.id,
        appointmentDate,
        actorAdminId: actorAdmin?.id || null,
        counselorId,
        counselorName: counselor.full_name,
        ownerCounselorId: counselorId,
        supportType,
        slotTime,
        studentNumber,
      },
    });
  }

  if (bookingSource === "ADMIN_PANEL" && fullAppointment) {
    await notifyStudentAboutAppointment({
      appointment: fullAppointment,
      student,
      kind: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      message: resolvedStudentNote
        ? `Your session with ${counselor.full_name} is set for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)}. Note from guidance: ${resolvedStudentNote}`
        : `Your session with ${counselor.full_name} is set for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)}.`,
      emailSubject: "Your counseling appointment is confirmed",
      emailIntro: `Your counseling appointment with ${counselor.full_name} has been confirmed.`,
      emailCta: resolvedStudentNote
        ? `Please arrive a few minutes early for your session. Note from guidance: ${resolvedStudentNote}`
        : "Please arrive a few minutes early for your session.",
    });
    if (isPeerSupportType(supportType)) {
      await notifyPeerCounselorAboutScheduledAppointment({
        appointment: fullAppointment,
        student,
        context: "peer counselor admin-created appointment notification",
      });
    }
  }

  if (bookingSource === "MOBILE_APP" && fullAppointment) {
    await notifyStudentAboutAppointment({
      appointment: fullAppointment,
      student,
      kind: "APPOINTMENT_PENDING",
      title: "Appointment request submitted",
      message: `Your request with ${counselor.full_name} for ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)} is pending counselor confirmation within 24 hours.`,
    });
    await notifyCounselorAboutPendingAppointment({
      appointment: fullAppointment,
      student,
    });
  }

  return res.status(201).json({
    message: bookingSource === "ADMIN_PANEL" ? "Appointment confirmed." : "Appointment request submitted.",
    appointment: {
      id: appointment.id,
      studentNumber: appointment.student_number,
      counselingType: appointment.counseling_type || "",
      concern: appointment.concern,
      appointmentDate: appointment.appointment_date,
      appointmentDateLabel: formatDateLong(appointment.appointment_date),
      slotTime: appointment.slot_time,
      slotLabel: toReadableTime(appointment.slot_time),
      status: appointment.status,
      studentNote: appointment.student_note || "",
      supportType,
      counselorGenderPreference: appointment.counselor_gender_preference || "No Preference",
      bookingSource: appointment.booking_source || bookingSource,
      counselor: {
        id: counselor.id,
        fullName: counselor.full_name,
        role: toRoleLabel(counselor.role, supportType),
        gender: counselor.gender,
        pictureUrl: counselor.profile_picture_url || "",
        studentNumber: counselor.student_number || "",
        program: counselor.program || "",
        supportType,
      },
      decisionDueAt: getDecisionDeadlineIso(appointment.created_at),
    },
  });
});

router.post("/admin/:appointmentId/update", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const studentNumber = String(req.body.studentNumber || "").trim();
  const counselorId = String(req.body.counselorId || "").trim();
  const appointmentDate = normalizeDate(req.body.appointmentDate || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const concern = normalizeConcern(req.body.concern || "");
  const studentNote = String(req.body.studentNote || "").trim();
  const rawCounselingType = String(req.body.counselingType || req.body.appointmentType || "").trim();
  const counselingType = normalizeCounselingType(rawCounselingType);
  const counselorGenderPreference = String(req.body.counselorGenderPreference || "No Preference").trim();
  const requestedSupportType = normalizeSupportType(req.body.supportType || "");
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!appointmentId || !studentNumber || !counselorId || !appointmentDate || !slotTime || !concern) {
    return res.status(400).json({ message: "Student, counselor, concern, date, and time are required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!DEFAULT_SLOT_TIMES.includes(slotTime)) {
    return res.status(400).json({ message: "Invalid appointment time." });
  }
  if (appointmentDate < getManilaDateParts().isoDate) {
    return res.status(400).json({ message: "You cannot move an appointment to a past date." });
  }
  if (appointmentDate < getMinimumStudentBookingDate()) {
    return res.status(400).json({
      message: `Appointments must be booked at least ${MOBILE_BOOKING_LEAD_DAYS} days ahead so counselors have 24 hours to respond.`,
    });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (rejectUnownedAppointment(req, res, existingAppointment)) return;

  const counselor = await findSupportCounselorById(counselorId, requestedSupportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const supportType = normalizeSupportType(counselor.support_type);
  if (
    String(req.admin?.role || "").toUpperCase() === "COUNSELOR"
    && !isPeerSupportType(supportType)
    && String(counselorId) !== String(req.admin?.id || "")
  ) {
    return res.status(403).json({ message: "You can only manage your own appointments." });
  }
  const student = await findStudentProfileByStudentNumber(studentNumber);
  if (!student) {
    return res.status(404).json({ message: "Student number is not registered." });
  }
  if (isPeerSupportType(supportType) && !PEER_CONCERN_VALUES.has(concern)) {
    return res.status(400).json({ message: "That concern is not available for peer counseling." });
  }
  if (!isPeerSupportType(supportType) && rawCounselingType && !COUNSELING_TYPE_VALUES.has(counselingType)) {
    return res.status(400).json({ message: "Choose a valid counseling type." });
  }
  const resolvedCounselingType = isPeerSupportType(supportType)
    ? null
    : counselingType || existingAppointment.counseling_type || "1-on-1";
  const resolvedStudentNote = isPeerSupportType(supportType) ? "" : studentNote;

  await ensureDefaultAvailability(counselorId, supportType);
  const isEnabled = await isCounselorSlotEnabledForDate(counselorId, appointmentDate, slotTime, supportType);
  if (!isEnabled) {
    return res.status(409).json({ message: "That time slot is not available for this counselor." });
  }

  const assigneeColumn = getAppointmentAssigneeColumn(supportType);
  const conflictResult = await query(
    `
      select id
      from public.counselor_appointments
      where ${assigneeColumn} = $1
        and support_type = $6
        and appointment_date = $2::date
        and slot_time = $3
        and status = any($5::text[])
        and id <> $4::uuid
      limit 1
    `,
    [counselorId, appointmentDate, slotTime, appointmentId, ACTIVE_APPOINTMENT_STATUSES, supportType],
  );

  if (conflictResult.rowCount > 0) {
    return res.status(409).json({ message: "That time slot has already been booked." });
  }

  try {
    await ensureStudentHasNoActiveAppointmentOnDate({
      studentNumber,
      appointmentDate,
      excludeAppointmentId: appointmentId,
    });
  } catch (error) {
    return res.status(409).json({ message: error.message || "This student already has an appointment on that date." });
  }

  const actorCanManageDecision = canManageCounselorDecision(actorAdmin, existingAppointment);
  const isRescheduledRequestState =
    isPendingAppointment(existingAppointment.status) ||
    String(existingAppointment.status || "").toUpperCase() === "DECLINED";
  const nextStatus = isRescheduledRequestState && actorCanManageDecision
    ? "CONFIRMED"
    : existingAppointment.status;
  const updateResult = await query(
    `
      update public.counselor_appointments
      set
        student_number = $2,
        counselor_id = $3,
        peer_counselor_id = $4,
        support_type = $5,
        counseling_type = $6,
        concern = $7,
        appointment_date = $8::date,
        slot_time = $9,
        status = $10,
        student_note = $11,
        counselor_gender_preference = $12,
        updated_at = now()
      where id = $1::uuid
      returning id
    `,
    [
      appointmentId,
      studentNumber,
      isPeerSupportType(supportType) ? null : counselorId,
      isPeerSupportType(supportType) ? counselorId : null,
      supportType,
      resolvedCounselingType,
      concern,
      appointmentDate,
      slotTime,
      nextStatus,
      resolvedStudentNote || null,
      counselorGenderPreference || null,
    ],
  );

  const updatedAppointment = updateResult.rows[0] ? await findAppointmentById(updateResult.rows[0].id) : null;
  if (!updatedAppointment) {
    return res.status(404).json({ message: "Appointment not found after update." });
  }

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} updated ${toReadableTime(updatedAppointment.slot_time)}`,
    description: `${studentNumber} rescheduled with ${counselor.full_name} on ${formatDateLong(updatedAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate,
      counselorId,
      counselorName: counselor.full_name,
      ownerCounselorId: counselorId,
      previousAppointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      previousCounselorId: existingAppointment.counselor_id,
      previousSupportType: existingAppointment.support_type,
      supportType,
      previousSlotTime: existingAppointment.slot_time,
      slotTime,
      studentNumber,
    },
  });

  await notifyStudentAboutAppointment({
    appointment: updatedAppointment,
    student,
    kind: nextStatus === "CONFIRMED" && isRescheduledRequestState ? "APPOINTMENT_CONFIRMED" : "APPOINTMENT_UPDATED",
    title: nextStatus === "CONFIRMED" && isRescheduledRequestState ? "Appointment rescheduled and confirmed" : "Appointment updated",
    message:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? resolvedStudentNote
          ? `Your counselor moved your session to ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)}. The new schedule is already confirmed. Note from guidance: ${resolvedStudentNote}`
          : `Your counselor moved your session to ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)}. The new schedule is already confirmed.`
        : resolvedStudentNote
          ? `Your session is now on ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)} with ${counselor.full_name}. Note from guidance: ${resolvedStudentNote}`
          : `Your session is now on ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)} with ${counselor.full_name}.`,
    emailSubject:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? "Your counseling appointment was rescheduled and confirmed"
        : "Your counseling appointment was updated",
    emailIntro:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? `${counselor.full_name} rescheduled your appointment and confirmed the new time.`
        : `${counselor.full_name} updated your counseling appointment.`,
    emailCta:
      nextStatus === "CONFIRMED" && isRescheduledRequestState
        ? resolvedStudentNote
          ? `Please review the updated confirmed schedule in the app. Note from guidance: ${resolvedStudentNote}`
          : "Please review the updated confirmed schedule in the app."
        : resolvedStudentNote
          ? `Please review the new schedule details in the app. Note from guidance: ${resolvedStudentNote}`
          : "Please review the new schedule details in the app.",
  });

  if (isPeerSupportType(supportType) && nextStatus === "CONFIRMED") {
    await notifyPeerCounselorAboutScheduledAppointment({
      appointment: updatedAppointment,
      student,
      context: "peer counselor updated schedule notification",
    });
  }

  return res.json({
    message: "Appointment updated.",
    appointment: toAppointmentResponse(updatedAppointment),
  });
});

router.post("/admin/:appointmentId/confirm", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const context = await loadAppointmentContext(appointmentId);
  if (!context?.appointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (rejectUnownedAppointment(req, res, context.appointment)) return;
  if (!(await ensurePendingAppointmentStillOpen(context.appointment))) {
    return res.status(409).json({ message: "This appointment request already expired and was auto-declined." });
  }
  if (!isPendingAppointment(context.appointment.status)) {
    return res.status(409).json({ message: "Only pending appointment requests can be confirmed." });
  }

  await query(
    `
      update public.counselor_appointments
      set status = 'CONFIRMED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  const updatedAppointment = await findAppointmentById(appointmentId);
  await writeAdminActivityLog({
    actionType: "APPOINTMENT_CONFIRMED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Counselor",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || "Counselor"} confirmed ${toReadableTime(context.appointment.slot_time)}`,
    description: `${context.appointment.student_name} was confirmed with ${context.appointment.counselor_name} on ${formatDateLong(context.appointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(context.appointment.appointment_date),
      counselorId: context.appointment.counselor_id,
      counselorName: context.appointment.counselor_name,
      ownerCounselorId: context.appointment.counselor_id,
      supportType: context.appointment.support_type,
      slotTime: context.appointment.slot_time,
      studentNumber: context.appointment.student_number,
    },
  });

  if (updatedAppointment) {
    await notifyStudentAboutAppointment({
      appointment: updatedAppointment,
      student: context.student,
      kind: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      message: `Your session with ${updatedAppointment.counselor_name} is confirmed for ${formatDateLong(updatedAppointment.appointment_date)} at ${toReadableTime(updatedAppointment.slot_time)}.`,
      emailSubject: "Your counseling appointment is confirmed",
      emailIntro: `${updatedAppointment.counselor_name} confirmed your counseling appointment.`,
      emailCta: "Please arrive a few minutes early for your session.",
    });
    if (isPeerSupportType(updatedAppointment.support_type)) {
      await notifyPeerCounselorAboutScheduledAppointment({
        appointment: updatedAppointment,
        student: context.student,
        context: "peer counselor confirmed schedule notification",
      });
    }
  }

  return res.json({
    message: "Appointment confirmed.",
    appointment: updatedAppointment ? toAppointmentResponse(updatedAppointment) : null,
  });
});

router.post("/admin/:appointmentId/decline", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const context = await loadAppointmentContext(appointmentId);
  if (!context?.appointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (rejectUnownedAppointment(req, res, context.appointment)) return;
  if (!(await ensurePendingAppointmentStillOpen(context.appointment))) {
    return res.status(409).json({ message: "This appointment request already expired and was auto-declined." });
  }
  if (!isPendingAppointment(context.appointment.status)) {
    return res.status(409).json({ message: "Only pending appointment requests can be declined." });
  }

  await query(
    `
      update public.counselor_appointments
      set status = 'DECLINED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_DECLINED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Counselor",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || "Counselor"} declined ${toReadableTime(context.appointment.slot_time)}`,
    description: `${context.appointment.student_name}'s request with ${context.appointment.counselor_name} on ${formatDateLong(context.appointment.appointment_date)} was declined.`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(context.appointment.appointment_date),
      counselorId: context.appointment.counselor_id,
      counselorName: context.appointment.counselor_name,
      ownerCounselorId: context.appointment.counselor_id,
      supportType: context.appointment.support_type,
      slotTime: context.appointment.slot_time,
      studentNumber: context.appointment.student_number,
    },
  });

  await notifyStudentAboutAppointment({
    appointment: context.appointment,
    student: context.student,
    kind: "APPOINTMENT_DECLINED",
    title: "Appointment declined",
    message: `Your appointment request for ${formatDateLong(context.appointment.appointment_date)} at ${toReadableTime(context.appointment.slot_time)} was declined. Your counselor can still offer a different time later.`,
    emailSubject: "Your counseling appointment request was declined",
    emailIntro: `${context.appointment.counselor_name} declined your counseling appointment request.`,
    emailCta: "Please open the app if you want to request a different schedule.",
  });

  return res.json({
    message: "Appointment declined.",
  });
});

router.post("/admin/:appointmentId/cancel", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;
  const cancellationReason = String(req.body.cancellationReason || "").trim();

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (rejectUnownedAppointment(req, res, existingAppointment)) return;

  const actorAccount = await findAdminByEmail(actorEmail);
  const requiresCancelReason = actorAccount?.settings?.privacy?.requireCancelReason !== false;
  if (requiresCancelReason && !cancellationReason) {
    return res.status(400).json({ message: "Cancellation reason is required." });
  }

  await query(
    `
      update public.counselor_appointments
      set status = 'CANCELLED', updated_at = now()
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_CANCELLED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} cancelled ${toReadableTime(existingAppointment.slot_time)}`,
    description: cancellationReason
      ? `${existingAppointment.student_number} cancelled with ${existingAppointment.counselor_name} on ${formatDateLong(existingAppointment.appointment_date)}. Reason: ${cancellationReason}`
      : `${existingAppointment.student_number} cancelled with ${existingAppointment.counselor_name} on ${formatDateLong(existingAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
      ownerCounselorId: existingAppointment.counselor_id,
      supportType: existingAppointment.support_type,
      slotTime: existingAppointment.slot_time,
      studentNumber: existingAppointment.student_number,
      cancellationReason,
    },
  });

  await createStudentNotification({
    studentNumber: existingAppointment.student_number,
    kind: "APPOINTMENT_CANCELLED",
    title: "Appointment cancelled",
    message: `Your session on ${formatDateLong(existingAppointment.appointment_date)} at ${toReadableTime(existingAppointment.slot_time)} has been cancelled.`,
    metadata: getAppointmentNotificationMetadata(existingAppointment, {
      appointmentId,
      cancellationReason,
    }),
  });
  await notifyPeerCounselorAboutCancelledAppointment({
    appointment: existingAppointment,
    context: "peer counselor cancelled appointment notification",
  });

  return res.json({
    message: "Appointment cancelled.",
  });
});

router.delete("/admin/:appointmentId", async (req, res) => {
  await expirePendingAppointments();
  const appointmentId = String(req.params.appointmentId || "").trim();
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment id is required." });
  }

  const existingAppointment = await findAppointmentById(appointmentId);
  if (!existingAppointment) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (rejectUnownedAppointment(req, res, existingAppointment)) return;
  await query(
    `
      delete from public.counselor_appointments
      where id = $1::uuid
    `,
    [appointmentId],
  );

  await writeAdminActivityLog({
    actionType: "APPOINTMENT_DELETED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "APPOINTMENT",
    title: `${actorAdmin?.full_name || actorEmail || "Admin"} deleted ${toReadableTime(existingAppointment.slot_time)}`,
    description: `${existingAppointment.student_number} removed from ${existingAppointment.counselor_name} on ${formatDateLong(existingAppointment.appointment_date)}`,
    metadata: {
      actorAdminId: actorAdmin?.id || null,
      appointmentId,
      appointmentDate: normalizeDateValue(existingAppointment.appointment_date),
      counselorId: existingAppointment.counselor_id,
      counselorName: existingAppointment.counselor_name,
      ownerCounselorId: existingAppointment.counselor_id,
      supportType: existingAppointment.support_type,
      slotTime: existingAppointment.slot_time,
      studentNumber: existingAppointment.student_number,
    },
  });

  await createStudentNotification({
    studentNumber: existingAppointment.student_number,
    kind: "APPOINTMENT_DELETED",
    title: "Appointment removed",
    message: `Your session on ${formatDateLong(existingAppointment.appointment_date)} at ${toReadableTime(existingAppointment.slot_time)} has been removed.`,
    metadata: getAppointmentNotificationMetadata(existingAppointment, {
      appointmentId,
    }),
  });
  await notifyPeerCounselorAboutCancelledAppointment({
    appointment: existingAppointment,
    context: "peer counselor deleted appointment notification",
  });

  return res.json({
    message: "Appointment deleted.",
  });
});

router.get("/student", requireStudentOnlyAuth, async (req, res) => {
  await expirePendingAppointments();
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  const result = await query(
    `
      select
        ca.id,
        ca.concern,
        ca.counseling_type,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.booking_source,
        ca.created_at,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        case when coalesce(ca.support_type, 'GUIDANCE') = 'PEER' then 'PEER_COUNSELOR' else coalesce(aa.role, 'COUNSELOR') end as counselor_role,
        coalesce(aa.gender, pc.gender, 'Prefer not to say') as counselor_gender,
        coalesce(nullif(aa.profile_picture_url, ''), nullif(pc.profile_picture_url, ''), '') as counselor_picture_url,
        coalesce(pc.student_number, '') as peer_student_number,
        coalesce(pc.program, '') as peer_program
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      where ca.student_number = $1
      order by ca.appointment_date desc, ca.slot_time desc
      limit 60
    `,
    [studentNumber],
  );
  const countResult = await query(
    `
      select count(*)::int as total_count
      from public.counselor_appointments
      where student_number = $1
    `,
    [studentNumber],
  );

  const appointments = result.rows.map((row) => ({
    id: row.id,
    concern: row.concern,
    counselingType: row.counseling_type || "",
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    studentNote: row.student_note || "",
    supportType: normalizeSupportType(row.support_type),
    bookingSource: row.booking_source || "MOBILE_APP",
    createdAt: row.created_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
    counselor: {
      fullName: row.counselor_name,
      role: toRoleLabel(row.counselor_role, row.support_type),
      gender: row.counselor_gender,
      pictureUrl: row.counselor_picture_url || "",
      studentNumber: row.peer_student_number || "",
      program: row.peer_program || "",
      supportType: normalizeSupportType(row.support_type),
    },
  }));

  const upcomingAppointment =
    appointments
      .filter((item) => isActiveAppointmentStatus(item.status) && item.appointmentDate >= getManilaDateParts().isoDate)
      .sort((a, b) =>
        `${a.appointmentDate} ${a.slotTime}`.localeCompare(`${b.appointmentDate} ${b.slotTime}`),
      )[0] || null;

  return res.json({
    appointments,
    upcomingAppointment,
    today: getManilaDateParts().isoDate,
    todayIsoDate: getManilaDateParts().isoDate,
    totalCount: Number(countResult.rows[0]?.total_count || appointments.length),
  });
});

router.get("/admin/overview", async (req, res) => {
  await expirePendingAppointments();
  const selectedDate = normalizeDate(req.query.date || "") || getManilaDateParts().isoDate;
  const supportType = normalizeSupportType(req.query.supportType || SUPPORT_TYPE_GUIDANCE);
  const monthKey = `${selectedDate.slice(0, 7)}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(new Date(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
  const counselors = await ensureAvailabilityTemplates(supportType);
  const { tableName: availabilityTableName, idColumn: availabilityIdColumn } = getAvailabilityStorage(supportType);
  const availabilityRows = await query(
    `
      select ${availabilityIdColumn} as counselor_id, day_of_week, slot_time, is_enabled
      from ${availabilityTableName}
      where override_date is null
      order by counselor_id asc, day_of_week asc, slot_time asc
    `,
  );
  const availabilityOverrideRows = await query(
    `
      select ${availabilityIdColumn} as counselor_id, override_date, slot_time, is_enabled
      from ${availabilityTableName}
      where override_date between $1::date and $2::date
      order by counselor_id asc, override_date asc, slot_time asc
    `,
    [monthStart, monthEnd],
  );
  const appointmentRows = await query(
    `
      select
        ca.id,
        ca.student_number,
        ca.concern,
        ca.counseling_type,
        ca.appointment_date,
        ca.slot_time,
        ca.status,
        ca.student_note,
        ca.counselor_gender_preference,
        ca.booking_source,
        ca.created_by_admin_email,
        coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
        coalesce(sp.full_name, ca.student_number) as student_name,
        coalesce(sp.program, '') as program,
        coalesce(pc.id, aa.id) as counselor_id,
        coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name,
        case when coalesce(ca.support_type, 'GUIDANCE') = 'PEER' then 'PEER_COUNSELOR' else coalesce(aa.role, 'COUNSELOR') end as counselor_role,
        coalesce(pc.student_number, '') as peer_student_number,
        coalesce(pc.program, '') as peer_program,
        coalesce(nullif(creator.full_name, ''), split_part(creator.email, '@', 1), ca.created_by_admin_email, '') as created_by_admin_name,
        coalesce(creator.role, 'COUNSELOR') as created_by_admin_role,
        ca.created_at
      from public.counselor_appointments ca
      left join public.admin_accounts aa on aa.id = ca.counselor_id
      left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
      left join public.student_profiles sp on sp.student_number = ca.student_number
      left join public.admin_accounts creator on lower(creator.email) = lower(ca.created_by_admin_email)
      where ca.appointment_date >= $1::date
        and ca.appointment_date <= $2::date
        and coalesce(ca.support_type, 'GUIDANCE') = $3
      order by ca.slot_time asc, student_name asc
    `,
    [monthStart, monthEnd, supportType],
  );
  const adminActivityRows = await query(
    `
      select
        id,
        actor_email,
        actor_name,
        actor_role,
        action_type,
        entity_type,
        title,
        description,
        metadata,
        created_at
      from public.admin_activity_logs
      order by created_at desc
      limit 40
    `,
  );

  const availability = counselors.map((counselor) => ({
    counselorId: counselor.id,
    slots: availabilityRows.rows
      .filter((row) => row.counselor_id === counselor.id)
      .map((row) => ({
        dayOfWeek: row.day_of_week,
        dayLabel: DAY_LABELS[row.day_of_week],
        slotTime: row.slot_time,
        slotLabel: toReadableTime(row.slot_time),
        isEnabled: Boolean(row.is_enabled),
      })),
  }));

  const normalizedAppointments = appointmentRows.rows.map((row) => ({
    id: row.id,
    studentNumber: row.student_number,
    studentName: row.student_name,
    program: row.program || "",
    concern: row.concern,
    counselingType: row.counseling_type || "",
    appointmentDate: normalizeDateValue(row.appointment_date),
    appointmentDateLabel: formatDateLong(row.appointment_date),
    slotTime: row.slot_time,
    slotLabel: toReadableTime(row.slot_time),
    status: row.status,
    statusLabel: toStatusLabel(row.status),
    studentNote: row.student_note || "",
    supportType: normalizeSupportType(row.support_type),
    counselorGenderPreference: row.counselor_gender_preference || "No Preference",
    bookingSource: row.booking_source || "MOBILE_APP",
    counselorId: row.counselor_id,
    counselorName: row.counselor_name,
    counselorRole: toRoleLabel(row.counselor_role, row.support_type),
    peerStudentNumber: row.peer_student_number || "",
    peerProgram: row.peer_program || "",
    createdByAdminEmail: row.created_by_admin_email || "",
    createdByAdminName: row.created_by_admin_name || "",
    createdByAdminRole: toRoleLabel(row.created_by_admin_role),
    createdAt: row.created_at,
    decisionDueAt: getDecisionDeadlineIso(row.created_at),
  }));
  const allPeerCounselors = isPeerSupportType(supportType)
    ? await listPeerCounselors({ includeInactive: true })
    : [];

  return res.json({
    selectedDate,
    month: monthKey,
    supportType,
    counselors: counselors.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: toRoleLabel(row.role, supportType),
      gender: row.gender,
      pictureUrl: row.profile_picture_url || "",
      specialties: isPeerSupportType(supportType) ? [] : Array.isArray(row.specialties) ? row.specialties : [],
      studentNumber: row.student_number || "",
      program: row.program || "",
      supportType,
      isActive: row.is_active !== false,
    })),
    peerCounselors: allPeerCounselors.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: toRoleLabel(row.role, SUPPORT_TYPE_PEER),
      gender: row.gender,
      pictureUrl: row.profile_picture_url || "",
      specialties: [],
      studentNumber: row.student_number || "",
      program: row.program || "",
      supportType: SUPPORT_TYPE_PEER,
      isActive: Boolean(row.is_active) && normalizePeerInvitationStatus(row.invitation_status, "ACCEPTED") === "ACCEPTED",
      invitationStatus: normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED"),
      status:
        normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED") === "PENDING"
          ? "Pending"
          : normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED") === "ACCEPTED" && row.is_active
            ? "Active"
            : "Declined",
      invitationSentAt: row.invitation_sent_at || null,
      invitationRespondedAt: row.invitation_responded_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    appointments: normalizedAppointments.filter((item) => item.appointmentDate === selectedDate),
    monthAppointments: normalizedAppointments,
    availability,
    availabilityOverrides: availabilityOverrideRows.rows.map((row) => ({
      counselorId: row.counselor_id,
      overrideDate: normalizeDateValue(row.override_date),
      slotTime: row.slot_time,
      slotLabel: toReadableTime(row.slot_time),
      isEnabled: Boolean(row.is_enabled),
    })),
    recentActivity: [
      ...adminActivityRows.rows
        .filter((row) => {
          const rowSupportType = row.metadata?.supportType ? normalizeSupportType(row.metadata.supportType) : SUPPORT_TYPE_GUIDANCE;
          return rowSupportType === supportType;
        })
        .map((row) => ({
        id: `admin-activity-${row.id}`,
        kind: String(row.action_type || "").toLowerCase(),
        title: row.title,
        description: row.description,
        actorName: row.actor_name || row.actor_email || "Admin",
        actorRole: row.actor_role || "Admin",
        counselorId: row.metadata?.ownerCounselorId || row.metadata?.actorAdminId || row.metadata?.counselorId || null,
        createdAt: row.created_at,
      })),
      ...normalizedAppointments
        .filter((item) => item.bookingSource !== "ADMIN_PANEL")
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 12)
        .map((item) => ({
          id: `appointment-${item.id}`,
          kind: "mobile_booking",
          title:
            String(item.status || "").toUpperCase() === "PENDING"
              ? `${item.studentName} requested ${item.slotLabel}`
              : `${item.studentName} booked ${item.slotLabel}`,
          description:
            String(item.status || "").toUpperCase() === "PENDING"
              ? `${item.concern} with ${item.counselorName} on ${formatDateLong(item.appointmentDate)}. Response due within 24 hours.`
              : `${item.concern} with ${item.counselorName} on ${formatDateLong(item.appointmentDate)}`,
          actorName: item.studentName,
          actorRole: "Student",
          counselorId: item.counselorId,
          createdAt: item.createdAt,
        })),
    ]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 18)
      .map((item) => ({
        ...item,
        createdAtLabel: formatRelativeDateTime(item.createdAt),
      })),
    concernOptions: isPeerSupportType(supportType) ? PEER_CONCERN_OPTIONS : CONCERN_OPTIONS,
    concernSubcategories: APPOINTMENT_CONCERN_SUBCATEGORIES,
    peerConcernOptions: PEER_CONCERN_OPTIONS,
    slotTimes: DEFAULT_SLOT_TIMES.map((item) => ({
      value: item,
      label: toReadableTime(item),
    })),
  });
});

router.get("/admin/peer-counselors", async (_req, res) => {
  const peerCounselors = await listPeerCounselors({ includeInactive: true });
  return res.json({
    peerCounselors: peerCounselors.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      gender: row.gender,
      studentNumber: row.student_number || "",
      program: row.program || "",
      pictureUrl: row.profile_picture_url || "",
      googleProfilePictureUrl: "",
      specialties: [],
      isActive: Boolean(row.is_active) && normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED") === "ACCEPTED",
      invitationStatus: normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED"),
      status:
        normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED") === "PENDING"
          ? "Pending"
          : normalizePeerInvitationStatus(row.invitation_status, row.is_active ? "ACCEPTED" : "DECLINED") === "ACCEPTED" && row.is_active
            ? "Active"
            : "Declined",
      supportType: SUPPORT_TYPE_PEER,
      invitationSentAt: row.invitation_sent_at || null,
      invitationRespondedAt: row.invitation_responded_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
});

router.post("/admin/peer-counselors", requireRoles("HEAD_COUNSELOR"), async (req, res) => {
  const fullName = String(req.body.fullName || "").trim().replace(/\s+/g, " ");
  const email = String(req.body.email || "").trim().toLowerCase();
  const gender = normalizePeerGender(req.body.gender);
  const studentNumber = String(req.body.studentNumber || "").trim();
  const program = String(req.body.program || "").trim().replace(/\s+/g, " ");
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;
  const specialties = [];

  if (!fullName || !email || !studentNumber || !program) {
    return res.status(400).json({ message: "Name, Gmail, student number, and program are required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!isLikelyEmailAddress(email)) {
    return res.status(400).json({ message: "A valid Gmail address is required." });
  }
  if (!gender) {
    return res.status(400).json({ message: "Please choose Male or Female for the peer counselor." });
  }
  const invitationToken = createPeerInviteToken();
  const invitationTokenHash = hashPeerInviteToken(invitationToken);
  const insertResult = await query(
    `
      insert into public.peer_counselors (
        full_name,
        email,
        gender,
        student_number,
        program,
        specialties,
        is_active,
        invitation_status,
        invitation_token_hash,
        invitation_sent_at,
        invitation_responded_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, false, 'PENDING', $7, now(), null)
      on conflict (email)
      do update set
        full_name = excluded.full_name,
        gender = excluded.gender,
        student_number = excluded.student_number,
        program = excluded.program,
        specialties = excluded.specialties,
        is_active = case
          when coalesce(public.peer_counselors.invitation_status, 'ACCEPTED') = 'ACCEPTED'
            then public.peer_counselors.is_active
          else false
        end,
        invitation_status = case
          when coalesce(public.peer_counselors.invitation_status, 'ACCEPTED') = 'ACCEPTED'
            then public.peer_counselors.invitation_status
          else 'PENDING'
        end,
        invitation_token_hash = case
          when coalesce(public.peer_counselors.invitation_status, 'ACCEPTED') = 'ACCEPTED'
            then public.peer_counselors.invitation_token_hash
          else excluded.invitation_token_hash
        end,
        invitation_sent_at = case
          when coalesce(public.peer_counselors.invitation_status, 'ACCEPTED') = 'ACCEPTED'
            then public.peer_counselors.invitation_sent_at
          else now()
        end,
        invitation_responded_at = case
          when coalesce(public.peer_counselors.invitation_status, 'ACCEPTED') = 'ACCEPTED'
            then public.peer_counselors.invitation_responded_at
          else null
        end,
        updated_at = now()
      returning id, email, full_name, gender, student_number, program, specialties, profile_picture_url, google_profile_picture_url, is_active, invitation_status, invitation_sent_at, invitation_responded_at, created_at, updated_at
    `,
    [fullName, email, gender, studentNumber, program, JSON.stringify(specialties), invitationTokenHash],
  );

  const peerCounselor = insertResult.rows[0];
  const invitationStatus = normalizePeerInvitationStatus(peerCounselor.invitation_status, peerCounselor.is_active ? "ACCEPTED" : "PENDING");
  if (peerCounselor.is_active && invitationStatus === "ACCEPTED") {
    await ensureDefaultAvailability(peerCounselor.id, SUPPORT_TYPE_PEER);
  } else {
    await sendPeerCounselorInvitationEmail({
      peerCounselor,
      invitedByName: actorAdmin?.full_name || actorEmail || "The guidance office",
      acceptUrl: getPeerInvitationActionUrl(req, invitationToken, "accept"),
      declineUrl: getPeerInvitationActionUrl(req, invitationToken, "decline"),
    });
  }
  await writeAdminActivityLog({
    actionType: "PEER_COUNSELOR_CREATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "PEER_COUNSELOR",
    title: `${peerCounselor.full_name} invited as a peer counselor`,
    description: `${peerCounselor.full_name} was sent a peer counselor invitation and will remain pending until they accept.`,
    metadata: {
      counselorId: peerCounselor.id,
      counselorName: peerCounselor.full_name,
      ownerCounselorId: peerCounselor.id,
      supportType: SUPPORT_TYPE_PEER,
    },
  });

  return res.status(201).json({
    message: invitationStatus === "ACCEPTED" ? "Peer counselor saved." : "Peer counselor invitation sent.",
    peerCounselor: {
      id: peerCounselor.id,
      email: peerCounselor.email,
      fullName: peerCounselor.full_name,
      gender: peerCounselor.gender,
      studentNumber: peerCounselor.student_number || "",
      program: peerCounselor.program || "",
      pictureUrl: peerCounselor.profile_picture_url || "",
      specialties: [],
      isActive: Boolean(peerCounselor.is_active) && invitationStatus === "ACCEPTED",
      invitationStatus,
      status: invitationStatus === "PENDING" ? "Pending" : invitationStatus === "ACCEPTED" && peerCounselor.is_active ? "Active" : "Declined",
      supportType: SUPPORT_TYPE_PEER,
    },
  });
});

router.patch("/admin/peer-counselors/:peerCounselorId", requireRoles("HEAD_COUNSELOR"), async (req, res) => {
  const peerCounselorId = String(req.params.peerCounselorId || "").trim();
  const fullName = String(req.body.fullName || "").trim().replace(/\s+/g, " ");
  const email = String(req.body.email || "").trim().toLowerCase();
  const gender = normalizePeerGender(req.body.gender);
  const studentNumber = String(req.body.studentNumber || "").trim();
  const program = String(req.body.program || "").trim().replace(/\s+/g, " ");
  const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : null;
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;
  const specialties = [];

  if (!peerCounselorId || !fullName || !email || !studentNumber || !program) {
    return res.status(400).json({ message: "Peer counselor details are required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!isLikelyEmailAddress(email)) {
    return res.status(400).json({ message: "A valid Gmail address is required." });
  }
  if (!gender) {
    return res.status(400).json({ message: "Please choose Male or Female for the peer counselor." });
  }
  const updateResult = await query(
    `
      update public.peer_counselors
      set
        full_name = $2,
        email = $3,
        gender = $4,
        student_number = $5,
        program = $6,
        specialties = $7::jsonb,
        is_active = coalesce($8::boolean, is_active),
        invitation_status = case
          when $8::boolean is true then 'ACCEPTED'
          when $8::boolean is false then coalesce(invitation_status, 'DECLINED')
          else invitation_status
        end,
        invitation_responded_at = case when $8::boolean is true and coalesce(invitation_status, 'PENDING') <> 'ACCEPTED' then now() else invitation_responded_at end,
        updated_at = now()
      where id = $1::uuid
      returning id, email, full_name, gender, student_number, program, specialties, profile_picture_url, google_profile_picture_url, is_active, invitation_status, invitation_sent_at, invitation_responded_at, created_at, updated_at
    `,
    [peerCounselorId, fullName, email, gender, studentNumber, program, JSON.stringify(specialties), isActive],
  );

  if (updateResult.rowCount === 0) {
    return res.status(404).json({ message: "Peer counselor not found." });
  }

  const peerCounselor = updateResult.rows[0];
  const invitationStatus = normalizePeerInvitationStatus(peerCounselor.invitation_status, peerCounselor.is_active ? "ACCEPTED" : "DECLINED");
  if (peerCounselor.is_active && invitationStatus === "ACCEPTED") {
    await ensureDefaultAvailability(peerCounselor.id, SUPPORT_TYPE_PEER);
  }
  await writeAdminActivityLog({
    actionType: "PEER_COUNSELOR_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "PEER_COUNSELOR",
    title: `${peerCounselor.full_name} peer counselor details updated`,
    description: `${peerCounselor.full_name} is marked ${peerCounselor.is_active ? "active" : "inactive"}.`,
    metadata: {
      counselorId: peerCounselor.id,
      counselorName: peerCounselor.full_name,
      ownerCounselorId: peerCounselor.id,
      supportType: SUPPORT_TYPE_PEER,
    },
  });

  return res.json({
    message: "Peer counselor updated.",
    peerCounselor: {
      id: peerCounselor.id,
      email: peerCounselor.email,
      fullName: peerCounselor.full_name,
      gender: peerCounselor.gender,
      studentNumber: peerCounselor.student_number || "",
      program: peerCounselor.program || "",
      pictureUrl: peerCounselor.profile_picture_url || "",
      specialties: [],
      isActive: Boolean(peerCounselor.is_active) && invitationStatus === "ACCEPTED",
      invitationStatus,
      status: invitationStatus === "PENDING" ? "Pending" : invitationStatus === "ACCEPTED" && peerCounselor.is_active ? "Active" : "Declined",
      supportType: SUPPORT_TYPE_PEER,
    },
  });
});

router.delete("/admin/peer-counselors/:peerCounselorId", requireRoles("HEAD_COUNSELOR"), async (req, res) => {
  const peerCounselorId = String(req.params.peerCounselorId || "").trim();
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;
  if (!peerCounselorId) {
    return res.status(400).json({ message: "Peer counselor id is required." });
  }

  const deletion = await withDbTransaction((run) =>
    deletePeerCounselorFromDatabase(peerCounselorId, run),
  );

  if (!deletion.peerCounselor) {
    return res.status(404).json({ message: "Peer counselor not found." });
  }

  const peerCounselor = deletion.peerCounselor;
  await writeAdminActivityLog({
    actionType: "PEER_COUNSELOR_DELETED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || actorEmail || "Admin",
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "PEER_COUNSELOR",
    title: `${peerCounselor.full_name} deleted from peer counseling`,
    description: `${peerCounselor.full_name} was permanently deleted from peer counselor records.${
      deletion.deletedAppointmentCount ? ` ${deletion.deletedAppointmentCount} assigned appointment${deletion.deletedAppointmentCount === 1 ? "" : "s"} were also removed.` : ""
    }`,
    metadata: {
      counselorId: peerCounselor.id,
      counselorName: peerCounselor.full_name,
      ownerCounselorId: peerCounselor.id,
      supportType: SUPPORT_TYPE_PEER,
    },
  });

  return res.json({
    deletedAppointmentCount: deletion.deletedAppointmentCount,
    message: "Peer counselor deleted.",
  });
});

router.get("/notifications/threads/:counselorId", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const counselorId = String(req.params.counselorId || "").trim();
  if (!studentNumber) {
    return res.status(401).json({ message: "Authentication required. Please sign in." });
  }
  if (!counselorId) {
    return res.status(400).json({ message: "Counselor id is required." });
  }

  const result = await query(
    `
      select id, kind, title, message, metadata, is_read, read_at, created_at
      from public.student_notifications
      where student_number = $1
        and kind = 'ADMIN_MESSAGE'
        and deleted_at is null
      order by created_at asc
    `,
    [studentNumber],
  );
  const groups = groupFollowUpThreads(result.rows);
  const threadRows = groups.get(counselorId);
  if (!threadRows || threadRows.length === 0) {
    return res.status(404).json({ message: "No messages with that counselor." });
  }

  const sorted = [...threadRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lastMeta = parseNotificationMetadata(sorted[sorted.length - 1]?.metadata);
  const profiles = await loadCounselorProfiles([counselorId]);
  const profile = profiles.get(counselorId);
  const counselorName = String(profile?.full_name || lastMeta.actorName || lastMeta.counselorName || sorted[sorted.length - 1]?.title || "").trim();
  const pictureUrl = String(profile?.profile_picture_url || lastMeta.pictureUrl || lastMeta.profilePictureUrl || "").trim();
  return res.json({
    counselorId,
    counselorName,
    pictureUrl,
    profilePictureUrl: pictureUrl,
    messages: sorted.map(serializeFollowUpMessage),
  });
});

router.post("/notifications/threads/:counselorId/read", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const counselorId = String(req.params.counselorId || "").trim();
  if (!studentNumber) {
    return res.status(401).json({ message: "Authentication required. Please sign in." });
  }
  if (!counselorId) {
    return res.status(400).json({ message: "Counselor id is required." });
  }

  const result = await query(
    `
      select id, metadata, is_read
      from public.student_notifications
      where student_number = $1
        and kind = 'ADMIN_MESSAGE'
        and deleted_at is null
    `,
    [studentNumber],
  );
  const groups = groupFollowUpThreads(result.rows);
  const threadRows = groups.get(counselorId) || [];
  const ids = threadRows.filter((row) => !row.is_read).map((row) => row.id);
  if (ids.length > 0) {
    await query(
      `
        update public.student_notifications
        set is_read = true, read_at = now()
        where student_number = $1
          and id = any($2::uuid[])
      `,
      [studentNumber, ids],
    );
  }

  return res.json({ message: "Notifications marked as read." });
});

router.get("/notifications", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  await syncDueFutureSelfNotifications(studentNumber);
  const category = String(req.query.category || "").trim().toLowerCase();
  const categoryFilter =
    category === "messages"
      ? "and kind = 'ADMIN_MESSAGE'"
      : category === "guidance"
        ? "and kind <> 'ADMIN_MESSAGE' and (kind like 'APPOINTMENT%' or kind like 'CONSULT%') and coalesce(metadata->>'supportType', 'GUIDANCE') = 'GUIDANCE'"
        : category === "peer"
          ? "and kind <> 'ADMIN_MESSAGE' and (kind like 'APPOINTMENT%' or kind like 'CONSULT%') and metadata->>'supportType' = 'PEER'"
        : category === "future-self" || category === "future_self" || category === "futureme"
          ? "and kind like 'FUTURE_SELF%'"
        : category === "other"
          ? "and kind <> 'ADMIN_MESSAGE' and kind not like 'APPOINTMENT%' and kind not like 'CONSULT%' and kind not like 'FUTURE_SELF%'"
      : category === "notifications"
        ? "and kind <> 'ADMIN_MESSAGE'"
        : "";

  if (category === "messages") {
    const threadResult = await query(
      `
        select id, kind, title, message, metadata, is_read, read_at, created_at
        from public.student_notifications
        where student_number = $1
          and deleted_at is null
          and kind = 'ADMIN_MESSAGE'
        order by created_at desc
      `,
      [studentNumber],
    );
    const groups = groupFollowUpThreads(threadResult.rows);
    const profiles = await loadCounselorProfiles([...groups.keys()]);
    const notifications = Array.from(groups.entries())
      .map(([counselorId, rows]) => serializeStudentMessageThread(counselorId, rows, profiles.get(counselorId)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.json({
      notifications,
      items: notifications,
      fetchedAt: new Date().toISOString(),
      unreadCount: notifications.filter((item) => !item.isRead).length,
      totalCount: notifications.length,
    });
  }

  const [result, countResult] = await Promise.all([
    query(
      `
        select id, kind, title, message, metadata, is_read, read_at, created_at
        from public.student_notifications
        where student_number = $1
          and deleted_at is null
          ${categoryFilter}
        order by created_at desc
        limit 50
      `,
      [studentNumber],
    ),
    query(
      `
        select count(*)::int as total_count
        from public.student_notifications
        where student_number = $1
          and deleted_at is null
          ${categoryFilter}
      `,
      [studentNumber],
    ),
  ]);

  const notifications = result.rows.map((row) => {
    const kind = String(row.kind || "");
    const metadata = row.metadata || {};
    const source = kind.startsWith("FUTURE_SELF") ? "FUTURE_SELF" : "CONSULT";
    return {
      id: row.id,
      kind,
      title: row.title,
      message: row.message,
      metadata,
      isRead: Boolean(row.is_read),
      readAt: row.read_at,
      createdAt: row.created_at,
      timeLabel: formatRelativeDateTime(row.created_at),
      source,
      route: resolveStudentInboxRoute({
        kind,
        metadata,
        title: row.title,
        message: row.message,
      }),
    };
  });
  return res.json({
    notifications,
    items: notifications,
    fetchedAt: new Date().toISOString(),
    unreadCount: result.rows.filter((row) => !row.is_read).length,
    totalCount: Number(countResult.rows[0]?.total_count || 0),
  });
});

router.post("/notifications/:notificationId/read", requireStudentOnlyAuth, async (req, res) => {
  const notificationId = String(req.params.notificationId || "").trim();
  const studentNumber = resolveRequestStudentNumber(req);

  if (!notificationId || !studentNumber) {
    return res.status(400).json({ message: "Notification id and student number are required." });
  }

  await query(
    `
      update public.student_notifications
      set is_read = true, read_at = now()
      where id = $1::uuid
        and student_number = $2
    `,
    [notificationId, studentNumber],
  );

  return res.json({ message: "Notification marked as read." });
});

router.post("/notifications/read-all", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  const category = String(req.body.category || "").trim().toLowerCase();
  const categoryFilter =
    category === "messages"
      ? "and kind = 'ADMIN_MESSAGE'"
      : category === "guidance"
        ? "and kind <> 'ADMIN_MESSAGE' and (kind like 'APPOINTMENT%' or kind like 'CONSULT%') and coalesce(metadata->>'supportType', 'GUIDANCE') = 'GUIDANCE'"
        : category === "peer"
          ? "and kind <> 'ADMIN_MESSAGE' and (kind like 'APPOINTMENT%' or kind like 'CONSULT%') and metadata->>'supportType' = 'PEER'"
        : category === "future-self" || category === "future_self" || category === "futureme"
          ? "and kind like 'FUTURE_SELF%'"
        : category === "other"
          ? "and kind <> 'ADMIN_MESSAGE' and kind not like 'APPOINTMENT%' and kind not like 'CONSULT%' and kind not like 'FUTURE_SELF%'"
      : category === "notifications"
        ? "and kind <> 'ADMIN_MESSAGE'"
        : "";

  await query(
    `
      update public.student_notifications
      set is_read = true, read_at = now()
      where student_number = $1
        and is_read = false
        ${categoryFilter}
    `,
    [studentNumber],
  );

  return res.json({ message: "Notifications marked as read." });
});

router.delete("/notifications/:notificationId", requireStudentOnlyAuth, async (req, res) => {
  const notificationId = String(req.params.notificationId || "").trim();
  const studentNumber = resolveRequestStudentNumber(req);

  if (!notificationId || !studentNumber) {
    return res.status(400).json({ message: "Notification id and student number are required." });
  }

  await query(
    `
      update public.student_notifications
      set deleted_at = now()
      where id = $1::uuid
        and student_number = $2
        and deleted_at is null
    `,
    [notificationId, studentNumber],
  );

  return res.json({ message: "Notification deleted." });
});

router.post("/admin/availability/day", async (req, res) => {
  await expirePendingAppointments();
  const counselorId = String(req.body.counselorId || "").trim();
  const supportType = normalizeSupportType(req.body.supportType || "");
  const targetDate = normalizeDate(req.body.targetDate || "");
  const dayOfWeek = Number(req.body.dayOfWeek);
  const isEnabled = Boolean(req.body.isEnabled);
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!counselorId || !targetDate) {
    return res.status(400).json({ message: "Counselor and target date are required." });
  }
  if (targetDate < getManilaDateParts().isoDate) {
    return res.status(400).json({ message: "Past dates cannot be edited." });
  }

  const counselor = await findSupportCounselorById(counselorId, supportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const resolvedSupportType = normalizeSupportType(counselor.support_type);
  if (rejectForeignAvailability(req, res, counselorId, resolvedSupportType)) return;
  const { tableName: availabilityTableName, idColumn: availabilityIdColumn } = getAvailabilityStorage(resolvedSupportType);

  const resolvedDayOfWeek = toDayOfWeek(targetDate);
  if (!Number.isNaN(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6 && dayOfWeek !== resolvedDayOfWeek) {
    return res.status(400).json({ message: "Target date does not match the selected weekday." });
  }

  const values = [];
  const params = [];
  let paramIndex = 1;
  for (const slotTime of DEFAULT_SLOT_TIMES) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, now())`);
    params.push(counselorId, targetDate, slotTime, isEnabled);
    paramIndex += 4;
  }

  await query(
    `
      insert into ${availabilityTableName} (
        ${availabilityIdColumn},
        day_of_week,
        override_date,
        slot_time,
        is_enabled,
        updated_at
      )
      values ${values.map((value) => value.replace("($", "($").replace(", $", ", null, $")).join(", ")}
      on conflict (${availabilityIdColumn}, override_date, slot_time)
      where override_date is not null
      do update set is_enabled = excluded.is_enabled, updated_at = now()
    `,
    params,
  );

  let cancelledAppointmentsCount = 0;

  if (!isEnabled) {
    const appointmentsToCancel = await query(
      `
        select
          ca.id,
          ca.student_number,
          ca.appointment_date,
          ca.slot_time,
          coalesce(nullif(aa.full_name, ''), pc.full_name, split_part(aa.email, '@', 1)) as counselor_name
        from public.counselor_appointments ca
        left join public.admin_accounts aa on aa.id = ca.counselor_id
        left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
        where ca.${getAppointmentAssigneeColumn(resolvedSupportType)} = $1::uuid
          and coalesce(ca.support_type, 'GUIDANCE') = $4
          and ca.status = any($3::text[])
          and ca.appointment_date = $2::date
      `,
      [counselorId, targetDate, ACTIVE_APPOINTMENT_STATUSES, resolvedSupportType],
    );

    if (appointmentsToCancel.rowCount > 0) {
      const appointmentIds = appointmentsToCancel.rows.map((row) => row.id);
      await query(
        `
          update public.counselor_appointments
          set status = 'CANCELLED', updated_at = now()
          where id = any($1::uuid[])
        `,
        [appointmentIds],
      );

      cancelledAppointmentsCount = appointmentsToCancel.rowCount;

      for (const appointment of appointmentsToCancel.rows) {
        await createStudentNotification({
          studentNumber: appointment.student_number,
          kind: "APPOINTMENT_CANCELLED",
          title: "Appointment cancelled",
          message: `Your session on ${formatDateLong(appointment.appointment_date)} at ${toReadableTime(appointment.slot_time)} has been cancelled because ${counselor.full_name} is unavailable that day.`,
          metadata: {
            appointmentId: appointment.id,
            cancellationReason: "COUNSELOR_DAY_OFF",
            counselorId,
            counselorName: appointment.counselor_name,
            dayOfWeek: resolvedDayOfWeek,
            dayLabel: DAY_LABELS[resolvedDayOfWeek],
            supportType: resolvedSupportType,
            targetDate,
          },
        });
      }
    }
  }

  await writeAdminActivityLog({
    actionType: "AVAILABILITY_DAY_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || counselor.full_name,
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "SCHEDULING",
    title: `${actorAdmin?.full_name || counselor.full_name} marked ${formatDateLong(targetDate)} as ${isEnabled ? "available" : "off"}`,
    description: isEnabled
      ? `${counselor.full_name} is now available for all slots on ${formatDateLong(targetDate)}.`
      : `${counselor.full_name} is now off for all slots on ${formatDateLong(targetDate)}. ${cancelledAppointmentsCount} appointment${cancelledAppointmentsCount === 1 ? "" : "s"} were cancelled.`,
    metadata: {
      counselorId,
      counselorName: counselor.full_name,
      dayOfWeek: resolvedDayOfWeek,
      targetDate,
      isEnabled,
      slotTimes: DEFAULT_SLOT_TIMES,
      cancelledAppointmentsCount,
      ownerCounselorId: counselorId,
      supportType: resolvedSupportType,
    },
  });

  return res.json({
    message: isEnabled
      ? `Date is now available for ${formatDateLong(targetDate)}.`
      : `Date marked as off for ${formatDateLong(targetDate)}. ${cancelledAppointmentsCount} appointment${cancelledAppointmentsCount === 1 ? "" : "s"} cancelled.`,
    day: {
      counselorId,
      dayOfWeek: resolvedDayOfWeek,
      dayLabel: DAY_LABELS[resolvedDayOfWeek],
      targetDate,
      isEnabled,
      supportType: resolvedSupportType,
    },
    cancelledAppointmentsCount,
  });
});

router.post("/admin/availability", async (req, res) => {
  const counselorId = String(req.body.counselorId || "").trim();
  const supportType = normalizeSupportType(req.body.supportType || "");
  const slotTime = normalizeSlotTime(req.body.slotTime || "");
  const dayOfWeek = Number(req.body.dayOfWeek);
  const isEnabled = Boolean(req.body.isEnabled);
  const actorAdmin = sessionActorAdmin(req);
  const actorEmail = actorAdmin.email;

  if (!counselorId || !DEFAULT_SLOT_TIMES.includes(slotTime) || Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ message: "Counselor, day, and slot time are required." });
  }

  const counselor = await findSupportCounselorById(counselorId, supportType);
  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found." });
  }
  const resolvedSupportType = normalizeSupportType(counselor.support_type);
  if (rejectForeignAvailability(req, res, counselorId, resolvedSupportType)) return;
  const { tableName: availabilityTableName, idColumn: availabilityIdColumn } = getAvailabilityStorage(resolvedSupportType);

  await query(
    `
      insert into ${availabilityTableName} (${availabilityIdColumn}, day_of_week, slot_time, is_enabled, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (${availabilityIdColumn}, day_of_week, slot_time)
      where override_date is null
      do update set is_enabled = excluded.is_enabled, updated_at = now()
    `,
    [counselorId, dayOfWeek, slotTime, isEnabled],
  );

  await writeAdminActivityLog({
    actionType: "AVAILABILITY_UPDATED",
    actorEmail: actorAdmin?.email || actorEmail,
    actorName: actorAdmin?.full_name || counselor.full_name,
    actorRole: toRoleLabel(actorAdmin?.role || "COUNSELOR"),
    entityType: "SCHEDULING",
    title: `${actorAdmin?.full_name || counselor.full_name} ${isEnabled ? "opened" : "closed"} ${toReadableTime(slotTime)}`,
    description: `${DAY_LABELS[dayOfWeek]} availability updated for ${counselor.full_name}`,
    metadata: {
      counselorId,
      counselorName: counselor.full_name,
      dayOfWeek,
      slotTime,
      isEnabled,
      ownerCounselorId: counselorId,
      supportType: resolvedSupportType,
    },
  });

  return res.json({
    message: "Availability updated.",
    availability: {
      counselorId,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      slotTime,
      slotLabel: toReadableTime(slotTime),
      isEnabled,
      supportType: resolvedSupportType,
    },
  });
});

router.startPendingAppointmentExpiryWorker = startPendingAppointmentExpiryWorker;

module.exports = router;

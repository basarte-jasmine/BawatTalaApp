const express = require("express");
const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const { google } = require("googleapis");
const { supabaseAdminClient, supabaseAuthClient } = require("../config/supabase");
const { query } = require("../config/db");
const { EMOTION_OPTIONS, createEmotionCounts, normalizeEmotionId } = require("../constants/emotions");
const {
  JOURNAL_TAG_OPTIONS,
  inferJournalTagsFromText,
  resolveJournalEntryTags,
} = require("../constants/journal-tags");
const {
  RISK_LEVEL_LABELS,
  getRiskLevelLabel,
  normalizeRiskTriggerLevel,
  normalizeRiskTriggerPhrase,
} = require("../constants/risk-levels");

const router = express.Router();
const EMOTION_IDS = EMOTION_OPTIONS.map((item) => item.id);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const LOGIN_ATTEMPTS_LIMIT = 3;
const LOGIN_LOCK_DURATION_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 30 * 1000;
const OTP_VALIDITY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;
const ADMIN_PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const CONSULTATION_CONCERN_CATEGORY_DEFS = [
  { label: "Personal problems", aliases: ["personal problems", "personal problem"] },
  { label: "Mental health", aliases: ["mental health"] },
  { label: "Career guidance", aliases: ["career guidance", "career"] },
  { label: "Financial", aliases: ["financial", "financial guidance", "financial concern", "financial concerns"] },
  { label: "Burnout / Exhaustion", aliases: ["burnout", "burnout / exhaustion", "burnout/exhaustion"] },
  { label: "Academic problems", aliases: ["academic problems", "academic problem", "academic", "academic stress"] },
  { label: "Peer relationship", aliases: ["peer relationship", "peer"] },
  { label: "Family relationship", aliases: ["family relationship", "family", "family issues"] },
  { label: "Romantic relationship", aliases: ["romantic relationship", "romantic"] },
  { label: "Anxiety", aliases: ["anxiety", "anxiety/stress", "anxiety / stress"] },
  { label: "Stress", aliases: ["stress"] },
  { label: "Bullying", aliases: ["bullying", "bully"] },
  { label: "Adjustment", aliases: ["adjustment", "adjust"] },
  { label: "Others", aliases: ["others", "other", "interpersonal relationships", "relationship", "relationships"] },
];
const CONSULTATION_CONCERN_CATEGORY_BY_ALIAS = new Map(
  CONSULTATION_CONCERN_CATEGORY_DEFS.flatMap((definition) =>
    definition.aliases.map((alias) => [alias, definition.label]),
  ),
);

const adminLoginAttempts = new Map();
const adminResetSessions = new Map();

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return normalizeCompactSpaces(value).toLowerCase();
}

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(value, stored) {
  if (!stored || typeof stored !== "string") return false;

  try {
    const [algorithm, salt, hash] = stored.split("$");
    if (algorithm !== "scrypt" || !salt || !hash) return false;

    const valueHashBuffer = scryptSync(value, salt, 64);
    const storedHashBuffer = Buffer.from(hash, "hex");
    if (valueHashBuffer.length !== storedHashBuffer.length) return false;
    return timingSafeEqual(valueHashBuffer, storedHashBuffer);
  } catch {
    return false;
  }
}

function getAttemptState(key) {
  return adminLoginAttempts.get(key) || { count: 0, lockUntil: 0 };
}

function registerFailedAttempt(key) {
  const now = Date.now();
  const state = getAttemptState(key);
  const updatedCount = state.count + 1;

  if (updatedCount >= LOGIN_ATTEMPTS_LIMIT) {
    adminLoginAttempts.set(key, { count: 0, lockUntil: now + LOGIN_LOCK_DURATION_MS });
    return true;
  }

  adminLoginAttempts.set(key, { count: updatedCount, lockUntil: 0 });
  return false;
}

function getResetSession(email) {
  return adminResetSessions.get(email) || null;
}

function setResetSession(email, session) {
  adminResetSessions.set(email, session);
}

function clearResetSession(email) {
  adminResetSessions.delete(email);
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

async function listAdminNotifications(adminEmail) {
  return query(
    `
      select id, kind, title, message, metadata, is_read, read_at, created_at
      from public.admin_notifications
      where admin_email = $1
        and deleted_at is null
      order by created_at desc
      limit 20
    `,
    [adminEmail],
  );
}

async function ensureDefaultAdminAccount() {
  const defaultEmail = normalizeEmail(
    process.env.ADMIN_DEFAULT_EMAIL || "basartejasmine@gmail.com",
  );
  const defaultPassword = String(process.env.ADMIN_DEFAULT_PASSWORD || "DemoAdmin123*");
  const defaultFullName = String(process.env.ADMIN_DEFAULT_FULL_NAME || "Jasmine Batumbakal");
  const defaultRole = "HEAD_COUNSELOR";
  const defaultGender = String(process.env.ADMIN_DEFAULT_GENDER || "Female");

  const existing = await query("select id from public.admin_accounts where email = $1", [defaultEmail]);
  if (existing.rowCount > 0) {
    await query(
      `
        update public.admin_accounts
        set
          full_name = $2,
          role = $3,
          gender = $4,
          updated_at = now()
        where email = $1
      `,
      [defaultEmail, defaultFullName, defaultRole, defaultGender],
    );
  } else {
    await query(
      `
        insert into public.admin_accounts (email, password_hash, full_name, role, gender, is_active)
        values ($1, $2, $3, $4, $5, true)
        on conflict (email) do nothing
      `,
      [defaultEmail, hashPassword(defaultPassword), defaultFullName, defaultRole, defaultGender],
    );
  }
}

function toMonthlyBuckets(rows, dateKey) {
  const bucketMap = new Map();
  for (const row of rows || []) {
    const raw = row?.[dateKey];
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    bucketMap.set(label, (bucketMap.get(label) || 0) + 1);
  }
  return [...bucketMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

function normalizeDisplayLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 4) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function normalizeConsultationConcernCategory(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return CONSULTATION_CONCERN_CATEGORY_BY_ALIAS.get(normalized) || "Others";
}

function inferYearLevelFromStudentNumber(studentNumber) {
  const match = String(studentNumber || "").trim().match(/^(\d{2})-/);
  if (!match) return "Unknown";
  const entryYear = Number(match[1]);
  const currentYear = Number(String(getManilaDateParts().year).slice(-2));
  const computed = Math.max(1, Math.min(4, currentYear - entryYear + 1));
  return `${computed}${computed === 1 ? "st" : computed === 2 ? "nd" : computed === 3 ? "rd" : "th"} Year`;
}

function buildCurrentMonthJournalSeries(rows, dateKey) {
  const now = getManilaDateParts();
  const monthPrefix = `${now.year}-${String(now.month).padStart(2, "0")}-`;
  const bucketMap = new Map();

  for (const row of rows || []) {
    const isoDate = normalizeDateValue(row?.[dateKey]);
    if (!isoDate || !isoDate.startsWith(monthPrefix)) continue;
    const day = Number(isoDate.slice(-2));
    if (!day) continue;
    const weekIndex = Math.floor((day - 1) / 7) + 1;
    const key = `Week ${weekIndex}`;
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  }

  const totalWeeks = Math.max(1, Math.ceil(now.day / 7));
  return Array.from({ length: totalWeeks }, (_, index) => {
    const label = `Week ${index + 1}`;
    return { label, value: bucketMap.get(label) || 0 };
  });
}

function getJournalTagsForAdmin(row) {
  const resolved = resolveJournalEntryTags(row);
  return resolved.length
    ? resolved
    : inferJournalTagsFromText([row?.summary, row?.admin_flag_reason].filter(Boolean).join(" "));
}

const MANILA_TIME_ZONE = "Asia/Manila";

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

function getRelativeManilaIsoDate(daysOffset) {
  const now = new Date();
  const shifted = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return getManilaDateParts(shifted).isoDate;
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return getManilaDateParts(value).isoDate;
  }

  const raw = String(value).trim();
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return getManilaDateParts(parsed).isoDate;
    }
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function countRowsOnDate(rows, dateKey, isoDate) {
  return (rows || []).filter((row) => normalizeDateValue(row?.[dateKey]) === isoDate).length;
}

function countRowsBetweenDates(rows, dateKey, startIsoDate, endIsoDateExclusive) {
  return (rows || []).filter((row) => {
    const date = normalizeDateValue(row?.[dateKey]);
    return date && date >= startIsoDate && date < endIsoDateExclusive;
  }).length;
}

function buildDelta(currentValue, previousValue) {
  if (!previousValue) {
    if (!currentValue) {
      return { direction: "neutral", percentageText: "0%" };
    }
    return { direction: "up", percentageText: "100%" };
  }

  const rawDelta = ((currentValue - previousValue) / previousValue) * 100;
  if (rawDelta > 0) {
    return { direction: "up", percentageText: `${rawDelta.toFixed(rawDelta >= 10 ? 0 : 1)}%` };
  }
  if (rawDelta < 0) {
    return { direction: "down", percentageText: `${Math.abs(rawDelta).toFixed(Math.abs(rawDelta) >= 10 ? 0 : 1)}%` };
  }
  return { direction: "neutral", percentageText: "0%" };
}

function toCounselorRoleLabel(value) {
  return String(value || "").toUpperCase() === "HEAD_COUNSELOR" ? "Head Counselor" : "Counselor";
}

function toRoleManagementLabel(value) {
  return String(value || "").toUpperCase() === "HEAD_COUNSELOR" ? "Super Admin" : "School Counselor";
}

function normalizeAdminSettings(rawValue) {
  const source = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) ? rawValue : {};
  const notifications = source.notifications && typeof source.notifications === "object" ? source.notifications : {};
  const appearance = source.appearance && typeof source.appearance === "object" ? source.appearance : {};
  const privacy = source.privacy && typeof source.privacy === "object" ? source.privacy : {};
  const profilePicture = source.profilePicture && typeof source.profilePicture === "object" ? source.profilePicture : {};
  const normalizedProfilePictureSource = String(profilePicture.source || "").toUpperCase();

  return {
    notifications: {
      appointmentUpdates: notifications.appointmentUpdates !== false,
      cancellationAlerts: notifications.cancellationAlerts !== false,
      dailyDigest: Boolean(notifications.dailyDigest),
      emailAlerts: notifications.emailAlerts !== false,
      mobilePush: notifications.mobilePush !== false,
    },
    appearance: {
      compactCards: Boolean(appearance.compactCards),
      highlightUnread: appearance.highlightUnread !== false,
      reduceMotion: Boolean(appearance.reduceMotion),
      theme: "light",
    },
    privacy: {
      maskStudentNumbers: Boolean(privacy.maskStudentNumbers),
      requireCancelReason: privacy.requireCancelReason !== false,
    },
    profilePicture: {
      googlePictureUrl: normalizeCompactSpaces(profilePicture.googlePictureUrl || ""),
      source: ["UPLOAD", "GOOGLE", "NONE"].includes(normalizedProfilePictureSource)
        ? normalizedProfilePictureSource
        : "NONE",
      storagePath: normalizeCompactSpaces(profilePicture.storagePath || ""),
    },
  };
}

function getAdminProfilePictureBucket() {
  return normalizeCompactSpaces(process.env.SUPABASE_ADMIN_AVATAR_BUCKET || "admin-profile-pictures");
}

async function ensureAdminProfilePictureBucket() {
  const bucketName = getAdminProfilePictureBucket();
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
    fileSizeLimit: `${ADMIN_PROFILE_PICTURE_LIMIT_BYTES}`,
  });

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw new Error(createError.message || "Unable to create storage bucket.");
  }

  return bucketName;
}

function sanitizeFileName(value) {
  const normalized = normalizeCompactSpaces(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "profile-image";
}

function parseUploadedImagePayload(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
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
  if (buffer.length > ADMIN_PROFILE_PICTURE_LIMIT_BYTES) {
    throw new Error("Profile picture must be 5 MB or smaller.");
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

async function removeStoredAdminProfilePicture(storagePath) {
  const normalizedPath = normalizeCompactSpaces(storagePath || "");
  if (!normalizedPath) return;

  const bucketName = getAdminProfilePictureBucket();
  const { error } = await supabaseAdminClient.storage.from(bucketName).remove([normalizedPath]);
  if (error) {
    console.warn("Failed to remove previous admin profile picture:", error.message || error);
  }
}

async function uploadAdminProfilePicture({ adminId, uploadedImage }) {
  const bucketName = await ensureAdminProfilePictureBucket();
  const filePath = `${adminId}/${Date.now()}-${uploadedImage.fileName}.${uploadedImage.extension}`;
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
  return {
    publicUrl: data?.publicUrl || "",
    storagePath: filePath,
  };
}

function buildAdminProfilePayload(admin, settings) {
  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.full_name,
    role: admin.role,
    roleLabel: toCounselorRoleLabel(admin.role),
    gender: admin.gender,
    profilePictureUrl: admin.profile_picture_url,
    profilePictureSource: settings.profilePicture.source,
    googleProfilePictureUrl: settings.profilePicture.googlePictureUrl,
    specialties: Array.isArray(admin.specialties) ? admin.specialties : [],
    isActive: Boolean(admin.is_active),
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
  };
}

function normalizeSpecialties(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeCompactSpaces(item))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeCompactSpaces(item)).filter(Boolean)
    : [];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

function parseRiskTriggerPayload(body, existing = {}) {
  const phrase =
    Object.prototype.hasOwnProperty.call(body, "phrase")
      ? normalizeRiskTriggerPhrase(body.phrase)
      : normalizeRiskTriggerPhrase(existing.phrase);
  const riskLevel =
    Object.prototype.hasOwnProperty.call(body, "riskLevel") || Object.prototype.hasOwnProperty.call(body, "risk_level")
      ? normalizeRiskTriggerLevel(body.riskLevel || body.risk_level)
      : normalizeRiskTriggerLevel(existing.risk_level || existing.riskLevel);
  const isEnabled =
    typeof body.isEnabled === "boolean"
      ? body.isEnabled
      : typeof body.is_enabled === "boolean"
        ? body.is_enabled
        : existing.is_enabled == null
          ? true
          : Boolean(existing.is_enabled);

  return {
    isEnabled,
    phrase,
    riskLevel,
  };
}

function serializeRiskTrigger(row) {
  const riskLevel = normalizeRiskTriggerLevel(row.risk_level) || "LOW";
  return {
    id: row.id,
    phrase: row.phrase,
    riskLevel,
    riskLabel: getRiskLevelLabel(riskLevel),
    isEnabled: Boolean(row.is_enabled),
    createdByEmail: row.created_by_email || "",
    updatedByEmail: row.updated_by_email || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getActorPayload(body = {}) {
  return {
    actorEmail: normalizeEmail(body.actorEmail || ""),
    actorName: normalizeCompactSpaces(body.actorName || ""),
    actorRole: normalizeCompactSpaces(body.actorRole || "Admin"),
  };
}

function toStudentStatus(row) {
  const flaggedCount = Number(row?.flagged_entries || 0);
  const totalEntries = Number(row?.total_entries || 0);
  if (flaggedCount > 0) return "Flagged";
  if (totalEntries === 0) return "Inactive";
  return "Active";
}

function addDaysToIsoDate(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getDaysBetweenInclusive(startIsoDate, endIsoDate) {
  const start = new Date(`${startIsoDate}T00:00:00Z`);
  const end = new Date(`${endIsoDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

function enumerateIsoDates(startIsoDate, endIsoDate) {
  const totalDays = getDaysBetweenInclusive(startIsoDate, endIsoDate);
  return Array.from({ length: totalDays }, (_, index) => addDaysToIsoDate(startIsoDate, index));
}

function formatShortLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function resolveAnalyticsRange(queryValue, customStartRaw, customEndRaw) {
  const todayIso = getRelativeManilaIsoDate(0);
  const normalized = String(queryValue || "30d").trim().toLowerCase();

  if (normalized === "custom") {
    const customStart = normalizeDateValue(customStartRaw);
    const customEnd = normalizeDateValue(customEndRaw);
    if (customStart && customEnd && customStart <= customEnd) {
      return {
        rangeKey: "custom",
        startDate: customStart,
        endDate: customEnd,
      };
    }
  }

  const days = normalized === "7d" ? 7 : normalized === "90d" ? 90 : 30;
  return {
    rangeKey: normalized === "7d" || normalized === "90d" ? normalized : "30d",
    startDate: addDaysToIsoDate(todayIso, -(days - 1)),
    endDate: todayIso,
  };
}

function buildWindowBuckets(startIsoDate, endIsoDate, bucketCount = 4) {
  const dates = enumerateIsoDates(startIsoDate, endIsoDate);
  const size = Math.max(1, Math.ceil(dates.length / bucketCount));
  const buckets = [];

  for (let index = 0; index < dates.length; index += size) {
    const bucketDates = dates.slice(index, index + size);
    if (!bucketDates.length) continue;
    buckets.push({
      startDate: bucketDates[0],
      endDate: bucketDates[bucketDates.length - 1],
      label:
        bucketDates.length === 1
          ? formatShortLabel(bucketDates[0])
          : `${formatShortLabel(bucketDates[0])} - ${formatShortLabel(bucketDates[bucketDates.length - 1])}`,
    });
  }

  return buckets;
}

function buildDailyTrend(rows, startIsoDate, endIsoDate, dateKey) {
  const counts = new Map();
  for (const row of rows || []) {
    const isoDate = normalizeDateValue(row?.[dateKey]);
    if (!isoDate || isoDate < startIsoDate || isoDate > endIsoDate) continue;
    counts.set(isoDate, (counts.get(isoDate) || 0) + 1);
  }

  return enumerateIsoDates(startIsoDate, endIsoDate).map((isoDate) => ({
    isoDate,
    label: formatShortLabel(isoDate),
    value: counts.get(isoDate) || 0,
  }));
}

function calculateAverageEntriesPerStudent(totalEntries, totalStudents) {
  if (!totalStudents) return 0;
  return Number((Number(totalEntries || 0) / Number(totalStudents || 0)).toFixed(1));
}

function getResponseTimeHours(row) {
  if (!row?.support_response_at || !row?.created_at) return Number.POSITIVE_INFINITY;
  const createdAt = new Date(row.created_at);
  const respondedAt = new Date(row.support_response_at);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(respondedAt.getTime())) return Number.POSITIVE_INFINITY;
  return (respondedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
}

function buildResolutionRate(rows, label, predicate, targetHours, color) {
  const scopedRows = (rows || []).filter(predicate);
  const resolvedWithinTarget = scopedRows.filter(
    (row) => String(row.support_response || "").toUpperCase() === "CONTACTED" && getResponseTimeHours(row) <= targetHours,
  ).length;

  const percentage = scopedRows.length
    ? Math.round((resolvedWithinTarget / scopedRows.length) * 100)
    : 0;

  return {
    label,
    value: percentage,
    targetLabel: `Target: ${targetHours}h`,
    color,
  };
}

function generateTemporaryPassword() {
  return `BtRole_${randomBytes(4).toString("hex")}A1!`;
}

async function getScheduledEventCounts() {
  const todayIso = getRelativeManilaIsoDate(0);
  const yesterdayIso = getRelativeManilaIsoDate(-1);

  const result = await query(
    `
      select appointment_date, count(*)::int as total
      from public.counselor_appointments
      where appointment_date in ($1::date, $2::date)
        and status = 'CONFIRMED'
      group by appointment_date
    `,
    [todayIso, yesterdayIso],
  );

  return result.rows.reduce(
    (acc, row) => {
      const isoDate = normalizeDateValue(row.appointment_date);
      if (isoDate === todayIso) acc.todayCount = Number(row.total || 0);
      if (isoDate === yesterdayIso) acc.yesterdayCount = Number(row.total || 0);
      return acc;
    },
    { todayCount: 0, yesterdayCount: 0, unavailable: false },
  );
}

function getOAuthClient(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:4001/api/admin/appointments/google/callback";

  if (!clientId || !clientSecret) return null;

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const refreshToken =
    req.session?.googleRefreshToken || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || "";
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }
  return client;
}

function getGoogleLoginClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_LOGIN_REDIRECT_URI ||
    "http://localhost:4001/api/admin/oauth/google/callback";
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const password = String(req.body.password || "");

  if (!email && !password) {
    return res.status(400).json({ message: "Please enter your email and password." });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  const loginKey = `${email}:${req.ip || "unknown"}`;
  const attemptState = getAttemptState(loginKey);
  if (attemptState.lockUntil && Date.now() < attemptState.lockUntil) {
    return res.status(429).json({
      message: "Too many failed login attempts. Please try again later.",
    });
  }

  const result = await query(
    `select id, email, password_hash, is_active, coalesce(role, 'COUNSELOR') as role,
            coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
            coalesce(profile_picture_url, '') as profile_picture_url
     from public.admin_accounts
     where email = $1
     limit 1`,
    [email],
  );

  const admin = result.rows[0];
  const valid = Boolean(admin) && admin.is_active && verifyPassword(password, admin.password_hash);
  if (!valid) {
    const isLocked = registerFailedAttempt(loginKey);
    if (isLocked) {
      return res.status(429).json({
        message: "Too many failed login attempts. Please try again later.",
      });
    }
    return res.status(400).json({ message: "Invalid email or password. Please try again." });
  }

  adminLoginAttempts.delete(loginKey);
  const roleLabel = admin.role === "HEAD_COUNSELOR" ? "Head Counselor" : "Counselor";
  await writeAdminActivityLog({
    actionType: "ADMIN_LOGIN",
    actorEmail: admin.email,
    actorName: admin.email,
    actorRole: roleLabel,
    entityType: "AUTH",
    title: `${admin.email} signed in`,
    description: "Admin login recorded from the admin panel.",
    metadata: { loginMethod: "password" },
  });
  return res.json({
    message: "Login successful.",
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.full_name,
      pictureUrl: admin.profile_picture_url || "",
    },
  });
});

router.get("/oauth/google/start", (req, res) => {
  const client = getGoogleLoginClient();
  if (!client) {
    return res.status(400).json({ message: "Google OAuth is not configured." });
  }

  const state = randomBytes(16).toString("hex");
  req.session.googleLoginState = state;

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "consent",
    state,
  });

  const shouldRedirect =
    String(req.query.redirect || "").trim() === "1" ||
    String(req.get("accept") || "").toLowerCase().includes("text/html");

  if (shouldRedirect) {
    return res.redirect(authUrl);
  }

  return res.json({ authUrl });
});

router.get("/oauth/google/callback", async (req, res) => {
  const client = getGoogleLoginClient();
  const webBaseUrl = process.env.ADMIN_WEB_URL || "http://localhost:5173";
  if (!client) {
    return res.redirect(
      `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("Google OAuth is not configured.")}`,
    );
  }

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const savedState = String(req.session.googleLoginState || "");
  if (!code || !state || !savedState || state !== savedState) {
    return res.redirect(
      `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("Invalid OAuth state. Please try again.")}`,
    );
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    const email = normalizeEmail(data?.email || "");

    if (!email) {
      return res.redirect(
        `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("No email found in Google account.")}`,
      );
    }

    const result = await query(
      `select
         id,
         email,
         coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
         coalesce(role, 'COUNSELOR') as role,
         is_active,
         coalesce(profile_picture_url, '') as profile_picture_url,
         coalesce(settings, '{}'::jsonb) as settings
       from public.admin_accounts
       where email = $1
       limit 1`,
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !admin.is_active) {
      return res.redirect(
        `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("This Google account is not allowed for admin access.")}`,
      );
    }

    const currentSettings = normalizeAdminSettings(admin.settings);
    const googlePictureUrl = normalizeCompactSpaces(data?.picture || "");
    let effectivePictureUrl = admin.profile_picture_url || "";

    if (googlePictureUrl) {
      const nextSettings = {
        ...currentSettings,
        profilePicture: {
          googlePictureUrl,
          source: currentSettings.profilePicture.source === "UPLOAD" ? "UPLOAD" : "GOOGLE",
          storagePath:
            currentSettings.profilePicture.source === "UPLOAD"
              ? currentSettings.profilePicture.storagePath
              : "",
        },
      };
      effectivePictureUrl =
        currentSettings.profilePicture.source === "UPLOAD" && admin.profile_picture_url
          ? admin.profile_picture_url
          : googlePictureUrl;

      await query(
        `
          update public.admin_accounts
          set
            profile_picture_url = $2,
            settings = $3::jsonb,
            updated_at = now()
          where id = $1
        `,
        [admin.id, effectivePictureUrl || null, JSON.stringify(nextSettings)],
      );
    }

    const redirectParams = new URLSearchParams({
      oauth: "success",
      email: admin.email,
    });

    redirectParams.set("name", String(admin.full_name || ""));

    if (effectivePictureUrl) {
      redirectParams.set("picture", effectivePictureUrl);
    }

    return res.redirect(`${webBaseUrl}/login?${redirectParams.toString()}`);
  } catch {
    return res.redirect(
      `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
    );
  }
});

router.post("/forgot-password/send-code", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  const result = await query(
    "select id, email, is_active from public.admin_accounts where email = $1 limit 1",
    [email],
  );
  const admin = result.rows[0];
  if (!admin || !admin.is_active) {
    return res.status(400).json({ message: "Invalid email or password. Please try again." });
  }

  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(email);

  if (error) {
    return res.status(400).json({ message: error.message || "Failed to send code." });
  }

  setResetSession(email, {
    email,
    otpExpiresAt: Date.now() + OTP_VALIDITY_MS,
    resendAvailableAt: Date.now() + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Verification code sent.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/forgot-password/resend-code", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const session = getResetSession(email);
  if (!session) {
    return res.status(400).json({ message: "Please request a code first." });
  }
  if (Date.now() < session.resendAvailableAt) {
    const remaining = Math.ceil((session.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(email);
  if (error) {
    return res.status(400).json({ message: error.message || "Failed to resend code." });
  }

  setResetSession(email, {
    ...session,
    otpExpiresAt: Date.now() + OTP_VALIDITY_MS,
    resendAvailableAt: Date.now() + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: "Code resent successfully.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/forgot-password/verify-code", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const token = String(req.body.token || "").trim();
  if (!email || !token) {
    return res.status(400).json({ message: "Email and verification code are required." });
  }

  const session = getResetSession(email);
  if (!session) {
    return res.status(400).json({ message: "Please request a code first." });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearResetSession(email);
    return res.status(400).json({ message: "The code has expired or is invalid. Please try again." });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  if (error) {
    return res.status(400).json({ message: "The code has expired or is invalid. Please try again." });
  }

  setResetSession(email, {
    ...session,
    verifiedAt: Date.now(),
  });

  return res.json({ message: "Code verified." });
});

router.post("/forgot-password/reset", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const newPassword = String(req.body.newPassword || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }
  if (!confirmPassword) {
    return res.status(400).json({ message: "Confirm your password" });
  }
  if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
    return res.status(400).json({
      message: "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const session = getResetSession(email);
  if (!session || !session.verifiedAt) {
    return res.status(400).json({ message: "Please verify your code first." });
  }
  if (Date.now() > session.verifiedAt + RESET_SESSION_MS) {
    clearResetSession(email);
    return res.status(400).json({ message: "Reset session expired. Please request a new code." });
  }

  await query(
    `update public.admin_accounts
     set password_hash = $1, updated_at = now()
     where email = $2`,
    [hashPassword(newPassword), email],
  );

  clearResetSession(email);
  return res.json({ message: "Password updated successfully" });
});

router.get("/notifications", async (req, res) => {
  const email = normalizeEmail(req.query.email || "");
  if (!email) {
    return res.status(400).json({ message: "Admin email is required." });
  }

  const result = await listAdminNotifications(email);
  return res.json({
    notifications: result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      message: row.message,
      metadata: row.metadata || {},
      isRead: Boolean(row.is_read),
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: result.rows.filter((row) => !row.is_read).length,
  });
});

router.post("/notifications/:notificationId/read", async (req, res) => {
  const notificationId = String(req.params.notificationId || "").trim();
  const email = normalizeEmail(req.body.email || "");
  if (!notificationId || !email) {
    return res.status(400).json({ message: "Notification id and admin email are required." });
  }

  await query(
    `
      update public.admin_notifications
      set is_read = true, read_at = now()
      where id = $1::uuid
        and admin_email = $2
        and deleted_at is null
    `,
    [notificationId, email],
  );

  return res.json({ message: "Notification marked as read." });
});

router.post("/notifications/read-all", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  if (!email) {
    return res.status(400).json({ message: "Admin email is required." });
  }

  await query(
    `
      update public.admin_notifications
      set is_read = true, read_at = now()
      where admin_email = $1
        and deleted_at is null
        and is_read = false
    `,
    [email],
  );

  return res.json({ message: "Notifications marked as read." });
});

router.get("/dashboard/summary", async (req, res) => {
  const manilaNow = getManilaDateParts();
  const currentMonthStartIso = `${manilaNow.year}-${String(manilaNow.month).padStart(2, "0")}-01`;
  const [{ data: profiles, error: profilesError }, { data: journals, error: journalsError }] =
    await Promise.all([
      supabaseAdminClient
        .from("student_profiles")
        .select("id, gender, program, barangay, created_at, student_number"),
      supabaseAdminClient
        .from("journal_entries")
        .select("id, created_at, entry_date, summary, insights, admin_flag_reason, risk_level, student_number, primary_concern, concern_tags"),
    ]);

  const [{ rows: flaggedRows }, { rows: moodRows }, scheduledEvents, { rows: caseAssignmentRows }] = await Promise.all([
    query(
      `
        select id, student_number, entry_date, created_at, risk_level, support_response
        from public.journal_entries
        where deleted_by_student_at is null
          and (
            upper(coalesce(risk_level, 'NONE')) in ('LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'CRITICAL')
            or upper(coalesce(support_response, '')) = 'DECLINED'
          )
      `,
    ),
    query(
      `
        select mood_id, mood_date
        from public.student_moods
        where mood_date >= $1::date
        order by mood_date asc
      `,
      [currentMonthStartIso],
    ),
    getScheduledEventCounts(),
    query(
      `
        select
          je.id,
          je.student_number,
          je.entry_date,
          je.created_at,
          je.summary,
          je.admin_flag_reason,
          je.primary_concern,
          je.concern_tags,
          coalesce(sp.full_name, je.student_number) as student_name,
          coalesce(case_assignment.counselor_name, '') as counselor_name,
          coalesce(case_assignment.counselor_role, '') as counselor_role
        from public.journal_entries je
        left join public.student_profiles sp on sp.student_number = je.student_number
        left join lateral (
          select
            coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as counselor_name,
            coalesce(aa.role, 'COUNSELOR') as counselor_role,
            ca.appointment_date,
            ca.created_at
          from public.counselor_appointments ca
          join public.admin_accounts aa on aa.id = ca.counselor_id
          where ca.student_number = je.student_number
            and ca.status = 'CONFIRMED'
          order by ca.appointment_date desc, ca.created_at desc
          limit 1
        ) case_assignment on true
        where je.risk_level = 'HIGH'
           or je.support_response in ('DECLINED', 'CONTACTED')
        order by coalesce(je.support_response_at, je.created_at) desc
        limit 4
      `,
    ),
  ]);

  const safeProfiles = profilesError ? [] : profiles || [];
  const safeJournals = journalsError ? [] : journals || [];
  const safeFlaggedRows = flaggedRows || [];
  const safeMoodRows = moodRows || [];

  const todayIso = getRelativeManilaIsoDate(0);
  const yesterdayIso = getRelativeManilaIsoDate(-1);
  const last7StartIso = getRelativeManilaIsoDate(-6);
  const previous7StartIso = getRelativeManilaIsoDate(-13);
  const previous7EndIso = getRelativeManilaIsoDate(-6);
  const current30StartIso = getRelativeManilaIsoDate(-29);
  const previous30StartIso = getRelativeManilaIsoDate(-59);
  const previous30EndIso = getRelativeManilaIsoDate(-29);

  const genderCounts = safeProfiles.reduce((acc, row) => {
    const key = String(row.gender || "UNSPECIFIED").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const courseCounts = safeProfiles.reduce((acc, row) => {
    const key = String(row.program || "UNSPECIFIED");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const barangayCounts = safeProfiles.reduce((acc, row) => {
    const key = String(row.barangay || "UNSPECIFIED");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalStudents = safeProfiles.length;
  const totalFlaggedEntries = safeFlaggedRows.length;
  const entriesToday = countRowsOnDate(safeJournals, "created_at", todayIso);
  const studentsThis30Days = countRowsBetweenDates(safeProfiles, "created_at", current30StartIso, getRelativeManilaIsoDate(1));
  const studentsPrevious30Days = countRowsBetweenDates(safeProfiles, "created_at", previous30StartIso, previous30EndIso);
  const flaggedThis7Days = safeFlaggedRows.filter((row) => {
    const date = normalizeDateValue(row.entry_date);
    return date && date >= last7StartIso && date < getRelativeManilaIsoDate(1);
  }).length;
  const flaggedPrevious7Days = safeFlaggedRows.filter((row) => {
    const date = normalizeDateValue(row.entry_date);
    return date && date >= previous7StartIso && date < previous7EndIso;
  }).length;
  const entriesYesterday = countRowsOnDate(safeJournals, "created_at", yesterdayIso);

  const activeUsageSeries = toMonthlyBuckets(safeProfiles, "created_at");
  const journalEntriesSeries = buildCurrentMonthJournalSeries(safeJournals, "created_at");
  const moodCountsByDate = new Map();

  for (const row of safeMoodRows) {
    const date = normalizeDateValue(row.mood_date);
    if (!date) continue;
    const current = moodCountsByDate.get(date) || createEmotionCounts();
    const moodId = normalizeEmotionId(row.mood_id);
    if (Object.prototype.hasOwnProperty.call(current, moodId)) {
      current[moodId] += 1;
    }
    moodCountsByDate.set(date, current);
  }

  const sortedBarangays = Object.entries(barangayCounts)
    .map(([label, value]) => ({ label: normalizeDisplayLabel(label), value: Number(value || 0) }))
    .sort((a, b) => b.value - a.value);

  const topBarangayConcerns = new Map();
  for (const journal of safeJournals) {
    const profile = safeProfiles.find(
      (item) => String(item.student_number || "").trim() === String(journal.student_number || "").trim(),
    );
    const barangay = normalizeDisplayLabel(profile?.barangay || "Unspecified");
    const text = [
      journal.summary,
      journal.admin_flag_reason,
      ...(Array.isArray(journal.insights) ? journal.insights : []),
    ].join(" ");
    const current = topBarangayConcerns.get(barangay) || 0;
    topBarangayConcerns.set(barangay, current + (text ? 1 : 0));
  }

  const demographicRows = sortedBarangays.slice(0, 6).map((item) => ({
    label: item.label,
    value: item.value,
  }));

  const demographicSplit = [
    { label: "Female", value: Number(genderCounts.FEMALE || 0) },
    { label: "Male", value: Number(genderCounts.MALE || 0) },
    { label: "Prefer not to say", value: Number(genderCounts["PREFER NOT TO SAY"] || genderCounts.UNSPECIFIED || 0) },
  ].filter((item) => item.value > 0);

  const programTotals = safeProfiles.reduce((acc, row) => {
    const program = normalizeDisplayLabel(row.program || "Unspecified");
    acc[program] = (acc[program] || 0) + 1;
    return acc;
  }, {});

  const topPrograms = Object.entries(programTotals)
    .map(([label, value]) => ({ label, value: Number(value || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  const activeUsageGroupsMap = new Map();
  for (const profile of safeProfiles) {
    const yearLevel = inferYearLevelFromStudentNumber(profile.student_number);
    if (yearLevel === "Unknown") continue;
    const current = activeUsageGroupsMap.get(yearLevel) || { label: yearLevel };
    const program = normalizeDisplayLabel(profile.program || "Unspecified");
    if (topPrograms.some((item) => item.label === program)) {
      current[program] = (current[program] || 0) + 1;
    }
    activeUsageGroupsMap.set(yearLevel, current);
  }

  const yearOrder = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  const activeUsageGroups = yearOrder
    .map((label) => activeUsageGroupsMap.get(label) || { label })
    .map((group) => ({
      ...group,
      ...Object.fromEntries(topPrograms.map((item) => [item.label, Number(group[item.label] || 0)])),
    }));

  const concernCounts = safeJournals.reduce((acc, row) => {
    const tags = getJournalTagsForAdmin(row);
    for (const tag of tags) {
      acc[tag] = (acc[tag] || 0) + 1;
    }
    return acc;
  }, {});

  const primaryConcerns = JOURNAL_TAG_OPTIONS.map((label) => ({
    label,
    value: Number(concernCounts[label] || 0),
  })).filter((item) => item.value > 0);

  const currentMonthLabels = [];
  const moodSeries = Object.fromEntries(EMOTION_IDS.map((emotionId) => [emotionId, []]));

  const appendMoodBucket = (bucketStartDay, bucketEndDay) => {
    const labelIsoDate = `${manilaNow.year}-${String(manilaNow.month).padStart(2, "0")}-${String(bucketEndDay).padStart(2, "0")}`;
    const label = new Date(`${labelIsoDate}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: MANILA_TIME_ZONE,
    });
    currentMonthLabels.push(label);
    const bucketCounts = createEmotionCounts();

    for (let day = bucketStartDay; day <= bucketEndDay; day += 1) {
      const isoDate = `${manilaNow.year}-${String(manilaNow.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const counts = moodCountsByDate.get(isoDate);
      if (!counts) continue;
      for (const emotionId of EMOTION_IDS) {
        bucketCounts[emotionId] += Number(counts[emotionId] || 0);
      }
    }

    for (const emotionId of EMOTION_IDS) {
      moodSeries[emotionId].push(bucketCounts[emotionId]);
    }
  };

  for (let bucketEndDay = 5; bucketEndDay <= manilaNow.day; bucketEndDay += 5) {
    const bucketStartDay = Math.max(1, bucketEndDay - 4);
    appendMoodBucket(bucketStartDay, bucketEndDay);
  }

  if (manilaNow.day % 5 !== 0) {
    const bucketStartDay = Math.floor(manilaNow.day / 5) * 5 + 1;
    const bucketEndDay = manilaNow.day;
    appendMoodBucket(bucketStartDay, bucketEndDay);
  }

  const caseAssignments = (caseAssignmentRows || []).map((row) => {
    const concern = getJournalTagsForAdmin(row)[0] || "Others";
    const counselorName = String(row.counselor_name || "").trim();
    const initials = counselorName ? counselorName.charAt(0).toUpperCase() : "?";

    return {
      concern,
      counselor: counselorName || "Unassigned",
      initials,
      role: counselorName ? toCounselorRoleLabel(row.counselor_role) : "Needs Assignment",
      status: counselorName ? "assigned" : "pending",
      student: row.student_name || row.student_number,
      studentNumber: row.student_number,
    };
  });

  return res.json({
    cards: {
      flaggedEntries: {
        value: totalFlaggedEntries,
        ...buildDelta(flaggedThis7Days, flaggedPrevious7Days),
      },
      totalStudents: {
        value: totalStudents,
        ...buildDelta(studentsThis30Days, studentsPrevious30Days),
      },
      totalEntries: {
        value: safeJournals.length,
        ...buildDelta(safeJournals.length, Math.max(0, safeJournals.length - entriesToday)),
      },
      scheduledToday: {
        value: scheduledEvents.todayCount,
        ...buildDelta(scheduledEvents.todayCount, scheduledEvents.yesterdayCount),
      },
      gender: genderCounts,
      course: courseCounts,
    },
    charts: {
      activeUsage: activeUsageSeries,
      journalEntries: journalEntriesSeries,
      barangay: sortedBarangays.slice(0, 4),
      genderDistribution: [
        { label: "Male", value: Number(genderCounts.MALE || 0) },
        { label: "Female", value: Number(genderCounts.FEMALE || 0) },
        { label: "Prefer not to say", value: Number(genderCounts["PREFER NOT TO SAY"] || genderCounts.UNSPECIFIED || 0) },
      ].filter((item) => item.value > 0),
      studentDemographics: {
        locations: demographicRows,
        genderSplit: demographicSplit,
      },
      activeUsageByCourseYear: {
        groups: activeUsageGroups,
        series: topPrograms,
      },
      primaryConcerns,
      topConcernsByBarangay: sortedBarangays
        .slice(0, 4)
        .map((item) => ({
          label: item.label,
          value: Number(topBarangayConcerns.get(item.label) || item.value),
        })),
      moodTrends: {
        labels: currentMonthLabels,
        series: EMOTION_OPTIONS.map(({ id, label }) => ({ key: id, label, values: moodSeries[id] })),
      },
    },
    warnings: {
      journalEntriesUnavailable: Boolean(journalsError),
      profilesUnavailable: Boolean(profilesError),
      scheduledTodayUnavailable: scheduledEvents.unavailable,
    },
    caseAssignments,
  });
});

router.get("/dashboard/risk-flags", async (_req, res) => {
  const result = await query(
    `
      select
        je.id,
        je.student_number,
        je.entry_date,
        je.title,
        je.summary,
        je.insights,
        je.risk_level,
        je.admin_flag_reason,
        je.primary_concern,
        je.concern_tags,
        je.support_response,
        je.support_response_at,
        je.created_at,
        coalesce(sp.full_name, '') as full_name,
        coalesce(sp.program, '') as program,
        coalesce(sp.email, '') as email
      from public.journal_entries je
      left join public.student_profiles sp on sp.student_number = je.student_number
      where (
        upper(coalesce(je.risk_level, 'NONE')) in ('LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'CRITICAL')
        or upper(coalesce(je.support_response, '')) = 'DECLINED'
      )
        and je.deleted_by_student_at is null
      order by je.entry_date desc, je.created_at desc
      limit 100
    `,
  );

  return res.json({
    entries: result.rows.map((row) => ({
      adminFlagReason: row.admin_flag_reason || null,
      concernTags: getJournalTagsForAdmin(row),
      createdAt: row.created_at,
      entryDate: row.entry_date,
      email: row.email || "",
      fullName: row.full_name || "",
      id: row.id,
      insights: Array.isArray(row.insights) ? row.insights : [],
      primaryConcern: row.primary_concern || null,
      program: row.program || "",
      riskLevel: row.risk_level,
      supportResponse: row.support_response || null,
      supportResponseAt: row.support_response_at || null,
      studentNumber: row.student_number,
      summary: row.summary || "",
      title: row.title || "",
    })),
  });
});

router.patch("/journal-entries/:entryId/flag", async (req, res) => {
  const entryId = normalizeCompactSpaces(req.params.entryId || "");
  const riskLevel = String(req.body?.riskLevel || "").trim().toUpperCase();
  const adminFlagReasonProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "adminFlagReason");
  const adminFlagReason = adminFlagReasonProvided
    ? normalizeCompactSpaces(req.body.adminFlagReason || "")
    : null;
  const primaryConcernProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "primaryConcern");
  const primaryConcern = primaryConcernProvided
    ? normalizeDisplayLabel(req.body.primaryConcern || "")
    : null;
  const supportResponseProvided = Object.prototype.hasOwnProperty.call(req.body || {}, "supportResponse");
  const supportResponse = supportResponseProvided
    ? String(req.body.supportResponse || "").trim().toUpperCase()
    : undefined;

  if (!entryId) {
    return res.status(400).json({ message: "Journal entry id is required." });
  }
  if (!["NONE", "LOW", "HIGH", "CRITICAL"].includes(riskLevel)) {
    return res.status(400).json({ message: "A valid risk flag is required." });
  }
  if (supportResponseProvided && supportResponse && !["CONTACTED", "DECLINED"].includes(supportResponse)) {
    return res.status(400).json({ message: "A valid intervention status is required." });
  }

  const result = await query(
    `
      update public.journal_entries
      set
        risk_level = $2,
        admin_flag_reason = case
          when $2 = 'NONE' then null
          when $7::boolean is true then nullif($3, '')
          else admin_flag_reason
        end,
        primary_concern = case
          when $8::boolean is true then nullif($4, '')
          else primary_concern
        end,
        support_response = case
          when $2 = 'NONE' then null
          when $5::boolean is false then support_response
          when nullif($6, '') is null then null
          else $6
        end,
        support_response_at = case
          when $2 = 'NONE' then null
          when $5::boolean is false then support_response_at
          when nullif($6, '') is null then null
          else coalesce(support_response_at, now())
        end,
        updated_at = now()
      where id = $1
        and deleted_by_student_at is null
      returning
        id,
        student_number,
        entry_date,
        title,
        summary,
        insights,
        risk_level,
        admin_flag_reason,
        primary_concern,
        concern_tags,
        support_response,
        support_response_at,
        created_at
    `,
    [
      entryId,
      riskLevel,
      adminFlagReason,
      primaryConcern,
      supportResponseProvided,
      supportResponse || null,
      adminFlagReasonProvided,
      primaryConcernProvided,
    ],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Journal entry not found." });
  }

  const row = result.rows[0];
  return res.json({
    entry: {
      adminFlagReason: row.admin_flag_reason || null,
      concernTags: getJournalTagsForAdmin(row),
      createdAt: row.created_at,
      entryDate: row.entry_date,
      id: row.id,
      insights: Array.isArray(row.insights) ? row.insights : [],
      primaryConcern: row.primary_concern || null,
      riskLevel: row.risk_level,
      studentNumber: row.student_number,
      summary: row.summary || "",
      supportResponse: row.support_response || null,
      supportResponseAt: row.support_response_at || null,
      title: row.title || "",
    },
    message: "Journal flag updated.",
  });
});

router.get("/risk-triggers", async (_req, res) => {
  const result = await query(
    `
      select
        id,
        phrase,
        risk_level,
        is_enabled,
        created_by_email,
        updated_by_email,
        created_at,
        updated_at
      from public.risk_trigger_words
      order by
        case risk_level when 'HIGH' then 0 when 'LOW' then 1 else 2 end,
        is_enabled desc,
        phrase asc
    `,
  );

  return res.json({
    riskLabels: RISK_LEVEL_LABELS,
    triggers: result.rows.map(serializeRiskTrigger),
  });
});

router.post("/risk-triggers", async (req, res) => {
  const { actorEmail, actorName, actorRole } = getActorPayload(req.body);
  const trigger = parseRiskTriggerPayload(req.body);

  if (!trigger.phrase) {
    return res.status(400).json({ message: "Trigger word or phrase is required." });
  }
  if (trigger.phrase.length > 120) {
    return res.status(400).json({ message: "Trigger phrase must be 120 characters or fewer." });
  }
  if (!trigger.riskLevel) {
    return res.status(400).json({ message: "Risk flag must be Distressed or Crisis." });
  }

  try {
    const result = await query(
      `
        insert into public.risk_trigger_words (
          phrase,
          risk_level,
          is_enabled,
          created_by_email,
          updated_by_email
        )
        values ($1, $2, $3, $4, $4)
        returning
          id,
          phrase,
          risk_level,
          is_enabled,
          created_by_email,
          updated_by_email,
          created_at,
          updated_at
      `,
      [trigger.phrase, trigger.riskLevel, trigger.isEnabled, actorEmail || null],
    );

    const created = serializeRiskTrigger(result.rows[0]);
    await writeAdminActivityLog({
      actionType: "RISK_TRIGGER_CREATED",
      actorEmail,
      actorName,
      actorRole,
      entityType: "RISK_TRIGGER",
      title: `Risk trigger added: ${created.phrase}`,
      description: `${created.phrase} was added as ${created.riskLabel}.`,
      metadata: {
        riskLevel: created.riskLevel,
        triggerId: created.id,
      },
    });

    return res.status(201).json({
      message: "Risk trigger added.",
      trigger: created,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "That trigger phrase already exists." });
    }
    throw error;
  }
});

router.patch("/risk-triggers/:triggerId", async (req, res) => {
  const triggerId = String(req.params.triggerId || "").trim();
  if (!isUuid(triggerId)) {
    return res.status(400).json({ message: "Valid trigger id is required." });
  }

  const existingResult = await query(
    `
      select id, phrase, risk_level, is_enabled
      from public.risk_trigger_words
      where id = $1::uuid
      limit 1
    `,
    [triggerId],
  );
  if (existingResult.rowCount === 0) {
    return res.status(404).json({ message: "Risk trigger not found." });
  }

  const { actorEmail, actorName, actorRole } = getActorPayload(req.body);
  const trigger = parseRiskTriggerPayload(req.body, existingResult.rows[0]);

  if (!trigger.phrase) {
    return res.status(400).json({ message: "Trigger word or phrase is required." });
  }
  if (trigger.phrase.length > 120) {
    return res.status(400).json({ message: "Trigger phrase must be 120 characters or fewer." });
  }
  if (!trigger.riskLevel) {
    return res.status(400).json({ message: "Risk flag must be Distressed or Crisis." });
  }

  try {
    const result = await query(
      `
        update public.risk_trigger_words
        set
          phrase = $2,
          risk_level = $3,
          is_enabled = $4,
          updated_by_email = $5,
          updated_at = now()
        where id = $1::uuid
        returning
          id,
          phrase,
          risk_level,
          is_enabled,
          created_by_email,
          updated_by_email,
          created_at,
          updated_at
      `,
      [triggerId, trigger.phrase, trigger.riskLevel, trigger.isEnabled, actorEmail || null],
    );

    const updated = serializeRiskTrigger(result.rows[0]);
    await writeAdminActivityLog({
      actionType: "RISK_TRIGGER_UPDATED",
      actorEmail,
      actorName,
      actorRole,
      entityType: "RISK_TRIGGER",
      title: `Risk trigger updated: ${updated.phrase}`,
      description: `${updated.phrase} is now ${updated.isEnabled ? "enabled" : "disabled"} as ${updated.riskLabel}.`,
      metadata: {
        isEnabled: updated.isEnabled,
        riskLevel: updated.riskLevel,
        triggerId: updated.id,
      },
    });

    return res.json({
      message: "Risk trigger updated.",
      trigger: updated,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "That trigger phrase already exists." });
    }
    throw error;
  }
});

router.delete("/risk-triggers/:triggerId", async (req, res) => {
  const triggerId = String(req.params.triggerId || "").trim();
  if (!isUuid(triggerId)) {
    return res.status(400).json({ message: "Valid trigger id is required." });
  }

  const existingResult = await query(
    `
      delete from public.risk_trigger_words
      where id = $1::uuid
      returning id, phrase, risk_level, is_enabled
    `,
    [triggerId],
  );
  if (existingResult.rowCount === 0) {
    return res.status(404).json({ message: "Risk trigger not found." });
  }

  const { actorEmail, actorName, actorRole } = getActorPayload(req.body);
  const deleted = serializeRiskTrigger(existingResult.rows[0]);
  await writeAdminActivityLog({
    actionType: "RISK_TRIGGER_DELETED",
    actorEmail,
    actorName,
    actorRole,
    entityType: "RISK_TRIGGER",
    title: `Risk trigger deleted: ${deleted.phrase}`,
    description: `${deleted.phrase} was removed from configurable risk triggers.`,
    metadata: {
      riskLevel: deleted.riskLevel,
      triggerId: deleted.id,
    },
  });

  return res.json({
    message: "Risk trigger deleted.",
    trigger: deleted,
  });
});

router.post("/students/:studentNumber/notify", async (req, res) => {
  const studentNumber = normalizeCompactSpaces(req.params.studentNumber || "");
  const title = normalizeCompactSpaces(req.body.title || "");
  const message = normalizeCompactSpaces(req.body.message || "");
  const actorEmail = normalizeEmail(req.body.actorEmail || "");
  const actorName = normalizeCompactSpaces(req.body.actorName || "");
  const actorRole = normalizeCompactSpaces(req.body.actorRole || "");

  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }
  if (!title) {
    return res.status(400).json({ message: "Notification title is required." });
  }
  if (!message) {
    return res.status(400).json({ message: "Notification message is required." });
  }

  await query(
    `
      insert into public.student_notifications (
        student_number,
        kind,
        title,
        message,
        metadata
      )
      values ($1, 'ADMIN_MESSAGE', $2, $3, $4::jsonb)
    `,
    [
      studentNumber,
      title,
      message,
      JSON.stringify({
        actorEmail: actorEmail || null,
        actorName: actorName || null,
        actorRole: actorRole || null,
      }),
    ],
  );

  await writeAdminActivityLog({
    actionType: "FLAGGED_ENTRY_MESSAGE_SENT",
    actorEmail,
    actorName,
    actorRole,
    entityType: "STUDENT_NOTIFICATION",
    title: `Message sent to ${studentNumber}`,
    description: `Admin sent a flagged-entry follow-up notification to ${studentNumber}.`,
    metadata: {
      studentNumber,
      notificationTitle: title,
    },
  });

  return res.json({ message: "Notification sent to student." });
});

router.get("/search", async (req, res) => {
  const search = normalizeCompactSpaces(req.query.q || "");
  if (!search || search.length < 2) {
    return res.json({ students: [], entries: [], appointments: [], team: [], riskTriggers: [] });
  }

  const pattern = `%${search}%`;
  const [studentsResult, entriesResult, appointmentsResult, teamResult, peerCounselorsResult, riskTriggersResult] = await Promise.all([
    query(
      `
        select
          sp.student_number,
          coalesce(nullif(sp.full_name, ''), sp.student_number) as full_name,
          coalesce(sp.program, '') as program,
          coalesce(sp.email, '') as email,
          coalesce(sp.barangay, '') as barangay,
          coalesce(sp.city, '') as city,
          coalesce(stats.total_entries, 0) as total_entries,
          stats.last_entry_at,
          coalesce(stats.flagged_entries, 0) as flagged_entries
        from public.student_profiles sp
        left join lateral (
          select
            count(*)::int as total_entries,
            max(je.created_at) as last_entry_at,
            count(*) filter (
              where upper(coalesce(je.risk_level, 'NONE')) in ('LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'CRITICAL')
                or upper(coalesce(je.support_response, '')) = 'DECLINED'
            )::int as flagged_entries
          from public.journal_entries je
          where je.student_number = sp.student_number
            and je.deleted_by_student_at is null
        ) stats on true
        where
          coalesce(sp.full_name, '') ilike $1
          or sp.student_number ilike $1
          or coalesce(sp.program, '') ilike $1
          or coalesce(sp.email, '') ilike $1
          or coalesce(sp.barangay, '') ilike $1
          or coalesce(sp.city, '') ilike $1
        order by full_name asc
        limit 12
      `,
      [pattern],
    ),
    query(
      `
        select
          je.id,
          je.student_number,
          je.entry_date,
          je.title,
          je.summary,
          je.primary_concern,
          je.concern_tags,
          je.risk_level,
          je.support_response,
          je.created_at,
          coalesce(sp.full_name, '') as full_name,
          coalesce(sp.program, '') as program
        from public.journal_entries je
        left join public.student_profiles sp on sp.student_number = je.student_number
        where je.deleted_by_student_at is null
          and (
            coalesce(je.title, '') ilike $1
            or coalesce(je.summary, '') ilike $1
            or coalesce(je.primary_concern, '') ilike $1
            or coalesce(je.admin_flag_reason, '') ilike $1
            or coalesce(sp.full_name, '') ilike $1
            or je.student_number ilike $1
            or coalesce(sp.program, '') ilike $1
          )
        order by je.entry_date desc, je.created_at desc
        limit 12
      `,
      [pattern],
    ),
    query(
      `
        select
          ca.id,
          ca.student_number,
          ca.appointment_date,
          ca.slot_time,
          ca.status,
          ca.support_type,
          ca.concern,
          ca.student_note,
          coalesce(sp.full_name, '') as student_name,
          coalesce(sp.program, '') as program,
          coalesce(aa.full_name, pc.full_name, '') as counselor_name
        from public.counselor_appointments ca
        left join public.student_profiles sp on sp.student_number = ca.student_number
        left join public.admin_accounts aa on aa.id = ca.counselor_id
        left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
        where
          ca.student_number ilike $1
          or coalesce(sp.full_name, '') ilike $1
          or coalesce(sp.program, '') ilike $1
          or coalesce(ca.concern, '') ilike $1
          or coalesce(ca.student_note, '') ilike $1
          or coalesce(ca.status, '') ilike $1
          or coalesce(ca.support_type, '') ilike $1
          or coalesce(aa.full_name, pc.full_name, '') ilike $1
        order by ca.appointment_date desc, ca.slot_time desc
        limit 12
      `,
      [pattern],
    ),
    query(
      `
        select
          id,
          coalesce(full_name, email) as full_name,
          email,
          role,
          is_active,
          created_at
        from public.admin_accounts
        where
          coalesce(full_name, '') ilike $1
          or email ilike $1
          or role ilike $1
        order by full_name asc
        limit 12
      `,
      [pattern],
    ),
    query(
      `
        select
          id,
          full_name,
          email,
          student_number,
          program,
          invitation_status,
          is_active,
          created_at
        from public.peer_counselors
        where
          full_name ilike $1
          or email ilike $1
          or coalesce(student_number, '') ilike $1
          or coalesce(program, '') ilike $1
        order by full_name asc
        limit 12
      `,
      [pattern],
    ),
    query(
      `
        select
          id,
          phrase,
          risk_level,
          is_enabled,
          created_at
        from public.risk_trigger_words
        where
          phrase ilike $1
          or risk_level ilike $1
        order by phrase asc
        limit 12
      `,
      [pattern],
    ),
  ]);

  return res.json({
    students: studentsResult.rows.map((row) => ({
      studentNumber: row.student_number,
      fullName: row.full_name,
      program: normalizeDisplayLabel(row.program || "Unspecified"),
      email: row.email || "",
      barangay: row.barangay || "",
      city: row.city || "",
      totalEntries: Number(row.total_entries || 0),
      lastEntryAt: row.last_entry_at || null,
      flaggedEntries: Number(row.flagged_entries || 0),
      status: toStudentStatus(row),
    })),
    entries: entriesResult.rows.map((row) => ({
      id: row.id,
      studentNumber: row.student_number,
      fullName: row.full_name || "",
      program: normalizeDisplayLabel(row.program || "Unspecified"),
      entryDate: normalizeDateValue(row.entry_date),
      title: row.title || "",
      summary: row.summary || "",
      primaryConcern: row.primary_concern || null,
      concernTags: getJournalTagsForAdmin(row),
      riskLevel: row.risk_level || "NONE",
      supportResponse: row.support_response || null,
      createdAt: row.created_at,
    })),
    appointments: appointmentsResult.rows.map((row) => ({
      id: row.id,
      studentNumber: row.student_number,
      studentName: row.student_name || row.student_number,
      program: normalizeDisplayLabel(row.program || "Unspecified"),
      appointmentDate: normalizeDateValue(row.appointment_date),
      slotTime: row.slot_time,
      status: row.status,
      supportType: row.support_type,
      concern: row.concern || "",
      studentNote: row.student_note || "",
      counselorName: row.counselor_name || "",
    })),
    team: [
      ...teamResult.rows.map((row) => ({
        id: row.id,
        kind: "Admin",
        fullName: row.full_name,
        email: row.email,
        role: toCounselorRoleLabel(row.role),
        status: row.is_active ? "Active" : "Inactive",
        createdAt: row.created_at,
      })),
      ...peerCounselorsResult.rows.map((row) => {
        const invitationStatus = String(row.invitation_status || (row.is_active ? "ACCEPTED" : "DECLINED")).toUpperCase();
        return {
          id: row.id,
          kind: "Peer Counselor",
          fullName: row.full_name,
          email: row.email,
          role: "Peer Counselor",
          studentNumber: row.student_number || "",
          program: normalizeDisplayLabel(row.program || "Unspecified"),
          status: invitationStatus === "PENDING" ? "Pending" : row.is_active && invitationStatus === "ACCEPTED" ? "Active" : "Declined",
          createdAt: row.created_at,
        };
      }),
    ],
    riskTriggers: riskTriggersResult.rows.map((row) => ({
      id: row.id,
      phrase: row.phrase,
      riskLevel: row.risk_level,
      riskLabel: getRiskLevelLabel(row.risk_level),
      isEnabled: Boolean(row.is_enabled),
      createdAt: row.created_at,
    })),
  });
});

router.get("/analytics", async (req, res) => {
  const { rangeKey, startDate, endDate } = resolveAnalyticsRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );
  const [profilesResult, journalRowsResult, appointmentsResult, counselorsResult, peerCounselorsResult] = await Promise.all([
    query(
      `
        select
          student_number,
          coalesce(nullif(full_name, ''), student_number) as full_name,
          coalesce(email, '') as email,
          coalesce(program, '') as program,
          coalesce(gender, 'Prefer not to say') as gender,
          coalesce(region, '') as region,
          coalesce(province, '') as province,
          coalesce(city, '') as city,
          coalesce(barangay, '') as barangay,
          birthdate,
          created_at
        from public.student_profiles
        order by full_name asc, student_number asc
      `,
    ),
    query(
      `
        select
          student_number,
          entry_date,
          created_at,
          primary_concern,
          concern_tags,
          summary,
          admin_flag_reason,
          risk_level,
          support_response,
          support_response_at
        from public.journal_entries
        where entry_date between $1::date and $2::date
        order by entry_date asc, created_at asc
      `,
      [startDate, endDate],
    ),
    query(
      `
        select
          ca.id,
          ca.appointment_date,
          ca.status,
          ca.student_number,
          ca.concern,
          coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type,
          coalesce(ca.peer_counselor_id, ca.counselor_id) as assignee_id,
          coalesce(nullif(aa.full_name, ''), pc.full_name, 'Unassigned') as counselor_name,
          case
            when coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) = 'PEER'
              then 'PEER_COUNSELOR'
            else coalesce(aa.role, 'COUNSELOR')
          end as counselor_role
        from public.counselor_appointments ca
        left join public.admin_accounts aa on aa.id = ca.counselor_id
        left join public.peer_counselors pc on pc.id = ca.peer_counselor_id
        where ca.appointment_date between $1::date and $2::date
        order by ca.appointment_date asc
      `,
      [startDate, endDate],
    ),
    query(
      `
        select
          aa.id,
          coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as full_name,
          coalesce(aa.role, 'COUNSELOR') as role
        from public.admin_accounts aa
        where aa.is_active = true
          and coalesce(aa.role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
        order by case when coalesce(aa.role, 'COUNSELOR') = 'HEAD_COUNSELOR' then 0 else 1 end, full_name asc
      `,
    ),
    query(
      `
        select
          pc.id,
          coalesce(nullif(pc.full_name, ''), pc.student_number, pc.email) as full_name
        from public.peer_counselors pc
        where pc.is_active = true
        order by full_name asc
      `,
    ),
  ]);

  const profileRows = profilesResult.rows || [];
  const totalStudents = profileRows.length;
  const journalRows = journalRowsResult.rows || [];
  const appointmentRows = appointmentsResult.rows || [];
  const counselors = counselorsResult.rows || [];
  const peerCounselors = peerCounselorsResult.rows || [];
  const rangeDays = getDaysBetweenInclusive(startDate, endDate);
  const previousStartDate = addDaysToIsoDate(startDate, -rangeDays);
  const previousEndDate = addDaysToIsoDate(startDate, -1);

  const [previousJournalCountResult, previousAppointmentCountResult] = await Promise.all([
    query(
      `
        select count(*)::int as total
        from public.journal_entries
        where entry_date between $1::date and $2::date
      `,
      [previousStartDate, previousEndDate],
    ),
    query(
      `
        select count(*)::int as total
        from public.counselor_appointments
        where appointment_date between $1::date and $2::date
          and status in ('CONFIRMED', 'COMPLETED')
      `,
      [previousStartDate, previousEndDate],
    ),
  ]);

  const journalCount = journalRows.length;
  const previousJournalCount = Number(previousJournalCountResult.rows[0]?.total || 0);
  const activeStudents = new Set(
    journalRows.map((row) => String(row.student_number || "").trim()).filter(Boolean),
  ).size;
  const previousActiveStudents = new Set(
    (
      await query(
        `
          select distinct student_number
          from public.journal_entries
          where entry_date between $1::date and $2::date
        `,
        [previousStartDate, previousEndDate],
      )
    ).rows.map((row) => String(row.student_number || "").trim()).filter(Boolean),
  ).size;
  const counselingSessions = appointmentRows.filter((row) =>
    ["CONFIRMED", "COMPLETED"].includes(String(row.status || "").toUpperCase()),
  ).length;
  const previousCounselingSessions = Number(previousAppointmentCountResult.rows[0]?.total || 0);

  const metricCards = {
    totalStudents: {
      label: "Total Students",
      value: totalStudents,
      ...buildDelta(totalStudents, Math.max(0, totalStudents - previousActiveStudents)),
    },
    activeInRange: {
      label: rangeKey === "7d" ? "Active This Week" : rangeKey === "90d" ? "Active This Quarter" : "Active This Month",
      value: activeStudents,
      ...buildDelta(activeStudents, previousActiveStudents),
    },
    averageEntriesPerStudent: {
      label: "Avg Entries/Student",
      value: calculateAverageEntriesPerStudent(journalCount, totalStudents),
      deltaValue:
        calculateAverageEntriesPerStudent(journalCount, totalStudents) -
        calculateAverageEntriesPerStudent(previousJournalCount, totalStudents),
    },
    counselingSessions: {
      label: "Counseling Sessions",
      value: counselingSessions,
      ...buildDelta(counselingSessions, previousCounselingSessions),
    },
  };

  const journalEntryVolume = buildDailyTrend(journalRows, startDate, endDate, "entry_date");
  const windowBuckets = buildWindowBuckets(startDate, endDate, rangeDays <= 30 ? 4 : 6);
  const concernTotals = new Map();
  const rowConcernTags = journalRows.map((row) => {
    const tags = getJournalTagsForAdmin(row);

    for (const tag of tags) {
      concernTotals.set(tag, (concernTotals.get(tag) || 0) + 1);
    }

    return {
      entryDate: normalizeDateValue(row.entry_date),
      tags,
    };
  });

  const topConcernNames = [...concernTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);

  const concernSeriesMap = new Map(
    topConcernNames.map((name) => [
      name,
      { key: name.toLowerCase().replace(/[^a-z]+/g, "-"), label: name, values: Array(windowBuckets.length).fill(0) },
    ]),
  );

  for (const row of rowConcernTags) {
    const bucketIndex = windowBuckets.findIndex((bucket) => row.entryDate >= bucket.startDate && row.entryDate <= bucket.endDate);
    if (bucketIndex < 0) continue;

    for (const tag of row.tags) {
      if (!concernSeriesMap.has(tag)) continue;
      concernSeriesMap.get(tag).values[bucketIndex] += 1;
    }
  }

  const scheduledAppointmentRows = appointmentRows.filter((row) =>
    ["CONFIRMED", "COMPLETED"].includes(String(row.status || "").toUpperCase()),
  );
  const consultationCategoryCounts = Object.fromEntries(
    CONSULTATION_CONCERN_CATEGORY_DEFS.map((definition) => [definition.label, 0]),
  );

  for (const row of scheduledAppointmentRows) {
    const category = normalizeConsultationConcernCategory(row.concern);
    consultationCategoryCounts[category] = (consultationCategoryCounts[category] || 0) + 1;
  }

  const consultationVolumeByCategory = CONSULTATION_CONCERN_CATEGORY_DEFS.map((definition) => ({
    label: definition.label,
    value: Number(consultationCategoryCounts[definition.label] || 0),
  }));

  const workloadCounts = scheduledAppointmentRows.reduce((acc, row) => {
    const supportType = String(row.support_type || "").toUpperCase() === "PEER" ? "PEER" : "GUIDANCE";
    const key = `${supportType}:${row.assignee_id || normalizeCompactSpaces(row.counselor_name || "Unassigned")}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const workloadAssignees = [
    ...counselors.map((counselor) => ({
      key: `GUIDANCE:${counselor.id}`,
      label: counselor.full_name,
      role: toCounselorRoleLabel(counselor.role),
      supportType: "GUIDANCE",
    })),
    ...peerCounselors.map((peerCounselor) => ({
      key: `PEER:${peerCounselor.id}`,
      label: peerCounselor.full_name,
      role: "Peer Counselor",
      supportType: "PEER",
    })),
  ];

  const counselorWorkload = workloadAssignees.map((assignee) => ({
    ...assignee,
    value: Number(workloadCounts[assignee.key] || 0),
  }));

  const weeklyBuckets = buildWindowBuckets(startDate, endDate, 4);
  const crisisRiskSeries = Array(weeklyBuckets.length).fill(0);
  const distressedRiskSeries = Array(weeklyBuckets.length).fill(0);

  for (const row of journalRows) {
    const riskLevel = String(row.risk_level || "").trim().toUpperCase();
    const entryDate = normalizeDateValue(row.entry_date);
    const bucketIndex = weeklyBuckets.findIndex((bucket) => entryDate >= bucket.startDate && entryDate <= bucket.endDate);
    if (bucketIndex < 0) continue;

    if (["HIGH", "CRITICAL"].includes(riskLevel)) {
      crisisRiskSeries[bucketIndex] += 1;
    } else if (["LOW", "MEDIUM", "MODERATE"].includes(riskLevel)) {
      distressedRiskSeries[bucketIndex] += 1;
    }
  }

  const resolutionRates = [
    buildResolutionRate(
      journalRows,
      "Crisis / Critical Need",
      (row) => ["HIGH", "CRITICAL"].includes(String(row.risk_level || "").toUpperCase()),
      48,
      "emerald",
    ),
    buildResolutionRate(
      journalRows,
      "Distressed / Needs Support",
      (row) => ["LOW", "MEDIUM", "MODERATE"].includes(String(row.risk_level || "").toUpperCase()),
      120,
      "amber",
    ),
  ];

  const reportStatsByStudent = new Map();
  const getReportStats = (studentNumber) => {
    const key = String(studentNumber || "").trim();
    if (!reportStatsByStudent.has(key)) {
      reportStatsByStudent.set(key, {
        entriesInRange: 0,
        flagsInRange: 0,
        highRiskFlags: 0,
        criticalRiskFlags: 0,
        mediumRiskFlags: 0,
        declinedSupport: 0,
        contactedSupport: 0,
        counselingSessions: 0,
        confirmedSessions: 0,
        completedSessions: 0,
        concernCounts: new Map(),
        lastEntryDate: "",
        lastEntryCreatedAt: "",
        latestRiskLevel: "NONE",
        latestSupportResponse: "",
      });
    }
    return reportStatsByStudent.get(key);
  };

  for (const row of journalRows) {
    const studentNumber = String(row.student_number || "").trim();
    if (!studentNumber) continue;
    const stats = getReportStats(studentNumber);
    const riskLevel = String(row.risk_level || "NONE").trim().toUpperCase();
    const supportResponse = String(row.support_response || "").trim().toUpperCase();
    const entryDate = normalizeDateValue(row.entry_date);
    const createdAt = row.created_at ? new Date(row.created_at).toISOString() : "";
    const tags = getJournalTagsForAdmin(row);

    stats.entriesInRange += 1;
    if (["LOW", "HIGH", "CRITICAL", "MEDIUM", "MODERATE"].includes(riskLevel) || supportResponse === "DECLINED") {
      stats.flagsInRange += 1;
    }
    if (["HIGH", "CRITICAL"].includes(riskLevel)) stats.highRiskFlags += 1;
    if (riskLevel === "CRITICAL") stats.criticalRiskFlags += 1;
    if (["LOW", "MEDIUM", "MODERATE"].includes(riskLevel)) stats.mediumRiskFlags += 1;
    if (supportResponse === "DECLINED") stats.declinedSupport += 1;
    if (supportResponse === "CONTACTED") stats.contactedSupport += 1;

    for (const tag of tags) {
      stats.concernCounts.set(tag, (stats.concernCounts.get(tag) || 0) + 1);
    }

    if (!stats.lastEntryCreatedAt || createdAt > stats.lastEntryCreatedAt) {
      stats.lastEntryDate = entryDate;
      stats.lastEntryCreatedAt = createdAt;
      stats.latestRiskLevel = riskLevel || "NONE";
      stats.latestSupportResponse = supportResponse;
    }
  }

  for (const row of appointmentRows) {
    const studentNumber = String(row.student_number || "").trim();
    if (!studentNumber) continue;
    const stats = getReportStats(studentNumber);
    const status = String(row.status || "").toUpperCase();
    if (["CONFIRMED", "COMPLETED"].includes(status)) {
      stats.counselingSessions += 1;
    }
    if (status === "CONFIRMED") stats.confirmedSessions += 1;
    if (status === "COMPLETED") stats.completedSessions += 1;
  }

  const studentReportRows = profileRows.map((profile) => {
    const studentNumber = String(profile.student_number || "").trim();
    const stats = getReportStats(studentNumber);
    const topConcern =
      [...stats.concernCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    return {
      studentNumber,
      fullName: profile.full_name || studentNumber,
      email: profile.email || "",
      program: normalizeDisplayLabel(profile.program || "Unspecified"),
      yearLevel: inferYearLevelFromStudentNumber(studentNumber),
      gender: normalizeDisplayLabel(profile.gender || "Prefer not to say"),
      region: profile.region || "",
      province: profile.province || "",
      city: profile.city || "",
      barangay: profile.barangay || "",
      birthdate: normalizeDateValue(profile.birthdate) || "",
      registeredAt: profile.created_at || null,
      entriesInRange: stats.entriesInRange,
      flagsInRange: stats.flagsInRange,
      highRiskFlags: stats.highRiskFlags,
      criticalRiskFlags: stats.criticalRiskFlags,
      mediumRiskFlags: stats.mediumRiskFlags,
      declinedSupport: stats.declinedSupport,
      contactedSupport: stats.contactedSupport,
      counselingSessions: stats.counselingSessions,
      confirmedSessions: stats.confirmedSessions,
      completedSessions: stats.completedSessions,
      topConcern,
      latestRiskLevel: stats.latestRiskLevel,
      latestSupportResponse: stats.latestSupportResponse,
      lastEntryDate: stats.lastEntryDate,
      reportStatus: stats.flagsInRange > 0 ? "Flagged" : stats.entriesInRange > 0 ? "Active" : "No entries in range",
    };
  });

  return res.json({
    filters: {
      rangeKey,
      startDate,
      endDate,
    },
    cards: metricCards,
    charts: {
      journalEntryVolume,
      concernTrends: {
        labels: windowBuckets.map((bucket) => bucket.label),
        series: [...concernSeriesMap.values()],
      },
      consultationVolumeByCategory,
      counselorWorkload,
      atRiskStudentTrends: {
        labels: weeklyBuckets.map((_, index) => `W${index + 1}`),
        series: [
          { key: "crisis", label: "Crisis / Critical Need", values: crisisRiskSeries },
          { key: "distressed", label: "Distressed / Needs Support", values: distressedRiskSeries },
        ],
      },
      resolutionRates,
    },
    reports: {
      students: studentReportRows,
    },
  });
});

router.get("/roles", async (_req, res) => {
  const [membersResult, peerMembersResult] = await Promise.all([
    query(
      `
        select
          aa.id,
          aa.email,
          coalesce(nullif(aa.full_name, ''), split_part(aa.email, '@', 1)) as full_name,
          coalesce(aa.role, 'COUNSELOR') as role,
          coalesce(aa.gender, 'Prefer not to say') as gender,
          coalesce(aa.profile_picture_url, '') as profile_picture_url,
          coalesce(aa.specialties, '[]'::jsonb) as specialties,
          aa.is_active,
          aa.created_at,
          coalesce(stats.assigned_students, 0) as assigned_students
        from public.admin_accounts aa
        left join lateral (
          select count(distinct ca.student_number)::int as assigned_students
          from public.counselor_appointments ca
          where ca.counselor_id = aa.id
            and ca.status = 'CONFIRMED'
        ) stats on true
        where coalesce(aa.role, 'COUNSELOR') in ('HEAD_COUNSELOR', 'COUNSELOR')
        order by case when coalesce(aa.role, 'COUNSELOR') = 'HEAD_COUNSELOR' then 0 else 1 end, full_name asc
      `,
    ),
    query(
      `
        select
          pc.id,
          pc.email,
          pc.full_name,
          pc.gender,
          coalesce(pc.student_number, '') as student_number,
          coalesce(pc.program, '') as program,
          coalesce(pc.profile_picture_url, '') as profile_picture_url,
          coalesce(pc.specialties, '[]'::jsonb) as specialties,
          pc.is_active,
          coalesce(pc.invitation_status, case when pc.is_active then 'ACCEPTED' else 'DECLINED' end) as invitation_status,
          pc.created_at,
          coalesce(stats.assigned_students, 0) as assigned_students
        from public.peer_counselors pc
        left join lateral (
          select count(distinct ca.student_number)::int as assigned_students
          from public.counselor_appointments ca
          where ca.peer_counselor_id = pc.id
            and ca.status = 'CONFIRMED'
        ) stats on true
        order by
          case coalesce(pc.invitation_status, case when pc.is_active then 'ACCEPTED' else 'DECLINED' end)
            when 'ACCEPTED' then 0
            when 'PENDING' then 1
            else 2
          end,
          pc.full_name asc
      `,
    ),
  ]);

  const adminMembers = membersResult.rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    roleLabel: toRoleManagementLabel(row.role),
    department: row.role === "HEAD_COUNSELOR" ? "Administration" : "Counseling Office",
    assignedStudents: Number(row.assigned_students || 0),
    status: row.is_active ? "Active" : "Inactive",
    isActive: Boolean(row.is_active),
    profilePictureUrl: row.profile_picture_url || "",
    gender: row.gender,
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    createdAt: row.created_at,
    memberType: "ADMIN",
    canEdit: true,
    canDelete: true,
  }));
  const peerMembers = peerMembersResult.rows.map((row) => {
    const invitationStatus = String(row.invitation_status || (row.is_active ? "ACCEPTED" : "DECLINED")).toUpperCase();
    const isActive = Boolean(row.is_active) && invitationStatus === "ACCEPTED";
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: "PEER_ADVISOR",
      roleLabel: "Peer Counselor",
      department: "Peer Support",
      assignedStudents: Number(row.assigned_students || 0),
      status: invitationStatus === "PENDING" ? "Pending" : isActive ? "Active" : "Declined",
      isActive,
      invitationStatus,
      profilePictureUrl: row.profile_picture_url || "",
      gender: row.gender,
      specialties: Array.isArray(row.specialties) ? row.specialties : [],
      studentNumber: row.student_number || "",
      program: row.program || "",
      createdAt: row.created_at,
      memberType: "PEER",
      canEdit: false,
      canDelete: false,
    };
  });
  const members = [...adminMembers, ...peerMembers];

  return res.json({
    members,
    summary: {
      superAdminCount: adminMembers.filter((item) => item.role === "HEAD_COUNSELOR" && item.isActive).length,
      counselorCount: adminMembers.filter((item) => item.role === "COUNSELOR" && item.isActive).length,
      peerAdvisorCount: peerMembers.filter((item) => item.isActive).length,
    },
  });
});

router.get("/students", async (req, res) => {
  const search = normalizeCompactSpaces(req.query.search || "");
  const program = normalizeCompactSpaces(req.query.program || "");
  const status = normalizeCompactSpaces(req.query.status || "").toLowerCase();

  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    const searchIndex = values.length;
    conditions.push(
      `(
        coalesce(sp.full_name, '') ilike $${searchIndex}
        or sp.student_number ilike $${searchIndex}
        or coalesce(sp.program, '') ilike $${searchIndex}
        or coalesce(sp.email, '') ilike $${searchIndex}
        or coalesce(sp.barangay, '') ilike $${searchIndex}
        or coalesce(sp.city, '') ilike $${searchIndex}
        or coalesce(sp.province, '') ilike $${searchIndex}
      )`,
    );
  }

  if (program) {
    values.push(program);
    const programIndex = values.length;
    conditions.push(`lower(coalesce(sp.program, '')) = lower($${programIndex})`);
  }

  if (status === "flagged") {
    conditions.push("coalesce(stats.flagged_entries, 0) > 0");
  } else if (status === "active") {
    conditions.push("coalesce(stats.flagged_entries, 0) = 0 and coalesce(stats.total_entries, 0) > 0");
  } else if (status === "inactive") {
    conditions.push("coalesce(stats.total_entries, 0) = 0");
  }

  const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const result = await query(
    `
      select
        sp.student_number,
        coalesce(nullif(sp.full_name, ''), sp.student_number) as full_name,
        coalesce(sp.email, '') as email,
        coalesce(sp.program, '') as program,
        coalesce(sp.region, '') as region,
        coalesce(sp.province, '') as province,
        coalesce(sp.city, '') as city,
        coalesce(sp.barangay, '') as barangay,
        coalesce(sp.street, '') as street,
        sp.birthdate,
        sp.created_at,
        coalesce(stats.total_entries, 0) as total_entries,
        stats.last_entry_at,
        coalesce(stats.flagged_entries, 0) as flagged_entries
      from public.student_profiles sp
      left join lateral (
        select
          count(*)::int as total_entries,
          max(je.created_at) as last_entry_at,
          count(*) filter (
            where upper(coalesce(je.risk_level, 'NONE')) in ('LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'CRITICAL')
              or upper(coalesce(je.support_response, '')) = 'DECLINED'
          )::int as flagged_entries
        from public.journal_entries je
        where je.student_number = sp.student_number
          and je.deleted_by_student_at is null
      ) stats on true
      ${whereClause}
      order by
        case
          when coalesce(stats.flagged_entries, 0) > 0 then 0
          when coalesce(stats.total_entries, 0) = 0 then 2
          else 1
        end,
        full_name asc
    `,
    values,
  );

  const students = result.rows.map((row) => ({
    studentNumber: row.student_number,
    fullName: row.full_name,
    email: row.email,
    program: normalizeDisplayLabel(row.program || "Unspecified"),
    region: row.region || "",
    province: row.province || "",
    city: row.city || "",
    barangay: row.barangay || "",
    street: row.street || "",
    birthdate: row.birthdate || null,
    createdAt: row.created_at,
    totalEntries: Number(row.total_entries || 0),
    lastEntryAt: row.last_entry_at || null,
    flaggedEntries: Number(row.flagged_entries || 0),
    status: toStudentStatus(row),
  }));

  const programsResult = await query(
    `
      select distinct coalesce(program, '') as program
      from public.student_profiles
      where coalesce(program, '') <> ''
      order by program asc
    `,
  );
  const programs = [...new Set(programsResult.rows.map((row) => normalizeDisplayLabel(row.program)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return res.json({ students, programs });
});

router.get("/students/recent-entries", async (req, res) => {
  const search = normalizeCompactSpaces(req.query.search || "");
  const entryScope = normalizeCompactSpaces(req.query.entryScope || "all").toLowerCase();
  const dateRange = normalizeCompactSpaces(req.query.dateRange || "all").toLowerCase();
  const concern = normalizeCompactSpaces(req.query.concern || "");

  const values = [];
  const conditions = ["je.deleted_by_student_at is null"];

  if (search) {
    values.push(`%${search}%`);
    const searchIndex = values.length;
    conditions.push(
      `(
        coalesce(sp.full_name, '') ilike $${searchIndex}
        or je.student_number ilike $${searchIndex}
        or coalesce(sp.program, '') ilike $${searchIndex}
        or coalesce(je.title, '') ilike $${searchIndex}
        or coalesce(je.summary, '') ilike $${searchIndex}
        or coalesce(je.primary_concern, '') ilike $${searchIndex}
        or coalesce(je.admin_flag_reason, '') ilike $${searchIndex}
      )`,
    );
  }

  const flaggedCondition =
    "(upper(coalesce(je.risk_level, 'NONE')) in ('LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'CRITICAL') or upper(coalesce(je.support_response, '')) = 'DECLINED')";
  if (entryScope === "flagged") {
    conditions.push(flaggedCondition);
  } else if (entryScope === "balanced") {
    conditions.push(`not ${flaggedCondition}`);
  }

  if (dateRange === "today") {
    conditions.push("je.entry_date = current_date");
  } else if (dateRange === "7" || dateRange === "30") {
    values.push(Number(dateRange));
    const dateIndex = values.length;
    conditions.push(`je.entry_date >= current_date - ($${dateIndex}::int - 1)`);
  }

  if (concern) {
    values.push(concern);
    const concernIndex = values.length;
    conditions.push(
      `(coalesce(je.primary_concern, '') = $${concernIndex} or exists (
        select 1
        from jsonb_array_elements_text(coalesce(je.concern_tags, '[]'::jsonb)) as tag(value)
        where tag.value = $${concernIndex}
      ))`,
    );
  }

  const whereClause = `where ${conditions.join(" and ")}`;
  const result = await query(
    `
      select
        je.id,
        je.student_number,
        je.entry_date,
        je.title,
        je.summary,
        je.insights,
        je.risk_level,
        je.admin_flag_reason,
        je.primary_concern,
        je.concern_tags,
        je.support_response,
        je.created_at,
        je.updated_at,
        coalesce(sp.full_name, '') as full_name,
        coalesce(sp.program, '') as program
      from public.journal_entries je
      left join public.student_profiles sp on sp.student_number = je.student_number
      ${whereClause}
      order by je.entry_date desc, je.created_at desc
      limit 50
    `,
    values,
  );

  const entries = result.rows.map((row) => ({
    id: row.id,
    studentNumber: row.student_number,
    fullName: row.full_name || row.student_number,
    program: normalizeDisplayLabel(row.program || "Unspecified"),
    entryDate: normalizeDateValue(row.entry_date),
    title: row.title || "",
    summary: row.summary || "",
    insights: normalizeStringArray(row.insights),
    riskLevel: row.risk_level || "NONE",
    adminFlagReason: row.admin_flag_reason || null,
    primaryConcern: row.primary_concern || null,
    concernTags: getJournalTagsForAdmin(row),
    supportResponse: row.support_response || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const concerns = [...new Set(entries.flatMap((entry) => [entry.primaryConcern, ...entry.concernTags].filter(Boolean)))]
    .sort((a, b) => a.localeCompare(b));

  return res.json({ entries, concerns });
});

router.get("/students/:studentNumber", async (req, res) => {
  const studentNumber = normalizeCompactSpaces(req.params.studentNumber || "");
  if (!studentNumber) {
    return res.status(400).json({ message: "Student number is required." });
  }

  const profileResult = await query(
    `
      select
        sp.student_number,
        coalesce(nullif(sp.full_name, ''), sp.student_number) as full_name,
        coalesce(sp.email, '') as email,
        coalesce(sp.program, '') as program,
        coalesce(sp.region, '') as region,
        coalesce(sp.province, '') as province,
        coalesce(sp.city, '') as city,
        coalesce(sp.barangay, '') as barangay,
        coalesce(sp.street, '') as street,
        sp.birthdate,
        sp.created_at
      from public.student_profiles sp
      where sp.student_number = $1
      limit 1
    `,
    [studentNumber],
  );

  if (profileResult.rowCount === 0) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  const entriesResult = await query(
    `
      select
        je.id,
        je.entry_date,
        je.title,
        je.summary,
        je.insights,
        je.risk_level,
        je.admin_flag_reason,
        je.primary_concern,
        je.concern_tags,
        je.support_response,
        je.support_response_at,
        je.created_at,
        je.updated_at,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', jem.id,
              'role', jem.role,
              'text', jem.message_text,
              'createdAt', jem.created_at
            )
            order by jem.created_at asc, jem.id asc
          ) filter (where jem.id is not null),
          '[]'::jsonb
        ) as messages
      from public.journal_entries je
      left join public.journal_entry_messages jem on jem.entry_id = je.id
      where je.student_number = $1
        and je.deleted_by_student_at is null
      group by je.id
      order by je.entry_date desc, je.created_at desc
    `,
    [studentNumber],
  );

  const entries = entriesResult.rows.map((row) => {
    const riskLevel = String(row.risk_level || "NONE").toUpperCase();
    const allMessages = Array.isArray(row.messages)
      ? row.messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.text,
          createdAt: message.createdAt,
        }))
      : [];
    const supportResponse = String(row.support_response || "").toUpperCase();
    const activeRiskReview = ["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"].includes(riskLevel);
    const canViewConversation =
      activeRiskReview ||
      supportResponse === "DECLINED";

    return {
      id: row.id,
      entryDate: normalizeDateValue(row.entry_date),
      title: row.title || "",
      summary: row.summary || "",
      insights: normalizeStringArray(row.insights),
      riskLevel,
      adminFlagReason: row.admin_flag_reason || null,
      primaryConcern: row.primary_concern || null,
      concernTags: getJournalTagsForAdmin(row),
      supportResponse: row.support_response || null,
      supportResponseAt: row.support_response_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      canViewConversation,
      conversationHidden: !canViewConversation && allMessages.length > 0,
      messageCount: allMessages.length,
      messages: canViewConversation ? allMessages : [],
    };
  });

  const profile = profileResult.rows[0];
  const flaggedEntryCount = entries.filter((entry) => {
    const riskLevel = String(entry.riskLevel || "").toUpperCase();
    const supportResponse = String(entry.supportResponse || "").toUpperCase();
    return ["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"].includes(riskLevel) || supportResponse === "DECLINED";
  }).length;
  return res.json({
    profile: {
      studentNumber: profile.student_number,
      fullName: profile.full_name,
      email: profile.email,
      program: normalizeDisplayLabel(profile.program || "Unspecified"),
      region: profile.region || "",
      province: profile.province || "",
      city: profile.city || "",
      barangay: profile.barangay || "",
      street: profile.street || "",
      birthdate: profile.birthdate || null,
      createdAt: profile.created_at,
      totalEntries: entries.length,
      flaggedEntries: flaggedEntryCount,
      status: toStudentStatus({
        total_entries: entries.length,
        flagged_entries: flaggedEntryCount,
      }),
    },
    entries,
  });
});

router.get("/settings", async (req, res) => {
  const email = normalizeEmail(req.query.email || "");
  if (!email) {
    return res.status(400).json({ message: "Admin email is required." });
  }

  const result = await query(
    `
      select
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(role, 'COUNSELOR') as role,
        coalesce(gender, 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties,
        coalesce(settings, '{}'::jsonb) as settings,
        is_active,
        created_at,
        updated_at
      from public.admin_accounts
      where email = $1
      limit 1
    `,
    [email],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ message: "Admin account not found." });
  }

  const admin = result.rows[0];
  const settings = normalizeAdminSettings(admin.settings);

  return res.json({
    profile: buildAdminProfilePayload(admin, settings),
    preferences: settings,
  });
});

router.patch("/settings", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const fullName = normalizeCompactSpaces(req.body.fullName || "");
  const gender = normalizeCompactSpaces(req.body.gender || "Prefer not to say");
  const profilePictureUrl = normalizeCompactSpaces(req.body.profilePictureUrl || "");
  const requestedProfilePictureSource = String(req.body.profilePictureSource || "").trim().toUpperCase();
  const uploadedProfilePicture = parseUploadedImagePayload(req.body.uploadedProfilePicture);
  const specialties = normalizeSpecialties(req.body.specialties);
  const preferences = normalizeAdminSettings(req.body.preferences);

  if (!email) {
    return res.status(400).json({ message: "Admin email is required." });
  }
  if (!fullName) {
    return res.status(400).json({ message: "Full name is required." });
  }
  if (!["Male", "Female", "Prefer not to say"].includes(gender)) {
    return res.status(400).json({ message: "Invalid gender value." });
  }

  const existing = await query(
    `
      select
        id,
        email,
        coalesce(role, 'COUNSELOR') as role,
        is_active,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(settings, '{}'::jsonb) as settings
      from public.admin_accounts
      where email = $1
      limit 1
    `,
    [email],
  );

  if (existing.rowCount === 0) {
    return res.status(404).json({ message: "Admin account not found." });
  }

  const currentAdmin = existing.rows[0];
  const currentSettings = normalizeAdminSettings(currentAdmin.settings);
  const nextSettings = {
    ...preferences,
    profilePicture: {
      ...currentSettings.profilePicture,
      ...preferences.profilePicture,
    },
  };
  let nextProfilePictureUrl = currentAdmin.profile_picture_url || "";

  if (uploadedProfilePicture) {
    const uploaded = await uploadAdminProfilePicture({
      adminId: currentAdmin.id,
      uploadedImage: uploadedProfilePicture,
    });

    if (
      currentSettings.profilePicture.source === "UPLOAD" &&
      currentSettings.profilePicture.storagePath &&
      currentSettings.profilePicture.storagePath !== uploaded.storagePath
    ) {
      await removeStoredAdminProfilePicture(currentSettings.profilePicture.storagePath);
    }

    nextProfilePictureUrl = uploaded.publicUrl;
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: "UPLOAD",
      storagePath: uploaded.storagePath,
    };
  } else if (requestedProfilePictureSource === "GOOGLE") {
    if (currentSettings.profilePicture.source === "UPLOAD" && currentSettings.profilePicture.storagePath) {
      await removeStoredAdminProfilePicture(currentSettings.profilePicture.storagePath);
    }
    nextProfilePictureUrl = nextSettings.profilePicture.googlePictureUrl || "";
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: nextProfilePictureUrl ? "GOOGLE" : "NONE",
      storagePath: "",
    };
  } else if (requestedProfilePictureSource === "NONE") {
    if (currentSettings.profilePicture.source === "UPLOAD" && currentSettings.profilePicture.storagePath) {
      await removeStoredAdminProfilePicture(currentSettings.profilePicture.storagePath);
    }
    nextProfilePictureUrl = "";
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: "NONE",
      storagePath: "",
    };
  } else if (requestedProfilePictureSource === "UPLOAD") {
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: "UPLOAD",
    };
  } else if (profilePictureUrl) {
    nextProfilePictureUrl = profilePictureUrl;
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: "UPLOAD",
      storagePath: currentSettings.profilePicture.storagePath,
    };
  } else if (!nextProfilePictureUrl && nextSettings.profilePicture.googlePictureUrl) {
    nextProfilePictureUrl = nextSettings.profilePicture.googlePictureUrl;
    nextSettings.profilePicture = {
      ...nextSettings.profilePicture,
      source: "GOOGLE",
      storagePath: "",
    };
  }

  const updated = await query(
    `
      update public.admin_accounts
      set
        full_name = $2,
        gender = $3,
        profile_picture_url = $4,
        specialties = $5::jsonb,
        settings = $6::jsonb,
        updated_at = now()
      where email = $1
      returning
        id,
        email,
        coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name,
        coalesce(role, 'COUNSELOR') as role,
        coalesce(gender, 'Prefer not to say') as gender,
        coalesce(profile_picture_url, '') as profile_picture_url,
        coalesce(specialties, '[]'::jsonb) as specialties,
        coalesce(settings, '{}'::jsonb) as settings,
        is_active,
        created_at,
        updated_at
    `,
    [
      email,
      fullName,
      gender,
      nextProfilePictureUrl || null,
      JSON.stringify(specialties),
      JSON.stringify(nextSettings),
    ],
  );

  const admin = updated.rows[0];
  await writeAdminActivityLog({
    actionType: "ADMIN_SETTINGS_UPDATED",
    actorEmail: admin.email,
    actorName: admin.full_name,
    actorRole: toCounselorRoleLabel(admin.role),
    entityType: "SETTINGS",
    title: `${admin.full_name} updated system settings`,
    description: "Admin account profile and preference settings were updated.",
    metadata: {
      specialtiesCount: specialties.length,
      notifications: preferences.notifications,
      appearance: preferences.appearance,
      privacy: preferences.privacy,
    },
  });

  return res.json({
    message: "Settings saved successfully.",
    profile: buildAdminProfilePayload(admin, normalizeAdminSettings(admin.settings)),
    preferences: normalizeAdminSettings(admin.settings),
  });
});

router.post("/roles", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const fullName = normalizeCompactSpaces(req.body.fullName || "");
  const gender = normalizeCompactSpaces(req.body.gender || "Prefer not to say");
  const role = String(req.body.role || "COUNSELOR").trim().toUpperCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "A valid email is required." });
  }
  if (!fullName) {
    return res.status(400).json({ message: "Full name is required." });
  }
  if (!["HEAD_COUNSELOR", "COUNSELOR"].includes(role)) {
    return res.status(400).json({ message: "Selected role is not available yet." });
  }
  if (!["Male", "Female", "Prefer not to say"].includes(gender)) {
    return res.status(400).json({ message: "Invalid gender value." });
  }

  const existing = await query("select id from public.admin_accounts where email = $1 limit 1", [email]);
  if (existing.rowCount > 0) {
    return res.status(409).json({ message: "That email is already registered." });
  }

  const temporaryPassword = generateTemporaryPassword();
  const insertResult = await query(
    `
      insert into public.admin_accounts (
        email,
        password_hash,
        full_name,
        role,
        gender,
        is_active
      )
      values ($1, $2, $3, $4, $5, true)
      returning id, email, full_name, role, gender, is_active, created_at
    `,
    [email, hashPassword(temporaryPassword), fullName, role, gender],
  );

  const member = insertResult.rows[0];
  await writeAdminActivityLog({
    actionType: "ROLE_MEMBER_CREATED",
    actorEmail: email,
    actorName: fullName,
    actorRole: toRoleManagementLabel(role),
    entityType: "ROLE_ASSIGNMENT",
    title: `${fullName} added to the counseling team`,
    description: `${fullName} was added as ${toRoleManagementLabel(role)}.`,
    metadata: {
      memberId: member.id,
      role,
    },
  });

  return res.status(201).json({
    message: "Team member created.",
    temporaryPassword,
    member: {
      id: member.id,
      email: member.email,
      fullName: member.full_name,
      role: member.role,
      roleLabel: toRoleManagementLabel(member.role),
      department: member.role === "HEAD_COUNSELOR" ? "Administration" : "Counseling Office",
      assignedStudents: 0,
      status: "Active",
      isActive: true,
      gender: member.gender,
      specialties: [],
      createdAt: member.created_at,
    },
  });
});

router.patch("/roles/:memberId", async (req, res) => {
  const memberId = String(req.params.memberId || "").trim();
  const fullName = normalizeCompactSpaces(req.body.fullName || "");
  const gender = normalizeCompactSpaces(req.body.gender || "Prefer not to say");
  const role = String(req.body.role || "").trim().toUpperCase();
  const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : null;

  if (!memberId) {
    return res.status(400).json({ message: "Member id is required." });
  }
  if (!fullName) {
    return res.status(400).json({ message: "Full name is required." });
  }
  if (!["HEAD_COUNSELOR", "COUNSELOR"].includes(role)) {
    return res.status(400).json({ message: "Selected role is not available yet." });
  }
  if (!["Male", "Female", "Prefer not to say"].includes(gender)) {
    return res.status(400).json({ message: "Invalid gender value." });
  }
  if (isActive === null) {
    return res.status(400).json({ message: "Active status is required." });
  }

  const existing = await query(
    `
      select id, email
      from public.admin_accounts
      where id = $1::uuid
      limit 1
    `,
    [memberId],
  );
  if (existing.rowCount === 0) {
    return res.status(404).json({ message: "Member not found." });
  }

  const updateResult = await query(
    `
      update public.admin_accounts
      set
        full_name = $2,
        role = $3,
        gender = $4,
        is_active = $5,
        updated_at = now()
      where id = $1::uuid
      returning id, email, full_name, role, gender, is_active, created_at
    `,
    [memberId, fullName, role, gender, isActive],
  );

  const member = updateResult.rows[0];
  await writeAdminActivityLog({
    actionType: "ROLE_MEMBER_UPDATED",
    actorEmail: member.email,
    actorName: member.full_name,
    actorRole: toRoleManagementLabel(member.role),
    entityType: "ROLE_ASSIGNMENT",
    title: `${member.full_name} role details updated`,
    description: `${member.full_name} is now ${toRoleManagementLabel(member.role)} and marked ${member.is_active ? "active" : "inactive"}.`,
    metadata: {
      memberId: member.id,
      role: member.role,
      isActive: member.is_active,
    },
  });

  return res.json({
    message: "Member updated.",
    member: {
      id: member.id,
      email: member.email,
      fullName: member.full_name,
      role: member.role,
      roleLabel: toRoleManagementLabel(member.role),
      department: member.role === "HEAD_COUNSELOR" ? "Administration" : "Counseling Office",
      status: member.is_active ? "Active" : "Inactive",
      isActive: Boolean(member.is_active),
      gender: member.gender,
      createdAt: member.created_at,
    },
  });
});

router.delete("/roles/:memberId", async (req, res) => {
  const memberId = String(req.params.memberId || "").trim();
  if (!memberId) {
    return res.status(400).json({ message: "Member id is required." });
  }

  const existing = await query(
    `
      select id, email, coalesce(nullif(full_name, ''), split_part(email, '@', 1)) as full_name, coalesce(role, 'COUNSELOR') as role
      from public.admin_accounts
      where id = $1::uuid
      limit 1
    `,
    [memberId],
  );
  if (existing.rowCount === 0) {
    return res.status(404).json({ message: "Member not found." });
  }

  const member = existing.rows[0];
  await query(
    `
      update public.admin_accounts
      set is_active = false, updated_at = now()
      where id = $1::uuid
    `,
    [memberId],
  );

  await writeAdminActivityLog({
    actionType: "ROLE_MEMBER_DEACTIVATED",
    actorEmail: member.email,
    actorName: member.full_name,
    actorRole: toRoleManagementLabel(member.role),
    entityType: "ROLE_ASSIGNMENT",
    title: `${member.full_name} removed from active team`,
    description: `${member.full_name} was marked inactive from role assignments.`,
    metadata: {
      memberId,
      role: member.role,
    },
  });

  return res.json({ message: "Member removed from active team." });
});

router.get("/appointments/google/auth-url", (req, res) => {
  const client = getOAuthClient(req);
  if (!client) {
    return res.status(400).json({
      message: "Google OAuth is not configured.",
    });
  }

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    prompt: "consent",
  });

  return res.json({ authUrl });
});

router.get("/appointments/google/callback", async (req, res) => {
  const client = getOAuthClient(req);
  if (!client) {
    return res.status(400).send("Google OAuth is not configured.");
  }

  const code = String(req.query.code || "");
  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    return res.status(400).send("Missing refresh token. Reconnect and grant consent.");
  }

  req.session.googleRefreshToken = tokens.refresh_token;
  return res.send("Google Calendar connected. You can close this tab.");
});

router.get("/appointments/events", async (req, res) => {
  const client = getOAuthClient(req);
  if (!client) {
    return res.json({
      events: [],
      message: "Google Calendar is not configured yet.",
    });
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  const calendar = google.calendar({ version: "v3", auth: client });
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  try {
    const { data } = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (data.items || []).map((item) => ({
      id: item.id,
      title: item.summary || "(No title)",
      description: item.description || "",
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      location: item.location || "",
    }));

    return res.json({ events });
  } catch (error) {
    return res.status(400).json({
      message: error?.message || "Unable to load Google Calendar events.",
      events: [],
    });
  }
});

module.exports = {
  adminRouter: router,
  ensureDefaultAdminAccount,
};

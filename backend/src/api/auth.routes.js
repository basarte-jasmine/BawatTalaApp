const express = require("express");
const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const {
  supabaseAdminClient,
  supabaseAuthClient,
} = require("../config/supabase");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");
const { createStudentToken } = require("../services/auth-token.service");
const { sendAuthCodeEmail, sendPasswordResetCodeEmail } = require("../services/auth-email.service");
const {
  BARANGAY_OPTIONS,
  GENDER_OPTIONS,
  PROGRAM_OPTIONS,
} = require("../constants/student-profile");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^(?=.{2,}$)[\p{L}][\p{L}\p{M} .'-]*$/u;
const ADDRESS_PATTERN = /^(?=.{2,80}$)[\p{L}][\p{L}\p{M} .'-]*$/u;
const STREET_PATTERN = /^(?=.{2,120}$)[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'#-]*$/u;
const LOGIN_ATTEMPTS_LIMIT = 3;
const LOGIN_LOCK_DURATION_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_VALIDITY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;
const STUDENT_PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 9;
const REFERRAL_JOIN_REWARD_TALA = 100;
const REFERRAL_INVITE_REWARD_TALA = 150;
const loginAttempts = new Map();
const registrationOtpSessions = new Map();
const resetPasswordSessions = new Map();
const journalLockResetSessions = new Map();
const emailChangeSessions = new Map();
const DEFAULT_STUDENT_PREFERENCES = {
  journalLockAutoLock: true,
  journalLockEnabled: false,
  notificationPreviewsEnabled: true,
  privateJournalModeEnabled: true,
};

function normalizeCompactSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUpperText(value) {
  return normalizeCompactSpaces(value).toUpperCase();
}

function normalizeEmail(value) {
  return normalizeCompactSpaces(value).toLowerCase();
}

function normalizeStudentGender(value) {
  const normalized = normalizeCompactSpaces(value).toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "prefer not to say") return "Prefer not to say";
  return "";
}

function toTitleCase(value) {
  return normalizeCompactSpaces(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const [first = "", ...rest] = Array.from(part);
      return first.toUpperCase() + rest.join("");
    })
    .join(" ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function resolveRequestStudentNumber(req) {
  try {
    return normalizeStudentNumber(req.student?.studentNumber || resolveStudentNumber(req) || "");
  } catch {
    return normalizeStudentNumber(req.student?.studentNumber || "");
  }
}


function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(value, stored) {
  if (!stored || typeof stored !== "string") {
    return false;
  }

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

function getLoginAttemptState(key) {
  const state = loginAttempts.get(key);
  if (!state) {
    return { count: 0, lockUntil: 0 };
  }
  return state;
}

function registerFailedAttempt(key) {
  const now = Date.now();
  const state = getLoginAttemptState(key);
  const updatedCount = state.count + 1;

  if (updatedCount >= LOGIN_ATTEMPTS_LIMIT) {
    loginAttempts.set(key, {
      count: 0,
      lockUntil: now + LOGIN_LOCK_DURATION_MS,
    });
    return true;
  }

  loginAttempts.set(key, { count: updatedCount, lockUntil: 0 });
  return false;
}

function getResetSession(studentNumber) {
  return resetPasswordSessions.get(studentNumber) || null;
}

function setResetSession(studentNumber, session) {
  resetPasswordSessions.set(studentNumber, session);
}

function clearResetSession(studentNumber) {
  resetPasswordSessions.delete(studentNumber);
}

function getJournalLockResetSession(studentNumber) {
  return journalLockResetSessions.get(studentNumber) || null;
}

function setJournalLockResetSession(studentNumber, session) {
  journalLockResetSessions.set(studentNumber, session);
}

function clearJournalLockResetSession(studentNumber) {
  journalLockResetSessions.delete(studentNumber);
}

function getEmailChangeSession(studentNumber) {
  return emailChangeSessions.get(studentNumber) || null;
}

function setEmailChangeSession(studentNumber, session) {
  emailChangeSessions.set(studentNumber, session);
}

function clearEmailChangeSession(studentNumber) {
  emailChangeSessions.delete(studentNumber);
}

async function loadCurrentStudentEmail(studentNumber) {
  const { data, error } = await supabaseAdminClient
    .from("student_profiles")
    .select("email")
    .eq("student_number", studentNumber)
    .maybeSingle();
  if (error) {
    const wrapped = new Error(error.message || "Unable to load student email.");
    wrapped.statusCode = 400;
    throw wrapped;
  }
  const email = normalizeEmail(data?.email || "");
  if (!email) {
    const wrapped = new Error("Student email not found.");
    wrapped.statusCode = 404;
    throw wrapped;
  }
  return email;
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return normalized;
  return `${normalized.charAt(0)}***${normalized.slice(at)}`;
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
    year: Number(year),
    month: Number(month),
    day: Number(day),
    isoDate: `${year}-${month}-${day}`,
  };
}

function formatActivityTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toISOString();
}

function formatEntryDateLabel(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return getManilaDateParts(value).isoDate;
  }
  const rawValue = String(value).trim();
  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : rawValue;
}

function resolveActivityNotificationRoute(kind, metadata = {}) {
  const storedRoute = String(metadata?.route || "").trim();
  const kindUpper = String(kind || "").toUpperCase();

  if (kindUpper.startsWith("FUTURE_SELF")) {
    return storedRoute || "/home";
  }
  if (/DISAPPROV|DECLINE|DENIED/.test(kindUpper)) {
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

function isEmailChangeSessionVerified(session, newEmail) {
  if (!session) return false;
  if (normalizeEmail(session.newEmail || "") !== normalizeEmail(newEmail || "")) {
    return false;
  }
  const verifiedAt = Number(session.verifiedAt || session.currentVerifiedAt || 0);
  if (!verifiedAt) return false;
  return Date.now() <= verifiedAt + RESET_SESSION_MS;
}

const STUDENT_PROFILE_SELECT =
  "student_number, full_name, email, program, gender, region, province, city, barangay, street, birthdate, profile_picture_url, profile_picture_path";

function normalizeBirthdate(value) {
  const raw = normalizeCompactSpaces(value);
  const matchIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return matchIso[1] + "-" + matchIso[2] + "-" + matchIso[3];
  }
  const matchUs = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchUs) {
    const month = matchUs[1].padStart(2, "0");
    const day = matchUs[2].padStart(2, "0");
    const year = matchUs[3];
    return year + "-" + month + "-" + day;
  }
  return "";
}

function isValidProfileName(value) {
  return NAME_PATTERN.test(String(value || "").trim());
}

function findListedOption(options, value) {
  const needle = normalizeCompactSpaces(value).toUpperCase();
  if (!needle) return "";
  return options.find((option) => option.toUpperCase() === needle) || "";
}

function validateAddressField(label, value) {
  if (!value) {
    return `${label} is required.`;
  }
  if (value.length < 2 || value.length > 80) {
    return `${label} must be 2 to 80 characters.`;
  }
  if (/\d/.test(value) || !ADDRESS_PATTERN.test(value)) {
    return `${label} can only include letters, spaces, hyphens, and periods.`;
  }
  return "";
}

function parseIsoCalendarDate(value) {
  const iso = normalizeBirthdate(value);
  if (!iso) return "";
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return "";
  }
  return iso;
}

function mapStudentProfile(data) {
  if (!data) return null;
  return {
    barangay: data.barangay || "",
    birthdate: data.birthdate || "",
    city: data.city || "",
    email: normalizeEmail(data.email || ""),
    fullName: toTitleCase(data.full_name || ""),
    gender: data.gender || "",
    program: data.program || "",
    profilePictureUrl: data.profile_picture_url || "",
    province: data.province || "",
    region: data.region || "",
    street: data.street || "",
    studentNumber: data.student_number,
  };
}

async function loadStudentProfileByNumber(studentNumber) {
  return supabaseAdminClient
    .from("student_profiles")
    .select(STUDENT_PROFILE_SELECT)
    .eq("student_number", studentNumber)
    .maybeSingle();
}

async function sendVerificationCodeEmail(email, context, copy) {
  const { data, error } = await supabaseAdminClient.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) {
    return { ok: false, message: error.message || "Failed to generate verification code." };
  }
  const token = data?.properties?.email_otp;
  if (!token) {
    return { ok: false, message: "Failed to generate verification code." };
  }
  const emailResult = await sendAuthCodeEmail({
    to: email,
    code: token,
    expiresInSeconds: Math.ceil(OTP_VALIDITY_MS / 1000),
    context,
    subject: copy.subject,
    heading: copy.heading,
    intro: copy.intro,
    ignoreText: copy.ignoreText,
  });
  if (!emailResult.ok) {
    return { ok: false, message: "Failed to send verification code." };
  }
  return { ok: true };
}

async function clearStudentProfilePicture(studentNumber) {
  const profileResult = await query(
    `
      select coalesce(profile_picture_path, '') as profile_picture_path
      from public.student_profiles
      where student_number = $1
      limit 1
    `,
    [studentNumber],
  );
  if (profileResult.rowCount === 0) {
    const error = new Error("Student profile not found.");
    error.statusCode = 404;
    throw error;
  }

  await query(
    `
      update public.student_profiles
      set profile_picture_url = null,
          profile_picture_path = null
      where student_number = $1
    `,
    [studentNumber],
  );

  const previousPath = profileResult.rows[0].profile_picture_path || "";
  if (previousPath) {
    const { error: removeError } = await supabaseAdminClient.storage
      .from(getStudentProfilePictureBucket())
      .remove([previousPath]);
    if (removeError) {
      console.warn("Unable to remove student profile picture:", removeError.message || removeError);
    }
  }
}

function getStudentProfilePictureBucket() {
  return normalizeCompactSpaces(
    process.env.SUPABASE_STUDENT_AVATAR_BUCKET || "student-profile-pictures",
  );
}

function sanitizeProfilePictureFileName(value) {
  const normalized = normalizeCompactSpaces(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "profile-image";
}

function detectProfilePictureMimeType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  return "";
}

function parseStudentProfilePicturePayload(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error("Please choose a profile picture.");
  }

  const dataUrl = String(rawValue.dataUrl || "").trim();
  const fileName = sanitizeProfilePictureFileName(rawValue.fileName || "profile-image");
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) {
    throw new Error("Invalid profile picture data.");
  }

  const declaredMimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!["image/jpeg", "image/png"].includes(declaredMimeType)) {
    throw new Error("Only PNG or JPEG profile pictures are allowed.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new Error("The selected profile picture is empty.");
  }
  if (buffer.length > STUDENT_PROFILE_PICTURE_LIMIT_BYTES) {
    throw new Error("Profile picture must be 5 MB or smaller.");
  }

  const detectedMimeType = detectProfilePictureMimeType(buffer);
  if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
    throw new Error("The selected file is not a valid PNG or JPEG image.");
  }

  return {
    buffer,
    contentType: detectedMimeType,
    extension: detectedMimeType === "image/png" ? "png" : "jpg",
    fileName,
  };
}

async function ensureStudentProfilePictureBucket() {
  const bucketName = getStudentProfilePictureBucket();
  const { data: buckets, error: listError } = await supabaseAdminClient.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message || "Unable to verify profile picture storage.");
  }

  const exists = Array.isArray(buckets) && buckets.some((bucket) => bucket.name === bucketName);
  if (!exists) {
    const { error: createError } = await supabaseAdminClient.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: `${STUDENT_PROFILE_PICTURE_LIMIT_BYTES}`,
      allowedMimeTypes: ["image/jpeg", "image/png"],
    });

    if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
      throw new Error(createError.message || "Unable to create profile picture storage.");
    }
  }

  return bucketName;
}

async function uploadStudentProfilePicture({ studentNumber, uploadedImage }) {
  const bucketName = await ensureStudentProfilePictureBucket();
  const safeStudentNumber = studentNumber.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filePath = `students/${safeStudentNumber}/${Date.now()}-${uploadedImage.fileName}.${uploadedImage.extension}`;
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
  const publicUrl = data?.publicUrl || "";
  if (!publicUrl) {
    await supabaseAdminClient.storage.from(bucketName).remove([filePath]);
    throw new Error("Unable to create the profile picture URL.");
  }

  return { bucketName, filePath, publicUrl };
}

function getRegistrationOtpSession(email) {
  return registrationOtpSessions.get(email) || null;
}

function setRegistrationOtpSession(email, session) {
  registrationOtpSessions.set(email, session);
}

function clearRegistrationOtpSession(email) {
  registrationOtpSessions.delete(email);
}

async function sendRecoveryCode(email, context) {
  const { data, error } = await supabaseAdminClient.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    return { ok: false, message: error.message || "Failed to generate reset code." };
  }

  const token = data?.properties?.email_otp;
  if (!token) {
    return { ok: false, message: "Failed to generate reset code." };
  }

  const emailResult = await sendPasswordResetCodeEmail({
    to: email,
    code: token,
    expiresInSeconds: Math.ceil(OTP_VALIDITY_MS / 1000),
    context,
  });

  if (!emailResult.ok) {
    return { ok: false, message: "Failed to send reset code." };
  }

  return { ok: true };
}

async function deleteStaleAuthUsersByEmail(email) {
  let page = 1;
  let removedAny = false;

  while (true) {
    const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const matchingUsers = users.filter(
      (user) => normalizeEmail(user.email || "") === email,
    );

    for (const user of matchingUsers) {
      const { error: deleteError } =
        await supabaseAdminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        throw deleteError;
      }
      removedAny = true;
    }

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  return removedAny;
}

function isBoolean(value) {
  return typeof value === "boolean";
}

function normalizePin(value) {
  return String(value || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 4);
}

function normalizeReferralCode(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, REFERRAL_CODE_LENGTH);
}

function generateReferralCode() {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  return Array.from(bytes)
    .map((byte) => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length])
    .join("");
}

function normalizeStudentPreferences(row) {
  const settings =
    row?.settings &&
    typeof row.settings === "object" &&
    !Array.isArray(row.settings)
      ? row.settings
      : {};
  const hasJournalLockPin = Boolean(row?.journal_lock_pin_hash);
  const journalLockEnabled = Boolean(
    row?.journal_lock_enabled && hasJournalLockPin,
  );

  return {
    hasJournalLockPin,
    journalLockAutoLock: isBoolean(row?.journal_lock_auto_lock)
      ? row.journal_lock_auto_lock
      : DEFAULT_STUDENT_PREFERENCES.journalLockAutoLock,
    journalLockEnabled,
    notificationPreviewsEnabled: isBoolean(settings.notificationPreviewsEnabled)
      ? settings.notificationPreviewsEnabled
      : DEFAULT_STUDENT_PREFERENCES.notificationPreviewsEnabled,
    privateJournalModeEnabled: isBoolean(settings.privateJournalModeEnabled)
      ? settings.privateJournalModeEnabled
      : DEFAULT_STUDENT_PREFERENCES.privateJournalModeEnabled,
  };
}

function getPreviousJournalLockPinHash(settings) {
  return typeof settings?.previousJournalLockPinHash === "string"
    ? settings.previousJournalLockPinHash
    : "";
}

function getPreviousAccountPasswordHash(settings) {
  return typeof settings?.previousAccountPasswordHash === "string"
    ? settings.previousAccountPasswordHash
    : "";
}

async function loadStudentPreferenceRecord(studentNumber) {
  const result = await query(
    `
      select
        settings,
        journal_lock_enabled,
        journal_lock_pin_hash,
        journal_lock_auto_lock
      from public.student_app_preferences
      where student_number = $1
    `,
    [studentNumber],
  );

  return result.rows[0] || null;
}

async function saveStudentPreferenceRecord({
  journalLockAutoLock,
  journalLockEnabled,
  journalLockPinHash,
  settings,
  studentNumber,
}) {
  const result = await query(
    `
      insert into public.student_app_preferences (
        student_number,
        settings,
        journal_lock_enabled,
        journal_lock_pin_hash,
        journal_lock_auto_lock
      )
      values ($1, $2::jsonb, $3, $4, $5)
      on conflict (student_number)
      do update set
        settings = excluded.settings,
        journal_lock_enabled = excluded.journal_lock_enabled,
        journal_lock_pin_hash = excluded.journal_lock_pin_hash,
        journal_lock_auto_lock = excluded.journal_lock_auto_lock,
        updated_at = now()
      returning
        settings,
        journal_lock_enabled,
        journal_lock_pin_hash,
        journal_lock_auto_lock
    `,
    [
      studentNumber,
      JSON.stringify(settings),
      journalLockEnabled,
      journalLockPinHash,
      journalLockAutoLock,
    ],
  );

  return result.rows[0] || null;
}

function normalizeReferralRecord(row) {
  return {
    hasRedeemed: Boolean(row?.referred_by_student_number),
    referralCode: row?.referral_code || "",
    redeemRewardTala: REFERRAL_JOIN_REWARD_TALA,
    redeemedAt: row?.redeemed_at || null,
    referredByCode: row?.referred_by_code || null,
    shareRewardTala: REFERRAL_INVITE_REWARD_TALA,
  };
}

async function ensureStudentReferralRecord(studentNumber) {
  const existing = await query(
    `
      select referral_code, referred_by_code, referred_by_student_number, redeemed_at
      from public.student_referrals
      where student_number = $1
    `,
    [studentNumber],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const inserted = await query(
        `
          insert into public.student_referrals (
            student_number,
            referral_code
          )
          values ($1, $2)
          returning referral_code, referred_by_code, referred_by_student_number, redeemed_at
        `,
        [studentNumber, generateReferralCode()],
      );

      return inserted.rows[0];
    } catch (error) {
      if (error?.code === "23505") {
        const current = await query(
          `
            select referral_code, referred_by_code, referred_by_student_number, redeemed_at
            from public.student_referrals
            where student_number = $1
          `,
          [studentNumber],
        );

        if (current.rows[0]) {
          return current.rows[0];
        }

        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to create a unique referral code. Please try again.");
}

async function getReferralRecordByCode(referralCode) {
  const result = await query(
    `
      select student_number, referral_code
      from public.student_referrals
      where referral_code = $1
    `,
    [referralCode],
  );

  return result.rows[0] || null;
}

router.post("/login", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const password = String(req.body.password || "").trim();

  if (!studentNumber && !password) {
    return res
      .status(400)
      .json({ message: "Please enter your Student ID and password." });
  }

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID or password." });
  }

  const loginKey = `${studentNumber}:${req.ip || "unknown"}`;
  const attemptState = getLoginAttemptState(loginKey);
  const now = Date.now();
  if (attemptState.lockUntil && now < attemptState.lockUntil) {
    return res.status(429).json({
      message: "Too many failed login attempts. Please try again later.",
    });
  }

  const { data, error } = await supabaseAdminClient
    .from("student_profiles")
    .select(
      "student_number, full_name, email, password_hash, birthdate, is_email_verified, is_id_verified, profile_picture_url",
    )
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const hasValidPassword = Boolean(data) && verifyPassword(password, data.password_hash);

  if (!hasValidPassword) {
    const isLocked = registerFailedAttempt(loginKey);
    if (isLocked) {
      return res.status(429).json({
        message: "Too many failed login attempts. Please try again later.",
      });
    }
    return res.status(400).json({
      message: "Invalid Student ID or password. Please try again.",
    });
  }

  if (data.is_email_verified !== true || data.is_id_verified !== true) {
    return res.status(403).json({
      message: "Please verify your account before logging in.",
    });
  }

  loginAttempts.delete(loginKey);
  const fullName = toTitleCase(data.full_name || "");
  const firstName = fullName.split(" ").filter(Boolean)[0] || "User";

  req.session.student = {
    studentNumber: data.student_number,
    email: normalizeEmail(data.email || ""),
    fullName,
  };
  const token = createStudentToken(data.student_number);

  return res.json({
    message: "Login successful.",
    token,
    user: {
      studentNumber: data.student_number,
      fullName,
      firstName,
      email: normalizeEmail(data.email || ""),
      profilePictureUrl: data.profile_picture_url || "",
      token,
    },
  });
});

router.get("/profile", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const { data, error } = await loadStudentProfileByNumber(studentNumber);

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  if (!data) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  return res.json({
    profile: mapStudentProfile(data),
  });
});

router.patch("/profile", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }

  const { data: current, error: loadError } = await loadStudentProfileByNumber(studentNumber);
  if (loadError) {
    return res.status(400).json({ message: loadError.message });
  }
  if (!current) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  const requestedEmail = normalizeEmail(req.body.email || "");
  const currentEmail = normalizeEmail(current.email || "");
  const nextEmail = "";
  if (requestedEmail && requestedEmail !== currentEmail) {
    return res.status(400).json({
      message: "Use the email-change confirm flow to set a new email.",
    });
  }

  if (req.body.studentNumber != null || req.body.student_number != null) {
    const requestedStudentNumber = normalizeStudentNumber(
      req.body.studentNumber || req.body.student_number || "",
    );
    if (requestedStudentNumber && requestedStudentNumber !== studentNumber) {
      return res.status(400).json({ message: "Student number cannot be changed." });
    }
  }

  const updates = {};
  if (nextEmail) {
    updates.email = nextEmail;
  }
  if (req.body.fullName != null) {
    const fullName = normalizeUpperText(req.body.fullName || "");
    if (!fullName) {
      return res.status(400).json({ message: "Full name is required." });
    }
    if (fullName.length < 2 || fullName.length > 80) {
      return res.status(400).json({ message: "Full name must be 2 to 80 characters." });
    }
    if (/\d/.test(fullName) || !isValidProfileName(fullName)) {
      return res.status(400).json({
        message: "Full name can only include letters, spaces, hyphens, and apostrophes.",
      });
    }
    updates.full_name = fullName;
  }
  if (req.body.program != null) {
    const program = normalizeUpperText(req.body.program || "");
    if (!program) {
      return res.status(400).json({ message: "Program is required." });
    }
    const matchedProgram = findListedOption(PROGRAM_OPTIONS, program);
    if (!matchedProgram) {
      return res.status(400).json({ message: "Choose a program from the list." });
    }
    updates.program = normalizeUpperText(matchedProgram);
  }
  if (req.body.gender != null) {
    const rawGender = normalizeCompactSpaces(req.body.gender || "");
    if (!rawGender) {
      return res.status(400).json({ message: "Gender is required." });
    }
    const gender = normalizeStudentGender(rawGender);
    if (!gender || !findListedOption(GENDER_OPTIONS, gender)) {
      return res.status(400).json({ message: "Choose a gender from the list." });
    }
    updates.gender = gender;
  }
  if (req.body.region != null) {
    const region = normalizeUpperText(req.body.region || "");
    const regionError = validateAddressField("Region", region);
    if (regionError) {
      return res.status(400).json({ message: regionError });
    }
    updates.region = region;
  }
  if (req.body.province != null) {
    const province = normalizeUpperText(req.body.province || "");
    const provinceError = validateAddressField("Province", province);
    if (provinceError) {
      return res.status(400).json({ message: provinceError });
    }
    updates.province = province;
  }
  if (req.body.city != null) {
    const city = normalizeUpperText(req.body.city || "");
    const cityError = validateAddressField("City", city);
    if (cityError) {
      return res.status(400).json({ message: cityError });
    }
    updates.city = city;
  }
  if (req.body.barangay != null) {
    const barangay = normalizeUpperText(req.body.barangay || "");
    if (!barangay) {
      return res.status(400).json({ message: "Barangay is required." });
    }
    const matchedBarangay = findListedOption(BARANGAY_OPTIONS, barangay);
    if (!matchedBarangay) {
      return res.status(400).json({ message: "Choose a barangay from the list." });
    }
    updates.barangay = normalizeUpperText(matchedBarangay);
  }
  if (req.body.street != null) {
    const street = normalizeUpperText(req.body.street || "");
    if (!street) {
      return res.status(400).json({ message: "Street is required." });
    }
    if (street.length < 2 || street.length > 120) {
      return res.status(400).json({ message: "Street must be 2 to 120 characters." });
    }
    if (!STREET_PATTERN.test(street)) {
      return res.status(400).json({
        message: "Street can include letters, numbers, spaces, hyphens, and periods.",
      });
    }
    updates.street = street;
  }
  if (req.body.birthdate != null) {
    const rawBirthdate = normalizeCompactSpaces(req.body.birthdate || "");
    if (!rawBirthdate) {
      return res.status(400).json({ message: "Birthdate is required." });
    }
    const birthdate = parseIsoCalendarDate(rawBirthdate);
    if (!birthdate) {
      return res.status(400).json({ message: "Enter birthdate as YYYY-MM-DD." });
    }
    if (birthdate > getManilaDateParts().isoDate) {
      return res.status(400).json({ message: "Birthdate cannot be in the future." });
    }
    updates.birthdate = birthdate;
  }

  if (!Object.keys(updates).length) {
    return res.json({
      message: "No personal details changed.",
      profile: mapStudentProfile(current),
    });
  }

  const { data, error } = await supabaseAdminClient
    .from("student_profiles")
    .update(updates)
    .eq("student_number", studentNumber)
    .select(STUDENT_PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const profile = mapStudentProfile(data || { ...current, ...updates, student_number: studentNumber });
  if (req.session?.student) {
    req.session.student.fullName = profile.fullName;
    req.session.student.email = profile.email;
  }

  if (nextEmail) {
    clearEmailChangeSession(studentNumber);
  }

  return res.json({
    message: "Profile updated.",
    profile,
  });
});

router.post("/profile/email-change/send-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const newEmail = normalizeEmail(req.body.newEmail || req.body.email || "");
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }
  if (!newEmail || !EMAIL_PATTERN.test(newEmail)) {
    return res.status(400).json({ message: "Enter a valid new email address." });
  }

  const currentSession = getEmailChangeSession(studentNumber);
  if (currentSession && Date.now() < currentSession.resendAvailableAt) {
    const remaining = Math.ceil((currentSession.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const { data: profile, error: profileError } = await loadStudentProfileByNumber(studentNumber);
  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }
  if (!profile) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  const currentEmail = normalizeEmail(profile.email || "");
  if (!currentEmail || !EMAIL_PATTERN.test(currentEmail)) {
    return res.status(400).json({ message: "This account does not have a valid email on file." });
  }
  if (newEmail === currentEmail) {
    return res.status(400).json({ message: "The new email is the same as your current email." });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("id")
    .eq("email", newEmail)
    .maybeSingle();
  if (existingProfileError) {
    return res.status(500).json({
      message: existingProfileError.message || "Unable to validate email status.",
    });
  }
  if (existingProfile) {
    return res.status(409).json({ message: "This email is already registered." });
  }

  const sendResult = await sendVerificationCodeEmail(
    currentEmail,
    `student email change current [${studentNumber}]`,
    {
      subject: "Confirm your email change",
      heading: "Confirm Email Change",
      intro: "We received a request to change the email on your Bawat Tala account. Use the verification code below to confirm this request:",
      ignoreText: "If you did not request an email change, you can safely ignore this email.",
    },
  );
  if (!sendResult.ok) {
    return res.status(400).json({ message: sendResult.message || "Failed to send verification code." });
  }

  const now = Date.now();
  setEmailChangeSession(studentNumber, {
    studentNumber,
    currentEmail,
    newEmail,
    currentVerifiedAt: 0,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: "Verification code sent to your current email.",
    stage: "current-email",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/profile/email-change/resend-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const session = getEmailChangeSession(studentNumber);
  if (!session) {
    return res.status(400).json({ message: "Please request an email change first." });
  }
  if (Date.now() < session.resendAvailableAt) {
    const remaining = Math.ceil((session.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  if (session.currentVerifiedAt) {
    const { error } = await supabaseAuthClient.auth.signInWithOtp({
      email: session.newEmail,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return res.status(400).json({ message: error.message || "Failed to send verification code." });
    }
  } else {
    const sendResult = await sendVerificationCodeEmail(
      session.currentEmail,
      `student email change current resend [${studentNumber}]`,
      {
        subject: "Confirm your email change",
        heading: "Confirm Email Change",
        intro: "We received a request to change the email on your Bawat Tala account. Use the verification code below to confirm this request:",
        ignoreText: "If you did not request an email change, you can safely ignore this email.",
      },
    );
    if (!sendResult.ok) {
      return res.status(400).json({ message: sendResult.message || "Failed to send verification code." });
    }
  }

  const now = Date.now();
  setEmailChangeSession(studentNumber, {
    ...session,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: session.currentVerifiedAt
      ? "Verification code sent to your new email."
      : "Verification code sent to your current email.",
    stage: session.currentVerifiedAt ? "new-email" : "current-email",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/profile/email-change/verify-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const token = String(req.body.token || req.body.code || "").trim();
  if (!studentNumber || !token) {
    return res.status(400).json({ message: "Verification code is required." });
  }

  const session = getEmailChangeSession(studentNumber);
  if (!session) {
    return res.status(400).json({ message: "Please request an email change first." });
  }
  if (session.currentVerifiedAt) {
    return res.status(400).json({
      message: "Current email is already verified. Enter the code sent to your new email.",
      stage: "new-email",
    });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearEmailChangeSession(studentNumber);
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.currentEmail,
    token,
    type: "recovery",
  });
  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
    });
  }

  const { error: newEmailError } = await supabaseAuthClient.auth.signInWithOtp({
    email: session.newEmail,
    options: { shouldCreateUser: true },
  });
  if (newEmailError) {
    return res.status(400).json({
      message: newEmailError.message || "Unable to send a verification code to the new email.",
    });
  }

  const now = Date.now();
  setEmailChangeSession(studentNumber, {
    ...session,
    currentVerifiedAt: now,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: "Current email verified. Enter the code sent to your new email.",
    stage: "new-email",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/profile/email-change/confirm", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const token = String(req.body.token || req.body.code || "").trim();
  if (!studentNumber || !token) {
    return res.status(400).json({ message: "Verification code is required." });
  }

  const session = getEmailChangeSession(studentNumber);
  if (!session || !session.currentVerifiedAt) {
    return res.status(400).json({
      message: "Please verify your current email first.",
      stage: "current-email",
    });
  }
  if (Date.now() > session.otpExpiresAt) {
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
      stage: "new-email",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.newEmail,
    token,
    type: "email",
  });
  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
      stage: "new-email",
    });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("id, student_number")
    .eq("email", session.newEmail)
    .maybeSingle();
  if (existingProfileError) {
    return res.status(500).json({
      message: existingProfileError.message || "Unable to validate email status.",
    });
  }
  if (existingProfile && existingProfile.student_number !== studentNumber) {
    return res.status(409).json({ message: "This email is already registered." });
  }

  const { data, error: updateError } = await supabaseAdminClient
    .from("student_profiles")
    .update({ email: session.newEmail, is_email_verified: true })
    .eq("student_number", studentNumber)
    .select(STUDENT_PROFILE_SELECT)
    .maybeSingle();
  if (updateError) {
    return res.status(400).json({ message: updateError.message });
  }

  try {
    await deleteStaleAuthUsersByEmail(session.currentEmail);
  } catch (cleanupError) {
    console.warn(
      "Unable to remove previous auth email after student email change:",
      cleanupError?.message || cleanupError,
    );
  }

  if (req.session?.student) {
    req.session.student.email = session.newEmail;
  }
  clearEmailChangeSession(studentNumber);

  return res.json({
    message: "Email updated.",
    profile: mapStudentProfile(data),
  });
});



router.patch("/profile-picture", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }

  const rawPicture = req.body.uploadedProfilePicture;
  if (
    rawPicture == null ||
    rawPicture === "" ||
    (typeof rawPicture === "object" && !String(rawPicture.dataUrl || "").trim())
  ) {
    try {
      await clearStudentProfilePicture(studentNumber);
      return res.json({
        message: "Profile picture removed.",
        profilePictureUrl: "",
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        message: error.message || "Unable to remove profile picture.",
      });
    }
  }

  let uploadedImage;
  try {
    uploadedImage = parseStudentProfilePicturePayload(rawPicture);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Invalid profile picture." });
  }

  try {
    const profileResult = await query(
      `
        select coalesce(profile_picture_path, '') as profile_picture_path
        from public.student_profiles
        where student_number = $1
        limit 1
      `,
      [studentNumber],
    );
    if (profileResult.rowCount === 0) {
      return res.status(404).json({ message: "Student profile not found." });
    }

    const previousPath = profileResult.rows[0].profile_picture_path || "";
    const uploaded = await uploadStudentProfilePicture({ studentNumber, uploadedImage });

    try {
      await query(
        `
          update public.student_profiles
          set profile_picture_url = $2,
              profile_picture_path = $3
          where student_number = $1
        `,
        [studentNumber, uploaded.publicUrl, uploaded.filePath],
      );
    } catch (error) {
      await supabaseAdminClient.storage.from(uploaded.bucketName).remove([uploaded.filePath]);
      throw error;
    }

    if (previousPath && previousPath !== uploaded.filePath) {
      const { error: removeError } = await supabaseAdminClient.storage
        .from(uploaded.bucketName)
        .remove([previousPath]);
      if (removeError) {
        console.warn("Unable to remove previous student profile picture:", removeError.message || removeError);
      }
    }

    return res.json({
      message: "Profile picture updated.",
      profilePictureUrl: uploaded.publicUrl,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Unable to update profile picture.",
    });
  }
});

router.delete("/profile-picture", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }

  try {
    await clearStudentProfilePicture(studentNumber);
    return res.json({
      message: "Profile picture removed.",
      profilePictureUrl: "",
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to remove profile picture.",
    });
  }
});

router.get("/preferences", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  try {
    const record = await loadStudentPreferenceRecord(studentNumber);
    return res.json({
      preferences: normalizeStudentPreferences(record),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to load student preferences.",
    });
  }
});

router.patch("/preferences", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  try {
    const currentRecord = await loadStudentPreferenceRecord(studentNumber);
    const currentPreferences = normalizeStudentPreferences(currentRecord);
    const currentSettings =
      currentRecord?.settings && typeof currentRecord.settings === "object"
        ? currentRecord.settings
        : {};
    const nextSettings = { ...currentSettings };

    if (isBoolean(req.body.notificationPreviewsEnabled)) {
      nextSettings.notificationPreviewsEnabled =
        req.body.notificationPreviewsEnabled;
    }
    if (isBoolean(req.body.privateJournalModeEnabled)) {
      nextSettings.privateJournalModeEnabled =
        req.body.privateJournalModeEnabled;
    }

    let nextJournalLockEnabled = currentPreferences.journalLockEnabled;
    let nextJournalLockPinHash = currentRecord?.journal_lock_pin_hash || null;
    let nextJournalLockAutoLock = currentPreferences.journalLockAutoLock;

    if (isBoolean(req.body.journalLockAutoLock)) {
      nextJournalLockAutoLock = req.body.journalLockAutoLock;
    }

   const requestedDisable =
     isBoolean(req.body.journalLockEnabled) &&
     req.body.journalLockEnabled === false &&
     currentPreferences.journalLockEnabled;

   const requestedEnable =
     isBoolean(req.body.journalLockEnabled) &&
     req.body.journalLockEnabled === true &&
     !currentPreferences.journalLockEnabled;

   if (requestedDisable) {
     const currentPin = normalizePin(
       req.body.journalLockPin ||
         req.body.currentJournalLockPin ||
         req.body.pin,
     );
     const pinHash = currentRecord?.journal_lock_pin_hash || "";
     if (currentPin.length !== 4) {
       return res.status(400).json({
         message: "Enter your current PIN to turn off Journal Lock.",
       });
     }
     if (!pinHash || !verifyPassword(currentPin, pinHash)) {
       return res.status(403).json({
         message: "That PIN doesn't match. Try again.",
       });
     }
     nextJournalLockEnabled = false;
   } else if (requestedEnable) {
     const currentPin = normalizePin(
       req.body.currentJournalLockPin ||
         req.body.journalLockPin ||
         req.body.pin,
     );
     if (nextJournalLockPinHash) {
       if (req.body.previousJournalLockPin) {
         const previousPin = normalizePin(req.body.previousJournalLockPin);
         const nextPin = normalizePin(req.body.journalLockPin);
         if (previousPin.length !== 4 || !verifyPassword(previousPin, nextJournalLockPinHash)) {
           return res.status(403).json({ message: "Previous PIN does not match." });
         }
         if (nextPin.length !== 4) {
           return res.status(400).json({ message: "Use exactly 4 digits for the PIN." });
         }
         if (verifyPassword(nextPin, nextJournalLockPinHash)) {
           return res.status(400).json({ message: "Choose a new PIN that is different from your current PIN." });
         }
         nextJournalLockPinHash = hashPassword(nextPin);
         nextJournalLockEnabled = true;
       } else {
         if (currentPin.length !== 4) {
           return res.status(400).json({
             message: "Enter your current PIN to turn on Journal Lock.",
           });
         }
         if (!verifyPassword(currentPin, nextJournalLockPinHash)) {
           return res.status(403).json({
             message: "That PIN doesn't match. Try again.",
           });
         }
         nextJournalLockEnabled = true;
       }
     } else {
       const nextPin = normalizePin(req.body.journalLockPin || req.body.pin);
       if (nextPin.length !== 4) {
         return res.status(400).json({ message: "Create a 4-digit PIN first." });
       }
       nextJournalLockPinHash = hashPassword(nextPin);
       nextJournalLockEnabled = true;
     }
   } else if (isBoolean(req.body.journalLockEnabled)) {
     nextJournalLockEnabled = req.body.journalLockEnabled;
   }

   const nextPin = normalizePin(req.body.journalLockPin);
   if (!requestedDisable && !requestedEnable && req.body.journalLockPin != null) {
     if (nextPin.length !== 4) {
       return res
         .status(400)
          .json({ message: "Use exactly 4 digits for the PIN." });
      }

      const previousJournalLockPinHash =
        getPreviousJournalLockPinHash(currentSettings);

      if (currentPreferences.journalLockEnabled && nextJournalLockPinHash) {
        const previousPin = normalizePin(req.body.previousJournalLockPin);
        if (
          previousPin.length !== 4 ||
          !verifyPassword(previousPin, nextJournalLockPinHash)
        ) {
          return res
            .status(403)
            .json({ message: "Previous PIN does not match." });
        }

        if (verifyPassword(nextPin, nextJournalLockPinHash)) {
          return res.status(400).json({
            message: "Choose a new PIN that is different from your current PIN.",
          });
        }

        if (
          previousJournalLockPinHash &&
          verifyPassword(nextPin, previousJournalLockPinHash)
        ) {
          return res.status(400).json({
            message: "Choose a new PIN that is different from your previous PIN.",
          });
        }

        nextSettings.previousJournalLockPinHash = nextJournalLockPinHash;
      } else if (nextJournalLockEnabled !== true) {
        return res.status(400).json({
          message: "Turn on Journal Lock before changing the PIN.",
        });
      } else if (
        previousJournalLockPinHash &&
        verifyPassword(nextPin, previousJournalLockPinHash)
      ) {
        return res.status(400).json({
          message: "Choose a new PIN that is different from your previous PIN.",
        });
      }

      nextJournalLockPinHash = hashPassword(nextPin);
      nextJournalLockEnabled = true;
    }

    if (nextJournalLockEnabled && !nextJournalLockPinHash) {
      return res.status(400).json({ message: "Create a 4-digit PIN first." });
    }

    const savedRecord = await saveStudentPreferenceRecord({
      journalLockAutoLock: nextJournalLockAutoLock,
      journalLockEnabled: nextJournalLockEnabled,
      journalLockPinHash: nextJournalLockPinHash,
      settings: nextSettings,
      studentNumber,
    });

    return res.json({
      message: "Preferences saved.",
      preferences: normalizeStudentPreferences(savedRecord),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to save student preferences.",
    });
  }
});

router.post("/preferences/journal-lock/verify", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const pin = normalizePin(req.body.pin);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  if (pin.length !== 4) {
    return res.status(400).json({ message: "Enter your 4-digit PIN." });
  }

  try {
    const record = await loadStudentPreferenceRecord(studentNumber);
    const preferences = normalizeStudentPreferences(record);
    const pinHash = record?.journal_lock_pin_hash || "";

    if (!preferences.journalLockEnabled || !pinHash) {
      return res.status(400).json({ message: "Journal Lock is not enabled." });
    }

    if (!verifyPassword(pin, pinHash)) {
      return res
        .status(403)
        .json({ message: "That PIN doesn't match. Try again." });
    }

    return res.json({ message: "Journal unlocked.", unlocked: true });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to verify journal PIN.",
    });
  }
});

router.post(["/preferences/journal-lock/send-code", "/preferences/journal-lock/reset/send-code"], requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }

  const currentSession = getJournalLockResetSession(studentNumber);
  if (currentSession && Date.now() < currentSession.resendAvailableAt) {
    const remaining = Math.ceil((currentSession.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const { data: profile, error: profileError } = await loadStudentProfileByNumber(studentNumber);
  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }
  const email = normalizeEmail(profile?.email || "");
  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "This account does not have a valid email on file." });
  }

  const sendResult = await sendRecoveryCode(email, `journal lock reset [${studentNumber}]`);
  if (!sendResult.ok) {
    return res.status(400).json({ message: sendResult.message || "Failed to send verification code." });
  }

  const now = Date.now();
  setJournalLockResetSession(studentNumber, {
    studentNumber,
    email,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Verification code sent to your current email.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
    emailHint: maskEmail(email),
  });
});

router.post(["/preferences/journal-lock/resend-code", "/preferences/journal-lock/reset/resend-code"], requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const session = getJournalLockResetSession(studentNumber);
  if (!session) {
    return res.status(400).json({ message: "Please request a verification code first." });
  }
  if (Date.now() < session.resendAvailableAt) {
    const remaining = Math.ceil((session.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const sendResult = await sendRecoveryCode(session.email, `journal lock reset resend [${studentNumber}]`);
  if (!sendResult.ok) {
    return res.status(400).json({ message: sendResult.message || "Failed to send verification code." });
  }

  const now = Date.now();
  setJournalLockResetSession(studentNumber, {
    ...session,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Verification code sent to your current email.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
    emailHint: maskEmail(session.email),
  });
});

router.post(["/preferences/journal-lock/verify-code", "/preferences/journal-lock/reset/verify-code"], requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const token = String(req.body.token || req.body.code || "").trim();
  if (!studentNumber || !token) {
    return res.status(400).json({ message: "Verification code is required." });
  }

  const session = getJournalLockResetSession(studentNumber);
  if (!session) {
    return res.status(400).json({ message: "Please request a verification code first." });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearJournalLockResetSession(studentNumber);
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.email,
    token,
    type: "recovery",
  });
  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
    });
  }

  setJournalLockResetSession(studentNumber, {
    ...session,
    verifiedAt: Date.now(),
  });

  return res.json({ message: "OTP verified." });
});

router.post("/preferences/journal-lock/reset", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber || !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "A valid Student ID is required." });
  }

  const session = getJournalLockResetSession(studentNumber);
  if (!session || !session.verifiedAt) {
    return res.status(400).json({
      message: "Please verify the email code sent to your current email first.",
    });
  }
  if (Date.now() > session.verifiedAt + RESET_SESSION_MS) {
    clearJournalLockResetSession(studentNumber);
    return res.status(400).json({
      message: "Reset session expired. Please request a new code.",
    });
  }

  const nextPin = normalizePin(req.body.journalLockPin || req.body.pin || req.body.newPin);
  if (nextPin.length !== 4) {
    return res.status(400).json({ message: "Use exactly 4 digits for the PIN." });
  }
  if (req.body.journalLockPinConfirm != null && req.body.journalLockPinConfirm !== "") {
    const confirmPin = normalizePin(req.body.journalLockPinConfirm);
    if (confirmPin !== nextPin) {
      return res.status(400).json({ message: "PIN confirmation does not match." });
    }
  }

  try {
    const currentRecord = await loadStudentPreferenceRecord(studentNumber);
    const currentPreferences = normalizeStudentPreferences(currentRecord);
    const currentSettings =
      currentRecord?.settings && typeof currentRecord.settings === "object"
        ? currentRecord.settings
        : {};
    const nextSettings = { ...currentSettings };
    const currentPinHash = currentRecord?.journal_lock_pin_hash || "";
    if (currentPinHash && verifyPassword(nextPin, currentPinHash)) {
      return res.status(400).json({
        message: "Choose a new PIN that is different from your current PIN.",
      });
    }
    const previousJournalLockPinHash = getPreviousJournalLockPinHash(currentSettings);
    if (previousJournalLockPinHash && verifyPassword(nextPin, previousJournalLockPinHash)) {
      return res.status(400).json({
        message: "Choose a new PIN that is different from your previous PIN.",
      });
    }
    if (currentPinHash) {
      nextSettings.previousJournalLockPinHash = currentPinHash;
    }

    const savedRecord = await saveStudentPreferenceRecord({
      journalLockAutoLock: isBoolean(req.body.journalLockAutoLock)
        ? req.body.journalLockAutoLock
        : currentPreferences.journalLockAutoLock,
      journalLockEnabled: true,
      journalLockPinHash: hashPassword(nextPin),
      settings: nextSettings,
      studentNumber,
    });

    clearJournalLockResetSession(studentNumber);
    return res.json({
      message: "Journal Lock PIN was reset.",
      preferences: normalizeStudentPreferences(savedRecord),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to reset journal lock.",
    });
  }
});

router.get("/referral", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  try {
    const record = await ensureStudentReferralRecord(studentNumber);
    return res.json({ referral: normalizeReferralRecord(record) });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to load referral details.",
    });
  }
});

router.post("/referral/redeem", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const referralCode = normalizeReferralCode(req.body.referralCode || "");

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  if (referralCode.length !== REFERRAL_CODE_LENGTH) {
    return res
      .status(400)
      .json({ message: "Enter a valid 9-character referral code." });
  }

  try {
    const ownRecord = await ensureStudentReferralRecord(studentNumber);

    if (ownRecord.referred_by_student_number) {
      return res.status(409).json({
        message: "You already redeemed a referral code.",
        referral: normalizeReferralRecord(ownRecord),
      });
    }

    if (ownRecord.referral_code === referralCode) {
      return res
        .status(400)
        .json({ message: "You can't use your own referral code." });
    }

    const referrerRecord = await getReferralRecordByCode(referralCode);
    if (!referrerRecord) {
      return res.status(404).json({ message: "Referral code was not found." });
    }

    const redemption = await query(
      `
        with updated_referral as (
          update public.student_referrals
          set
            referred_by_student_number = $2,
            referred_by_code = $3,
            redeemed_at = now(),
            updated_at = now()
          where student_number = $1
            and referred_by_student_number is null
            and referral_code <> $3
          returning student_number, referral_code, referred_by_code, referred_by_student_number, redeemed_at
        ),
        redeemer_reward as (
          insert into public.student_tala_wallets (
            student_number,
            total_tala,
            updated_at
          )
          select student_number, $4, now()
          from updated_referral
          on conflict (student_number)
          do update set
            total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
            updated_at = now()
          returning total_tala
        ),
        referrer_reward as (
          insert into public.student_tala_wallets (
            student_number,
            total_tala,
            updated_at
          )
          select $2, $5, now()
          from updated_referral
          on conflict (student_number)
          do update set
            total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
            updated_at = now()
          returning total_tala
        ),
        referrer_notification as (
          insert into public.student_notifications (
            student_number,
            kind,
            title,
            message,
            metadata
          )
          select
            $2,
            'REFERRAL_REWARD',
            'Congratulations!',
            'Someone joined Bawat Tala with your referral code. You earned 150 Tala.',
            jsonb_build_object(
              'rewardTala', $5,
              'redeemerStudentNumber', student_number,
              'referralCode', $3
            )
          from updated_referral
          returning id
        )
        select
          updated_referral.referral_code,
          updated_referral.referred_by_code,
          updated_referral.referred_by_student_number,
          updated_referral.redeemed_at,
          (select total_tala from redeemer_reward limit 1) as total_tala
        from updated_referral
      `,
      [
        studentNumber,
        referrerRecord.student_number,
        referrerRecord.referral_code,
        REFERRAL_JOIN_REWARD_TALA,
        REFERRAL_INVITE_REWARD_TALA,
      ],
    );

    const savedRecord = redemption.rows[0];
    if (!savedRecord) {
      const currentRecord = await ensureStudentReferralRecord(studentNumber);
      return res.status(409).json({
        message: "You already redeemed a referral code.",
        referral: normalizeReferralRecord(currentRecord),
      });
    }

    return res.json({
      message: `Referral code redeemed. You earned ${REFERRAL_JOIN_REWARD_TALA} Tala.`,
      referral: normalizeReferralRecord(savedRecord),
      rewardTala: REFERRAL_JOIN_REWARD_TALA,
      totalTala: Number(savedRecord.total_tala || 0),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to redeem referral code.",
    });
  }
});

router.post("/send-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const { data: existingProfile, error: existingProfileError } =
    await supabaseAdminClient
      .from("student_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

  if (existingProfileError) {
    return res.status(500).json({
      message:
        existingProfileError.message || "Unable to validate email status.",
    });
  }

  if (existingProfile) {
    return res.status(409).json({
      message: "This email is already registered. Please log in instead.",
    });
  }

  const currentOtpSession = getRegistrationOtpSession(email);
  if (currentOtpSession && Date.now() < currentOtpSession.resendAvailableAt) {
    const remaining = Math.ceil((currentOtpSession.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  try {
    await deleteStaleAuthUsersByEmail(email);
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to prepare email verification.",
    });
  }

  const { error } = await supabaseAuthClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) {
    const msg = error.message || "Failed to send OTP email.";
    if (msg.toLowerCase().includes("error sending confirmation email")) {
      return res.status(502).json({
        message:
          "Supabase could not send the verification email. Check Supabase Auth email provider/SMTP settings in dashboard.",
      });
    }
    return res.status(400).json({ message: msg });
  }

  const now = Date.now();
  setRegistrationOtpSession(email, {
    email,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: "OTP sent successfully.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/forgot-password/send-code", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const email = normalizeEmail(req.body.email || "");

  if (!studentNumber && !email) {
    return res
      .status(400)
      .json({ message: "Student ID and email are required." });
  }
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Enter Student ID in 23-2903 format." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const { data: profile, error: profileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("student_number, email, is_email_verified, is_id_verified")
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }

  const canReset =
    Boolean(profile) &&
    normalizeEmail(profile.email || "") === email &&
    profile.is_email_verified === true &&
    profile.is_id_verified === true;

  if (!canReset) {
    return res.status(400).json({
      message: "Student ID and email do not match an active Bawat Tala account.",
    });
  }

  const sendResult = await sendRecoveryCode(email, `student forgot password [${studentNumber}]`);
  if (!sendResult.ok) {
    return res
      .status(400)
      .json({ message: sendResult.message || "Failed to send reset code." });
  }

  const now = Date.now();
  setResetSession(studentNumber, {
    studentNumber,
    email,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Reset code sent successfully.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/profile-password/send-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res
      .status(400)
      .json({ message: "Enter Student ID in 23-2903 format." });
  }

  const { data: profile, error: profileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("student_number, email, is_email_verified, is_id_verified")
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }

  const email = normalizeEmail(req.body.email || profile?.email || "");
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const matchedAccount =
    Boolean(profile) &&
    normalizeEmail(profile.email || "") === email &&
    profile.is_email_verified === true &&
    profile.is_id_verified === true;

  if (!matchedAccount) {
    return res.status(400).json({
      message:
        "Student ID and email do not match an active Bawat Tala account.",
    });
  }

  const sendResult = await sendRecoveryCode(email, `student profile password [${studentNumber}]`);
  if (!sendResult.ok) {
    return res
      .status(400)
      .json({ message: sendResult.message || "Failed to send reset code." });
  }

  const now = Date.now();
  setResetSession(studentNumber, {
    studentNumber,
    email,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Reset code sent successfully.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/forgot-password/resend-code", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const session = getResetSession(studentNumber);
  if (!session) {
    return res
      .status(400)
      .json({ message: "Please confirm your account first." });
  }
  if (Date.now() < session.resendAvailableAt) {
    const remaining = Math.ceil((session.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const sendResult = await sendRecoveryCode(session.email, `student forgot password resend [${studentNumber}]`);
  if (!sendResult.ok) {
    return res
      .status(400)
      .json({ message: sendResult.message || "Failed to send reset code." });
  }

  const now = Date.now();
  setResetSession(studentNumber, {
    ...session,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
  });

  return res.json({
    message: "Reset code sent successfully.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
  });
});

router.post("/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const token = String(req.body.token || "").trim();

  if (!email || !token) {
    return res
      .status(400)
      .json({ message: "Email and OTP token are required." });
  }

  const session = getRegistrationOtpSession(email);
  if (!session) {
    return res.status(400).json({ message: "Please request a verification code first." });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearRegistrationOtpSession(email);
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
    });
  }

  clearRegistrationOtpSession(email);
  return res.json({ message: "OTP verified." });
});

router.post("/forgot-password/verify-code", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const token = String(req.body.token || "").trim();
  if (!studentNumber || !token) {
    return res
      .status(400)
      .json({ message: "Student ID and OTP token are required." });
  }

  const session = getResetSession(studentNumber);
  if (!session) {
    return res
      .status(400)
      .json({ message: "Please confirm your account first." });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearResetSession(studentNumber);
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.email,
    token,
    type: "recovery",
  });

  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
    });
  }

  setResetSession(studentNumber, {
    ...session,
    verifiedAt: Date.now(),
  });

  return res.json({ message: "OTP verified." });
});

router.post("/register-profile", async (req, res) => {
  const password = normalizeCompactSpaces(req.body.password || "");
  const payload = {
    full_name: normalizeUpperText(req.body.fullName || ""),
    student_number: normalizeStudentNumber(req.body.studentNumber || ""),
    program: normalizeUpperText(req.body.program || ""),
    gender: normalizeStudentGender(req.body.gender || ""),
    region: normalizeUpperText(req.body.region || ""),
    province: normalizeUpperText(req.body.province || ""),
    city: normalizeUpperText(req.body.city || ""),
    barangay: normalizeUpperText(req.body.barangay || ""),
    street: normalizeUpperText(req.body.street || ""),
    email: normalizeEmail(req.body.email || ""),
    birthdate: normalizeCompactSpaces(req.body.birthdate || ""),
    password_hash: password ? hashPassword(password) : "",
    is_email_verified: true,
    is_id_verified: true,
  };

  if (
    !payload.full_name ||
    !payload.student_number ||
    !payload.email ||
    !password
  ) {
    return res
      .status(400)
      .json({ message: "Missing required profile fields." });
  }

  if (!payload.gender) {
    return res.status(400).json({ message: "Invalid gender value." });
  }

  const { data: existingProfile, error: existingProfileError } =
    await supabaseAdminClient
      .from("student_profiles")
      .select("id, email, student_number")
      .or(
        `email.eq.${payload.email},student_number.eq.${payload.student_number}`,
      )
      .maybeSingle();

  if (existingProfileError && existingProfileError.code !== "PGRST116") {
    return res.status(400).json({ message: existingProfileError.message });
  }

  if (existingProfile?.id) {
    if (existingProfile.email === payload.email) {
      return res.status(409).json({
        message: "This email is already registered. Please log in instead.",
      });
    }
    if (existingProfile.student_number === payload.student_number) {
      return res.status(409).json({
        message: "Student ID is already registered. Please log in instead.",
      });
    }
  }

  const { error } = await supabaseAdminClient
    .from("student_profiles")
    .insert(payload);

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This account is already registered. Please log in instead.",
      });
    }
    return res.status(400).json({ message: error.message });
  }

  req.session.student = {
    studentNumber: payload.student_number,
    email: normalizeEmail(payload.email || ""),
    fullName: toTitleCase(payload.full_name || ""),
  };
  const token = createStudentToken(payload.student_number);

  return res.json({
    message: "Profile saved.",
    token,
    user: {
      studentNumber: payload.student_number,
      fullName: toTitleCase(payload.full_name || ""),
      firstName: toTitleCase(payload.full_name || "").split(" ")[0] || "User",
      email: normalizeEmail(payload.email || ""),
      token,
    },
  });
});

router.post("/forgot-password/reset", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
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
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const session = getResetSession(studentNumber);
  if (!session || !session.verifiedAt) {
    return res
      .status(400)
      .json({ message: "Please verify your reset code first." });
  }
  if (Date.now() > session.verifiedAt + RESET_SESSION_MS) {
    clearResetSession(studentNumber);
    return res
      .status(400)
      .json({ message: "Reset session expired. Please request a new code." });
  }

  const { data: profile, error: profileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("student_number, password_hash")
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }
  if (!profile?.password_hash) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  if (verifyPassword(newPassword, profile.password_hash)) {
    return res.status(400).json({
      message: "Choose a new password that is different from your current password.",
    });
  }

  let currentPreferenceRecord = null;
  try {
    currentPreferenceRecord = await loadStudentPreferenceRecord(studentNumber);
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to check previous account password.",
    });
  }
  const currentPreferences = normalizeStudentPreferences(
    currentPreferenceRecord,
  );
  const currentSettings =
    currentPreferenceRecord?.settings &&
    typeof currentPreferenceRecord.settings === "object"
      ? currentPreferenceRecord.settings
      : {};
  const previousAccountPasswordHash =
    getPreviousAccountPasswordHash(currentSettings);

  if (
    previousAccountPasswordHash &&
    verifyPassword(newPassword, previousAccountPasswordHash)
  ) {
    return res.status(400).json({
      message: "Choose a new password that is different from your previous password.",
    });
  }

  const nextPasswordHash = hashPassword(newPassword);
  const { error } = await supabaseAdminClient
    .from("student_profiles")
    .update({ password_hash: nextPasswordHash })
    .eq("student_number", studentNumber);

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    await saveStudentPreferenceRecord({
      journalLockAutoLock: currentPreferences.journalLockAutoLock,
      journalLockEnabled: currentPreferences.journalLockEnabled,
      journalLockPinHash:
        currentPreferenceRecord?.journal_lock_pin_hash || null,
      settings: {
        ...currentSettings,
        previousAccountPasswordHash: profile.password_hash,
      },
      studentNumber,
    });
  } catch (error) {
    console.warn(
      "Unable to save previous account password history:",
      error?.message || error,
    );
  }

  clearResetSession(studentNumber);
  return res.json({ message: "Password updated successfully" });
});

router.post("/profile/email/send-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const newEmail = normalizeEmail(req.body.newEmail || req.body.email || "");
  if (!newEmail || !EMAIL_PATTERN.test(newEmail)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  let currentEmail = "";
  try {
    currentEmail = await loadCurrentStudentEmail(studentNumber);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to load student email.",
    });
  }

  if (newEmail === currentEmail) {
    return res.status(400).json({
      message: "New email must be different from your current email.",
    });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("student_number")
    .eq("email", newEmail)
    .maybeSingle();
  if (existingProfileError) {
    return res.status(400).json({
      message: existingProfileError.message || "Unable to check email.",
    });
  }
  if (existingProfile && existingProfile.student_number !== studentNumber) {
    return res.status(409).json({ message: "This email is already registered." });
  }

  const existing = getEmailChangeSession(studentNumber);
  if (existing && Date.now() < existing.resendAvailableAt) {
    const remaining = Math.ceil((existing.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  const sendResult = await sendRecoveryCode(
    currentEmail,
    `student email change [${studentNumber}]`,
  );
  if (!sendResult.ok) {
    return res
      .status(400)
      .json({ message: sendResult.message || "Failed to send verification code." });
  }

  const now = Date.now();
  setEmailChangeSession(studentNumber, {
    studentNumber,
    currentEmail,
    newEmail,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
    currentVerifiedAt: 0,
  });

  return res.json({
    message: "Verification code sent to your current email.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
    emailHint: maskEmail(currentEmail),
  });
});

router.post("/profile/email/resend-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const session = getEmailChangeSession(studentNumber);
  if (!session) {
    return res
      .status(400)
      .json({ message: "Please request a verification code first." });
  }
  if (Date.now() < session.resendAvailableAt) {
    const remaining = Math.ceil((session.resendAvailableAt - Date.now()) / 1000);
    return res.status(429).json({ message: `Please wait ${remaining}s before resending.` });
  }

  let currentEmail = session.currentEmail;
  try {
    currentEmail = await loadCurrentStudentEmail(studentNumber);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to load student email.",
    });
  }

  const sendResult = await sendRecoveryCode(
    currentEmail,
    `student email change resend [${studentNumber}]`,
  );
  if (!sendResult.ok) {
    return res
      .status(400)
      .json({ message: sendResult.message || "Failed to send verification code." });
  }

  const now = Date.now();
  setEmailChangeSession(studentNumber, {
    ...session,
    currentEmail,
    otpExpiresAt: now + OTP_VALIDITY_MS,
    resendAvailableAt: now + OTP_COOLDOWN_MS,
    verifiedAt: 0,
  });

  return res.json({
    message: "Verification code sent to your current email.",
    resendAfterSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000),
    emailHint: maskEmail(currentEmail),
  });
});

router.post("/profile/email/verify-code", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const token = String(req.body.token || req.body.code || "").trim();
  const requestedNewEmail = normalizeEmail(req.body.newEmail || req.body.email || "");
  if (!studentNumber || !token) {
    return res
      .status(400)
      .json({ message: "Student ID and OTP token are required." });
  }

  const session = getEmailChangeSession(studentNumber);
  if (!session) {
    return res
      .status(400)
      .json({ message: "Please request a verification code first." });
  }
  if (
    requestedNewEmail &&
    requestedNewEmail !== normalizeEmail(session.newEmail || "") &&
    requestedNewEmail !== normalizeEmail(session.currentEmail || "")
  ) {
    return res.status(400).json({
      message: "That email does not match this verification session.",
    });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearEmailChangeSession(studentNumber);
    return res.status(400).json({
      message: "The code has expired or is invalid. Please try again.",
    });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.currentEmail,
    token,
    type: "recovery",
  });

  if (error) {
    return res.status(400).json({
      message: "The code is invalid. Please check the latest email code and try again.",
    });
  }

  setEmailChangeSession(studentNumber, {
    ...session,
    verifiedAt: Date.now(),
    currentVerifiedAt: Date.now(),
  });

  return res.json({ message: "OTP verified." });
});

router.get("/activity", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const today = getManilaDateParts().isoDate;

  try {
    const [entriesResult, entryCountResult, notificationsResult, notificationCountResult, upcomingResult] =
      await Promise.all([
        query(
          `
            select je.id, je.entry_date, je.created_at, je.summary, je.title,
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
              and je.deleted_by_student_at is null
              and je.is_finished = true
            order by je.entry_date desc, je.created_at desc
            limit 20
          `,
          [studentNumber],
        ),
        query(
          `
            select count(*)::int as total_count
            from public.journal_entries
            where student_number = $1
              and deleted_by_student_at is null
              and is_finished = true
          `,
          [studentNumber],
        ),
        query(
          `
            select id, kind, title, message, metadata, is_read, created_at
            from public.student_notifications
            where student_number = $1
              and deleted_at is null
            order by created_at desc
            limit 20
          `,
          [studentNumber],
        ),
        query(
          `
            select count(*)::int as total_count
            from public.student_notifications
            where student_number = $1
              and deleted_at is null
          `,
          [studentNumber],
        ),
        query(
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
              coalesce(ca.support_type, case when ca.peer_counselor_id is not null then 'PEER' else 'GUIDANCE' end) as support_type
            from public.counselor_appointments ca
            where ca.student_number = $1
              and ca.status in ('PENDING', 'CONFIRMED')
              and ca.appointment_date >= $2::date
            order by ca.appointment_date asc, ca.slot_time asc
            limit 1
          `,
          [studentNumber, today],
        ),
      ]);

    const upcomingRow = upcomingResult.rows[0] || null;
    const upcomingAppointment = upcomingRow
      ? {
          id: upcomingRow.id,
          concern: upcomingRow.concern,
          counselingType: upcomingRow.counseling_type || "",
          appointmentDate: formatEntryDateLabel(upcomingRow.appointment_date),
          slotTime: upcomingRow.slot_time,
          status: upcomingRow.status,
          studentNote: upcomingRow.student_note || "",
          supportType: upcomingRow.support_type || "GUIDANCE",
          bookingSource: upcomingRow.booking_source || "MOBILE_APP",
          createdAt: upcomingRow.created_at,
        }
      : null;

    return res.json({
      entries: entriesResult.rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        preview: row.preview || "",
        summary: row.summary || "",
        createdAt: row.created_at,
        entryDate: formatEntryDateLabel(row.entry_date),
      })),
      totalCount: Number(entryCountResult.rows[0]?.total_count || 0),
      notifications: notificationsResult.rows.map((row) => {
        const metadata = row.metadata || {};
        return {
          id: row.id,
          kind: row.kind,
          title: row.title,
          message: row.message,
          route: resolveActivityNotificationRoute(row.kind, metadata),
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
          timeLabel: formatActivityTimeLabel(row.created_at),
        };
      }),
      notificationsTotalCount: Number(notificationCountResult.rows[0]?.total_count || 0),
      upcomingAppointment,
      today,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to load activity.",
    });
  }
});

router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.student = null;
  }
  return res.json({ message: "Logged out." });
});

module.exports = router;

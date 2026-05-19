const express = require("express");
const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const {
  supabaseAdminClient,
  supabaseAuthClient,
} = require("../config/supabase");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const LOGIN_ATTEMPTS_LIMIT = 3;
const LOGIN_LOCK_DURATION_MS = 10 * 60 * 1000;
const OTP_VALIDITY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;
const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 9;
const REFERRAL_JOIN_REWARD_TALA = 100;
const REFERRAL_INVITE_REWARD_TALA = 150;
const loginAttempts = new Map();
const resetPasswordSessions = new Map();
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
      .json({ message: "Please enter your username and password." });
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
      "student_number, full_name, email, password_hash, birthdate, is_email_verified, is_id_verified",
    )
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  const isValidCredentials =
    Boolean(data) &&
    verifyPassword(password, data.password_hash) &&
    data.is_email_verified === true &&
    data.is_id_verified === true;

  if (!isValidCredentials) {
    const isLocked = registerFailedAttempt(loginKey);
    if (isLocked) {
      return res.status(429).json({
        message: "Too many failed login attempts. Please try again later.",
      });
    }
    return res.status(400).json({
      message: "Invalid username or password. Please try again.",
    });
  }

  loginAttempts.delete(loginKey);
  const fullName = toTitleCase(data.full_name || "");
  const firstName = fullName.split(" ").filter(Boolean)[0] || "User";

  return res.json({
    message: "Login successful.",
    user: {
      studentNumber: data.student_number,
      fullName,
      firstName,
      email: normalizeEmail(data.email || ""),
    },
  });
});

router.get("/profile", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  const { data, error } = await supabaseAdminClient
    .from("student_profiles")
    .select(
      "student_number, full_name, email, program, region, province, city, barangay, street, birthdate",
    )
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  if (!data) {
    return res.status(404).json({ message: "Student profile not found." });
  }

  return res.json({
    profile: {
      barangay: data.barangay || "",
      birthdate: data.birthdate || "",
      city: data.city || "",
      email: normalizeEmail(data.email || ""),
      fullName: toTitleCase(data.full_name || ""),
      program: data.program || "",
      province: data.province || "",
      region: data.region || "",
      street: data.street || "",
      studentNumber: data.student_number,
    },
  });
});

router.get("/preferences", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");

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

router.patch("/preferences", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");

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

    if (isBoolean(req.body.journalLockEnabled)) {
      nextJournalLockEnabled = req.body.journalLockEnabled;
    }

    const nextPin = normalizePin(req.body.journalLockPin);
    if (req.body.journalLockPin != null) {
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

router.post("/preferences/journal-lock/verify", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
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

router.post("/preferences/journal-lock/reset", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const studentNumberConfirmation = normalizeCompactSpaces(
    req.body.studentNumberConfirmation || "",
  );

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid student ID." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumberConfirmation)) {
    return res
      .status(400)
      .json({ message: "Enter Student ID in 23-2903 format." });
  }

  if (studentNumberConfirmation !== studentNumber) {
    return res
      .status(403)
      .json({ message: "Student ID does not match this account." });
  }

  try {
    const currentRecord = await loadStudentPreferenceRecord(studentNumber);
    const currentSettings =
      currentRecord?.settings && typeof currentRecord.settings === "object"
        ? currentRecord.settings
        : {};
    const nextSettings = { ...currentSettings };
    if (currentRecord?.journal_lock_pin_hash) {
      nextSettings.previousJournalLockPinHash =
        currentRecord.journal_lock_pin_hash;
    }
    const savedRecord = await saveStudentPreferenceRecord({
      journalLockAutoLock: true,
      journalLockEnabled: false,
      journalLockPinHash: null,
      settings: nextSettings,
      studentNumber,
    });

    return res.json({
      message: "Journal Lock was reset.",
      preferences: normalizeStudentPreferences(savedRecord),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to reset journal lock.",
    });
  }
});

router.get("/referral", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");

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

router.post("/referral/redeem", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
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

  return res.json({ message: "OTP sent successfully." });
});

router.post("/forgot-password/send-code", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const password = normalizeCompactSpaces(req.body.password || "");

  if (!studentNumber && !password) {
    return res
      .status(400)
      .json({ message: "Please enter your username and password." });
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

  const { data: profile, error: profileError } = await supabaseAdminClient
    .from("student_profiles")
    .select(
      "student_number, email, password_hash, is_email_verified, is_id_verified",
    )
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (profileError) {
    return res.status(400).json({ message: profileError.message });
  }

  const canReset =
    Boolean(profile) &&
    verifyPassword(password, profile.password_hash) &&
    profile.is_email_verified === true &&
    profile.is_id_verified === true;

  if (!canReset) {
    return res.status(400).json({
      message: "The account could not be verified. Please check your details.",
    });
  }

  const email = normalizeEmail(profile.email);
  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(email);

  if (error) {
    return res
      .status(400)
      .json({ message: error.message || "Failed to send reset code." });
  }

  setResetSession(studentNumber, {
    studentNumber,
    email,
    otpExpiresAt: Date.now() + OTP_VALIDITY_MS,
    verifiedAt: 0,
  });

  return res.json({ message: "Reset code sent successfully." });
});

router.post("/profile-password/send-code", async (req, res) => {
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

  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(email);
  if (error) {
    return res
      .status(400)
      .json({ message: error.message || "Failed to send reset code." });
  }

  setResetSession(studentNumber, {
    studentNumber,
    email,
    otpExpiresAt: Date.now() + OTP_VALIDITY_MS,
    verifiedAt: 0,
  });

  return res.json({ message: "Reset code sent successfully." });
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

  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(
    session.email,
  );

  if (error) {
    return res
      .status(400)
      .json({ message: error.message || "Failed to send reset code." });
  }

  setResetSession(studentNumber, {
    ...session,
    otpExpiresAt: Date.now() + OTP_VALIDITY_MS,
  });

  return res.json({ message: "Reset code sent successfully." });
});

router.post("/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  const token = String(req.body.token || "").trim();

  if (!email || !token) {
    return res
      .status(400)
      .json({ message: "Email and OTP token are required." });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

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
      message: "The code has expired or is invalid. Please try again.",
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

  return res.json({ message: "Profile saved." });
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

module.exports = router;

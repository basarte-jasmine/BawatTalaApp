const express = require("express");
const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const { supabaseAdminClient, supabaseAuthClient } = require("../config/supabase");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const LOGIN_ATTEMPTS_LIMIT = 3;
const LOGIN_LOCK_DURATION_MS = 10 * 60 * 1000;
const OTP_VALIDITY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const loginAttempts = new Map();
const resetPasswordSessions = new Map();

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeUpperText(value) {
  return normalizeCompactSpaces(value).toUpperCase();
}

function normalizeEmail(value) {
  return normalizeCompactSpaces(value).toLowerCase();
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
    loginAttempts.set(key, { count: 0, lockUntil: now + LOGIN_LOCK_DURATION_MS });
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

router.post("/login", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const password = String(req.body.password || "").trim();

  if (!studentNumber && !password) {
    return res.status(400).json({ message: "Please enter your username and password." });
  }

  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid email or password." });
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
    .select("student_number, password_hash, birthdate, is_email_verified, is_id_verified")
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
  return res.json({ message: "Login successful." });
});

router.post("/send-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return res.status(500).json({
      message: existingProfileError.message || "Unable to validate email status.",
    });
  }

  if (existingProfile) {
    return res.status(409).json({
      message: "This email is already registered. Please log in instead.",
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
    return res.status(400).json({ message: "Please enter your username and password." });
  }
  if (!studentNumber) {
    return res.status(400).json({ message: "Student ID is required." });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Invalid email or password." });
  }

  const { data: profile, error: profileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("student_number, email, password_hash, is_email_verified, is_id_verified")
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
    return res.status(400).json({ message: error.message || "Failed to send reset code." });
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
    return res.status(400).json({ message: "Please confirm your account first." });
  }

  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(session.email);

  if (error) {
    return res.status(400).json({ message: error.message || "Failed to send reset code." });
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
    return res.status(400).json({ message: "Email and OTP token are required." });
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
    return res.status(400).json({ message: "Student ID and OTP token are required." });
  }

  const session = getResetSession(studentNumber);
  if (!session) {
    return res.status(400).json({ message: "Please confirm your account first." });
  }
  if (Date.now() > session.otpExpiresAt) {
    clearResetSession(studentNumber);
    return res.status(400).json({ message: "The code has expired or is invalid. Please try again." });
  }

  const { error } = await supabaseAuthClient.auth.verifyOtp({
    email: session.email,
    token,
    type: "recovery",
  });

  if (error) {
    return res.status(400).json({ message: "The code has expired or is invalid. Please try again." });
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

  if (!payload.full_name || !payload.student_number || !payload.email || !password) {
    return res.status(400).json({ message: "Missing required profile fields." });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("id, email, student_number")
    .or(`email.eq.${payload.email},student_number.eq.${payload.student_number}`)
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

  const { error } = await supabaseAdminClient.from("student_profiles").insert(payload);

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
      message: "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const session = getResetSession(studentNumber);
  if (!session || !session.verifiedAt) {
    return res.status(400).json({ message: "Please verify your reset code first." });
  }
  if (Date.now() > session.verifiedAt + RESET_SESSION_MS) {
    clearResetSession(studentNumber);
    return res.status(400).json({ message: "Reset session expired. Please request a new code." });
  }

  const { error } = await supabaseAdminClient
    .from("student_profiles")
    .update({ password_hash: hashPassword(newPassword) })
    .eq("student_number", studentNumber);

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  clearResetSession(studentNumber);
  return res.json({ message: "Password updated successfully" });
});

module.exports = router;

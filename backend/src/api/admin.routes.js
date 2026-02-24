const express = require("express");
const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const { google } = require("googleapis");
const { supabaseAdminClient, supabaseAuthClient } = require("../config/supabase");
const { query } = require("../config/db");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const LOGIN_ATTEMPTS_LIMIT = 3;
const LOGIN_LOCK_DURATION_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 30 * 1000;
const OTP_VALIDITY_MS = 60 * 1000;
const RESET_SESSION_MS = 10 * 60 * 1000;

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

async function ensureDefaultAdminAccount() {
  const defaultEmail = normalizeEmail(
    process.env.ADMIN_DEFAULT_EMAIL || "basartejasmine@gmail.com",
  );
  const defaultPassword = String(process.env.ADMIN_DEFAULT_PASSWORD || "DemoAdmin123*");

  const existing = await query("select id from public.admin_accounts where email = $1", [defaultEmail]);
  if (existing.rowCount > 0) return;

  await query(
    `
      insert into public.admin_accounts (email, password_hash, is_active)
      values ($1, $2, true)
      on conflict (email) do nothing
    `,
    [defaultEmail, hashPassword(defaultPassword)],
  );
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
    `select id, email, password_hash, is_active
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
  return res.json({
    message: "Login successful.",
    admin: {
      id: admin.id,
      email: admin.email,
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
      "select id, email, is_active from public.admin_accounts where email = $1 limit 1",
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !admin.is_active) {
      return res.redirect(
        `${webBaseUrl}/login?oauth=error&message=${encodeURIComponent("This Google account is not allowed for admin access.")}`,
      );
    }

    return res.redirect(
      `${webBaseUrl}/login?oauth=success&email=${encodeURIComponent(admin.email)}`,
    );
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

router.get("/dashboard/summary", async (_req, res) => {
  const [{ data: profiles, error: profilesError }, { data: journals, error: journalsError }] =
    await Promise.all([
      supabaseAdminClient
        .from("student_profiles")
        .select("id, gender, program, barangay, created_at"),
      supabaseAdminClient.from("journal_entries").select("id, created_at"),
    ]);

  const safeProfiles = profilesError ? [] : profiles || [];
  const safeJournals = journalsError ? [] : journals || [];

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

  const activeUsageSeries = toMonthlyBuckets(safeProfiles, "created_at");
  const journalEntriesSeries = toMonthlyBuckets(safeJournals, "created_at");

  return res.json({
    cards: {
      totalUsers: safeProfiles.length,
      gender: genderCounts,
      course: courseCounts,
    },
    charts: {
      activeUsage: activeUsageSeries,
      journalEntries: journalEntriesSeries,
      barangay: Object.entries(barangayCounts).map(([label, value]) => ({
        label,
        value,
      })),
    },
    warnings: {
      journalEntriesUnavailable: Boolean(journalsError),
    },
  });
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

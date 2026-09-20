const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./api/auth.routes");
const appointmentRoutes = require("./api/appointment.routes");
const { adminRouter } = require("./api/admin.routes");
const checkinRoutes = require("./api/checkin.routes");
const { feedbackRouter } = require("./api/feedback.routes");
const futureSelfRoutes = require("./api/future-self.routes");
const journalRoutes = require("./api/journal.routes");
const libraryRoutes = require("./api/library.routes");
const moodRoutes = require("./api/mood.routes");
const muniRoutes = require("./api/muni.routes");
const ocrRoutes = require("./api/ocr.routes");
const voiceRoutes = require("./api/voice.routes");
const affirmationRoutes = require("./api/affirmation.routes");
const wellnessRoutes = require("./api/wellness.routes");

const app = express();

// API-first helmet: keep CORS-friendly CORP; CSP off (JSON API, not HTML).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowCredentials = true;
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const adminSessionDays = Number(process.env.ADMIN_SESSION_DAYS || 30);
const localAdminOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];


function requireCookieSessionSecret() {
  const value = String(process.env.COOKIE_SESSION_SECRET || "").trim();
  const placeholders = new Set([
    "",
    "change-this-session-secret",
    "dev-cookie-secret",
    "changeme",
    "secret",
    "replace-with-a-long-random-secret",
  ]);
  if (value && !placeholders.has(value) && value.length >= 16) {
    return value;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return String(process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  console.warn("WARNING: COOKIE_SESSION_SECRET is not configured. Using fallback secret.");
  return "bawattala-secure-cookie-session-secret-fallback-key-2026";
}

const cookieSessionSecret = requireCookieSessionSecret();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth requests. Please try again later." },
});

const authLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

const authOtpSendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification emails requested. Please try again later." },
});

const authOtpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts. Please try again later." },
});

const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many admin login attempts. Please try again in 15 minutes." },
});


const parsedCorsOrigin =
  corsOrigin === "*"
    ? true
    : Array.from(
        new Set(
          corsOrigin
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .concat(localAdminOrigins),
        ),
      );

// Local HTTP must not force trust proxy = 1. With NODE_ENV=production, cookie-session
// used secure:true; cookies then throws on HTTP and Set-Cookie is swallowed.
const trustProxyRaw = String(process.env.TRUST_PROXY ?? "").trim();
if (trustProxyRaw && trustProxyRaw !== "0" && trustProxyRaw.toLowerCase() !== "false") {
  const trustProxyNumber = Number(trustProxyRaw);
  app.set("trust proxy", Number.isFinite(trustProxyNumber) ? trustProxyNumber : trustProxyRaw);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        parsedCorsOrigin === true ||
        (Array.isArray(parsedCorsOrigin) && parsedCorsOrigin.includes(origin)) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: allowCredentials,
  }),
);
app.use(
  cookieSession({
    name: "bt_admin_session",
    keys: [cookieSessionSecret],
    maxAge: adminSessionDays * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    rolling: true,
  }),
);
app.use((req, _res, next) => {
  const encrypted = Boolean(req.secure || req.protocol === "https");
  if (isProduction && encrypted) {
    req.sessionOptions.secure = true;
    req.sessionOptions.sameSite = "none";
  } else {
    req.sessionOptions.secure = false;
    req.sessionOptions.sameSite = "lax";
  }
  next();
});
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth/login", authLoginRateLimiter);
app.use("/api/auth/register-profile", authLoginRateLimiter);
app.use("/api/auth/send-otp", authOtpSendRateLimiter);
app.use("/api/auth/forgot-password/send-code", authOtpSendRateLimiter);
app.use("/api/auth/forgot-password/resend-code", authOtpSendRateLimiter);
app.use("/api/auth/profile-password/send-code", authOtpSendRateLimiter);
app.use("/api/auth/verify-otp", authOtpVerifyRateLimiter);
app.use("/api/auth/forgot-password/verify-code", authOtpVerifyRateLimiter);
app.use("/api/auth/forgot-password/reset", authLoginRateLimiter);
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/admin/login", adminLoginRateLimiter);
app.use("/api/admin/forgot-password/send-code", authOtpSendRateLimiter);
app.use("/api/admin/forgot-password/resend-code", authOtpSendRateLimiter);
app.use("/api/admin/forgot-password/verify-code", authOtpVerifyRateLimiter);
app.use("/api/admin/forgot-password/reset", authLoginRateLimiter);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/inbox", (req, res, next) => {
  const raw = String(req.url || "/");
  const qIndex = raw.indexOf("?");
  const pathPart = ((qIndex >= 0 ? raw.slice(0, qIndex) : raw) || "/");
  const query = qIndex >= 0 ? raw.slice(qIndex) : "";
  const normalizedPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const rest = normalizedPath === "/" ? "" : normalizedPath;
  req.url = `/notifications${rest}${query}`;
  return appointmentRoutes(req, res, next);
});
app.use("/api/checkins", checkinRoutes);
app.use("/api/feedback", feedbackRouter);
app.use("/api/future-self", futureSelfRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/moods", moodRoutes);
app.use("/api/muni", muniRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/ocr", ocrRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/affirmations", affirmationRoutes);
app.use("/api/wellness", wellnessRoutes);

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Uploaded image is too large. Please use a smaller image and try again.",
    });
  }
  return next(err);
});

module.exports = app;

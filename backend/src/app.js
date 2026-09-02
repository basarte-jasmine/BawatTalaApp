const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
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

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowCredentials = true;
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const adminSessionDays = Number(process.env.ADMIN_SESSION_DAYS || 30);
const localAdminOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

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
    origin: parsedCorsOrigin,
    credentials: allowCredentials,
  }),
);
app.use(
  cookieSession({
    name: "bt_admin_session",
    keys: [process.env.COOKIE_SESSION_SECRET || "dev-cookie-secret"],
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

app.use("/api/auth", authRoutes);
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

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Uploaded image is too large. Please use a smaller image and try again.",
    });
  }
  return next(err);
});

module.exports = app;

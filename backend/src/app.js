const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const authRoutes = require("./api/auth.routes");
const { adminRouter } = require("./api/admin.routes");
const ocrRoutes = require("./api/ocr.routes");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowCredentials = true;

const parsedCorsOrigin =
  corsOrigin === "*"
    ? true
    : corsOrigin
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

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
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  }),
);
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/ocr", ocrRoutes);

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Uploaded image is too large. Please use a smaller image and try again.",
    });
  }
  return next(err);
});

module.exports = app;

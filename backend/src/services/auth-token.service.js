const crypto = require("crypto");

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
  return "bawattala-secure-auth-token-secret-fallback-key-2026";
}

const TOKEN_SECRET = requireCookieSessionSecret();
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function createStudentToken(studentNumber) {
  const payload = {
    studentNumber: String(studentNumber || "").trim().toUpperCase(),
    exp: Date.now() + TOKEN_MAX_AGE_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyStudentToken(tokenString) {
  if (!tokenString || typeof tokenString !== "string") return null;
  const parts = tokenString.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expectedSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function createAdminToken(admin) {
  const payload = {
    adminId: admin?.id || "",
    email: String(admin?.email || "").trim().toLowerCase(),
    fullName: String(admin?.fullName || admin?.full_name || "").trim(),
    role: String(admin?.role || "COUNSELOR").toUpperCase(),
    exp: Date.now() + TOKEN_MAX_AGE_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAdminToken(tokenString) {
  if (!tokenString || typeof tokenString !== "string") return null;
  const parts = tokenString.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expectedSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function createOAuthState(extraData = {}) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = {
    nonce,
    ...extraData,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyOAuthState(stateString) {
  if (!stateString || typeof stateString !== "string") return null;
  const parts = stateString.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expectedSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createAdminToken,
  createOAuthState,
  createStudentToken,
  verifyAdminToken,
  verifyOAuthState,
  verifyStudentToken,
};

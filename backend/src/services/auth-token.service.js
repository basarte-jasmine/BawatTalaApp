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

const PRIMARY_TOKEN_SECRET = requireCookieSessionSecret();
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getVerificationSecrets() {
  const secrets = new Set();
  if (PRIMARY_TOKEN_SECRET) secrets.add(PRIMARY_TOKEN_SECRET);
  const cookieSecret = String(process.env.COOKIE_SESSION_SECRET || "").trim();
  if (cookieSecret && cookieSecret.length >= 16) secrets.add(cookieSecret);
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (serviceRoleKey) secrets.add(serviceRoleKey);
  secrets.add("bawattala-secure-auth-token-secret-fallback-key-2026");
  return Array.from(secrets);
}

function createStudentToken(studentNumber) {
  const payload = {
    studentNumber: String(studentNumber || "").trim().toUpperCase(),
    exp: Date.now() + TOKEN_MAX_AGE_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", PRIMARY_TOKEN_SECRET).update(body).digest("base64url");
  return body + "." + signature;
}

function verifyTokenWithSecrets(tokenString) {
  if (!tokenString || typeof tokenString !== "string") return null;
  const parts = tokenString.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const sigBuffer = Buffer.from(signature);

  const secrets = getVerificationSecrets();
  for (const secret of secrets) {
    try {
      const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
      const expectedBuffer = Buffer.from(expectedSignature);
      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (payload.exp && Date.now() > payload.exp) {
          return null;
        }
        return payload;
      }
    } catch {
      // Try next secret candidate
    }
  }
  return null;
}

function verifyStudentToken(tokenString) {
  return verifyTokenWithSecrets(tokenString);
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
  const signature = crypto.createHmac("sha256", PRIMARY_TOKEN_SECRET).update(body).digest("base64url");
  return body + "." + signature;
}

function verifyAdminToken(tokenString) {
  return verifyTokenWithSecrets(tokenString);
}

function createOAuthState(extraData = {}) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = {
    nonce,
    ...extraData,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", PRIMARY_TOKEN_SECRET).update(body).digest("base64url");
  return body + "." + signature;
}

function verifyOAuthState(stateString) {
  return verifyTokenWithSecrets(stateString);
}

module.exports = {
  createAdminToken,
  createOAuthState,
  createStudentToken,
  verifyAdminToken,
  verifyOAuthState,
  verifyStudentToken,
};

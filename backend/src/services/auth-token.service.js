const crypto = require("crypto");

const TOKEN_SECRET = process.env.COOKIE_SESSION_SECRET || "dev-cookie-secret";
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

module.exports = {
  createStudentToken,
  verifyStudentToken,
};

const BANNED_SECRETS = new Set([
  "",
  "change-this-session-secret",
  "dev-cookie-secret",
]);

function resolveSessionSecret() {
  const secret = String(process.env.COOKIE_SESSION_SECRET || "").trim();
  if (!secret || BANNED_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      "COOKIE_SESSION_SECRET must be set to a unique value at least 32 characters long. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
        "and put it in backend/.env (never commit real secrets).",
    );
  }
  return secret;
}

module.exports = {
  resolveSessionSecret,
};

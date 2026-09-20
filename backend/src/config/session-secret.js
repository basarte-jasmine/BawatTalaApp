const BANNED_SECRETS = new Set([
  "",
  "change-this-session-secret",
  "dev-cookie-secret",
]);

function resolveSessionSecret() {
  const secret = String(process.env.COOKIE_SESSION_SECRET || "").trim();
  if (secret && !BANNED_SECRETS.has(secret) && secret.length >= 16) {
    return secret;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return String(process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return "bawattala-secure-cookie-session-secret-fallback-key-2026";
}

module.exports = {
  resolveSessionSecret,
};

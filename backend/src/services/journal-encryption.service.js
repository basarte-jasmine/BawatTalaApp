const crypto = require("crypto");

/**
 * Centralized Backend Journal Field Encryption Service
 * Implements AES-256-GCM authenticated encryption with unique 12-byte IV per field,
 * authentication tag, key rotation support, and Additional Authenticated Data (AAD)
 * tied to table, column, and record identity to prevent ciphertext transplantation attacks.
 *
 * Ciphertext format: v1:<keyId>:<ivBase64>:<tagBase64>:<cipherBase64>
 */

const KEY_ROTATION_STORE = new Map();

function deriveKey(rawKey) {
  if (!rawKey) {
    throw new Error("Encryption key is required.");
  }
  const trimmed = String(rawKey).trim();
  // Hex 64 chars -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  // Base64 44 chars -> 32 bytes
  if (/^[A-Za-z0-9+/]{43}=$/.test(trimmed) || /^[A-Za-z0-9+/]{44}$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  }
  // Otherwise securely derive 32-byte key via SHA-256
  return crypto.createHash("sha256").update(trimmed).digest();
}

function getPrimaryEncryptionKey() {
  const envKey = process.env.JOURNAL_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!envKey) {
    throw new Error("JOURNAL_ENCRYPTION_KEY environment variable is required.");
  }
  return deriveKey(envKey);
}

function getKeyById(keyId) {
  if (keyId === "primary" || !keyId) {
    return getPrimaryEncryptionKey();
  }
  if (KEY_ROTATION_STORE.has(keyId)) {
    return KEY_ROTATION_STORE.get(keyId);
  }
  // Fall back to primary if no other key mapped
  return getPrimaryEncryptionKey();
}

/**
 * Register an older key for reading legacy encrypted records during key rotation.
 */
function registerRotationKey(keyId, rawKey) {
  KEY_ROTATION_STORE.set(keyId, deriveKey(rawKey));
}

function isEncrypted(value) {
  if (typeof value !== "string") return false;
  return value.startsWith("v1:");
}

function getEncryptionVersion(value) {
  if (!isEncrypted(value)) return null;
  const parts = value.split(":");
  return parts[0] || null;
}

/**
 * Encrypt a sensitive text field using AES-256-GCM authenticated encryption.
 * @param {string|null|undefined} plaintext - The plaintext string to encrypt.
 * @param {Object} context - { table: string, column: string, id: string }
 * @param {string} keyId - Key identifier for rotation (defaults to 'primary')
 * @returns {string|null} - Encrypted string or original value if null/undefined/empty
 */
function encryptField(plaintext, context = {}, keyId = "primary") {
  if (plaintext === null || plaintext === undefined) {
    return plaintext;
  }
  const text = String(plaintext);
  if (text === "") {
    return text;
  }
  // If already encrypted, do not double encrypt
  if (isEncrypted(text)) {
    return text;
  }

  const key = getKeyById(keyId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const { table = "", column = "", id = "" } = context;
  const aad = Buffer.from(`${table}:${column}:${id}`, "utf8");
  cipher.setAAD(aad);

  let ciphertext = cipher.update(text, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const tag = cipher.getAuthTag().toString("base64");

  return `v1:${keyId}:${iv.toString("base64")}:${tag}:${ciphertext}`;
}

/**
 * Decrypt an encrypted field using AES-256-GCM.
 * Supports dual-read compatibility for legacy plaintext records.
 * @param {string|null|undefined} storedValue - The ciphertext or legacy plaintext
 * @param {Object} context - { table: string, column: string, id: string }
 * @returns {string|null} - Decrypted plaintext or legacy plaintext
 */
function decryptField(storedValue, context = {}) {
  if (storedValue === null || storedValue === undefined) {
    return storedValue;
  }
  if (typeof storedValue !== "string" || !isEncrypted(storedValue)) {
    // Dual-read support: Legacy plaintext records returned as-is
    return storedValue;
  }

  const parts = storedValue.split(":");
  if (parts.length < 5) {
    return storedValue;
  }

  const [version, keyId, ivBase64, tagBase64, ...cipherParts] = parts;
  const cipherBase64 = cipherParts.join(":");

  if (version !== "v1") {
    return storedValue;
  }

  const key = getKeyById(keyId);
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const { table = "", column = "", id = "" } = context;

  // Try with provided context
  try {
    const aad = Buffer.from(`${table}:${column}:${id}`, "utf8");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(cipherBase64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    // If context table is journal_entry_messages, try fallback with row id if available or empty aad
    if (context.altId) {
      try {
        const aadAlt = Buffer.from(`${table}:${column}:${context.altId}`, "utf8");
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(aadAlt);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(cipherBase64, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      } catch {}
    }
    // Return empty string or fallback gracefully without throwing unhandled exceptions
    console.warn("Journal decryption warning for field " + column + ":", err?.message || err);
    return "";
  }
}

function validateEncryptionKeyOnStartup() {
  try {
    const key = getPrimaryEncryptionKey();
    if (!key || key.length !== 32) {
      throw new Error("Master encryption key must resolve to exactly 32 bytes.");
    }
    const testEnc = encryptField("startup_check", { table: "test", column: "test", id: "startup" });
    const testDec = decryptField(testEnc, { table: "test", column: "test", id: "startup" });
    if (testDec !== "startup_check") {
      throw new Error("Encryption self-test verification failed.");
    }
    return { ok: true };
  } catch (err) {
    console.error("FATAL: Journal encryption key validation failed:", err?.message || err);
    throw err;
  }
}

module.exports = {
  encryptField,
  decryptField,
  isEncrypted,
  getEncryptionVersion,
  validateEncryptionKeyOnStartup,
  registerRotationKey,
};

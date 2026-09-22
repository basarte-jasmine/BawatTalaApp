function toTitleCase(value) {
  const ROMAN_NUMERALS = new Set([
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"
  ]);

  const LOWERCASE_PARTICLES = new Set([
    "de", "del", "la", "los", "las", "da", "di", "van", "von", "y"
  ]);

  function formatSegment(segment) {
    if (!segment) return "";
    const upper = segment.toUpperCase();
    if (ROMAN_NUMERALS.has(upper)) return upper;
    if (upper === "JR" || upper === "JR.") return upper.endsWith(".") ? "Jr." : "Jr";
    if (upper === "SR" || upper === "SR.") return upper.endsWith(".") ? "Sr." : "Sr";

    if (/^[a-zA-Z]'[a-zA-Z]/.test(segment)) {
      const parts = segment.split("'");
      return parts
        .map((p, i) => (i === 0 ? p.toUpperCase() : formatSegment(p)))
        .join("'");
    }

    if (/^mc[a-z]/i.test(segment) && segment.length > 2) {
      return "Mc" + segment.charAt(2).toUpperCase() + segment.slice(3).toLowerCase();
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
  }

  function formatWord(word, index) {
    if (!word) return "";
    const lower = word.toLowerCase();

    if (word.includes("-")) {
      return word
        .split("-")
        .map((part, pIdx) => {
          if (index > 0 && pIdx === 0 && LOWERCASE_PARTICLES.has(part.toLowerCase())) {
            return part.toLowerCase();
          }
          return formatSegment(part);
        })
        .join("-");
    }

    if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
      return lower;
    }

    return formatSegment(word);
  }

  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const words = raw.split(" ");
  return words.map((w, idx) => formatWord(w, idx)).join(" ");
}

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { randomBytes, scryptSync } = require("crypto");
const { supabaseAdminClient } = require("../src/config/supabase");

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeUpperText(value) {
  return normalizeCompactSpaces(value).toUpperCase();
}

function normalizeEmail(value) {
  return normalizeCompactSpaces(value).toLowerCase();
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function normalizeStudentGender(value) {
  const normalized = normalizeCompactSpaces(value).toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
    return "";
}

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const defaultStudentNumber = normalizeStudentNumber(
    process.env.DEFAULT_STUDENT_NUMBER || "23-0000",
  );
  const defaultEmail = normalizeEmail(
    process.env.DEFAULT_STUDENT_EMAIL || "emersonang@gmail.com",
  );
  const defaultPassword = String(
    process.env.DEFAULT_STUDENT_PASSWORD || "01/01/2004",
  ).trim();
  const defaultGender = normalizeStudentGender(
    process.env.DEFAULT_STUDENT_GENDER || "Male",
  );

  if (!defaultGender) {
    throw new Error("DEFAULT_STUDENT_GENDER must be Male or Female.");
  }

  const payload = {
    full_name: normalizeUpperText(
      process.env.DEFAULT_STUDENT_FULL_NAME || "EMERSON C. ANG",
    ),
    student_number: defaultStudentNumber,
    program: normalizeUpperText(
      process.env.DEFAULT_STUDENT_PROGRAM || "BS PSYCHOLOGY",
    ),
    gender: defaultGender,
    region: normalizeUpperText(process.env.DEFAULT_STUDENT_REGION || "NCR"),
    province: normalizeUpperText(
      process.env.DEFAULT_STUDENT_PROVINCE || "METRO MANILA",
    ),
    city: normalizeUpperText(process.env.DEFAULT_STUDENT_CITY || "VALENZUELA"),
    barangay: normalizeUpperText(
      process.env.DEFAULT_STUDENT_BARANGAY || "MAYSAN",
    ),
    street: normalizeUpperText(
      process.env.DEFAULT_STUDENT_STREET || "1234 TIONGCO",
    ),
    email: defaultEmail,
    birthdate: normalizeCompactSpaces(
      process.env.DEFAULT_STUDENT_BIRTHDATE || "01/01/2004",
    ),
    password_hash: hashPassword(defaultPassword),
    is_email_verified: true,
    is_id_verified: true,
  };

  const { data: existingProfile, error: existingProfileError } = await supabaseAdminClient
    .from("student_profiles")
    .select("id")
    .eq("student_number", payload.student_number)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile?.id) {
    const { error: updateError } = await supabaseAdminClient
      .from("student_profiles")
      .update({
        full_name: payload.full_name,
        program: payload.program,
        gender: payload.gender,
        region: payload.region,
        province: payload.province,
        city: payload.city,
        barangay: payload.barangay,
        street: payload.street,
        email: payload.email,
        birthdate: payload.birthdate,
        password_hash: payload.password_hash,
        is_email_verified: true,
        is_id_verified: true,
      })
      .eq("student_number", payload.student_number);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated test student account ${payload.student_number}.`);
    return;
  }

  const { error: insertError } = await supabaseAdminClient
    .from("student_profiles")
    .insert(payload);

  if (insertError) {
    throw insertError;
  }

  await supabaseAdminClient.from("student_app_preferences").insert({ student_number: payload.student_number, settings: {}, journal_lock_enabled: false, journal_lock_auto_lock: true }).then(() => {}).catch(() => {});
  console.log(`Inserted test student account ${payload.student_number}.`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

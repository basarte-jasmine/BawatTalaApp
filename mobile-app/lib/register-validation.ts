export const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
export const NAME_PATTERN = /^(?=.{2,}$)[\p{L}][\p{L}\p{M} .'-]*$/u;
export const BIRTHDATE_PATTERN = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;

function normalizeOcrText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function isLikelySchoolId(ocrText: string) {
  if (!ocrText || typeof ocrText !== "string") return false;
  const normalized = normalizeOcrText(ocrText);
  if (!normalized) return false;

  if (normalized.includes("PLVWORLD")) {
    return true;
  }

  if (
    normalized.includes("PAMANTASAN NG LUNGSOD NG VALENZUELA") ||
    (normalized.includes("PAMANTASAN") && normalized.includes("VALENZUELA")) ||
    (normalized.includes("PLV") && normalized.includes("VALENZUELA"))
  ) {
    return true;
  }

  const requiredWords = ["PAMANTASAN", "NG", "LUNGSOD", "VALENZUELA"];
  return requiredWords.every((word) => normalized.includes(word));
}

export function isValidName(name: string) {
  return NAME_PATTERN.test(name.trim());
}

export function isValidStudentNumber(value: string) {
  return STUDENT_NUMBER_PATTERN.test(value.trim());
}

export function validateStudentBirthdate(value: string): { isValid: boolean; error?: string } {
  if (!value || typeof value !== "string") {
    return { isValid: false, error: "Birthdate is required." };
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/);
  if (!match) {
    return { isValid: false, error: "Enter birthdate as MM/DD/YYYY." };
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { isValid: false, error: "Please enter a valid calendar date." };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // 1. Future date check
  if (
    year > currentYear ||
    (year === currentYear && month > currentMonth) ||
    (year === currentYear && month === currentMonth && day > currentDay)
  ) {
    return { isValid: false, error: "Birthdate cannot be in the future." };
  }

  // 2. Today's date check
  if (year === currentYear && month === currentMonth && day === currentDay) {
    return { isValid: false, error: "Birthdate cannot be today's date." };
  }

  // 3. Exact age calculation for college students (minimum 16 years old)
  let age = currentYear - year;
  if (
    currentMonth < month ||
    (currentMonth === month && currentDay < day)
  ) {
    age--;
  }

  const MIN_COLLEGE_AGE = 16;
  const MAX_REASONABLE_AGE = 100;

  if (age < MIN_COLLEGE_AGE) {
    return {
      isValid: false,
      error: "Student must be at least 16 years old to register.",
    };
  }

  if (age > MAX_REASONABLE_AGE) {
    return {
      isValid: false,
      error: "Please enter a valid birthdate.",
    };
  }

  return { isValid: true };
}

export function isValidBirthdate(value: string) {
  return validateStudentBirthdate(value).isValid;
}

export function cleanAndValidateStreet(
  rawStreet: string,
  barangay = "",
  city = "",
  province = "",
  region = "",
) {
  if (!rawStreet) {
    return { error: "Street is required." };
  }
  let cleaned = String(rawStreet).trim().replace(/\s+/g, " ");
  const JUNK_VALUES = new Set([
    "SECRET", "NONE", "N/A", "NA", "NOT AVAILABLE", "UNKNOWN",
    "TEST", "SAMPLE", "ASDF", "QWERTY", "NULL", "UNDEFINED",
    "XXX", "SAME", "NOTHING", "BLANK", "EMPTY"
  ]);
  if (JUNK_VALUES.has(cleaned.toUpperCase())) {
    return { error: "Please enter a valid street address." };
  }
  if (!/[a-zA-Z]/.test(cleaned)) {
    return { error: "Street address must include a street name, not just numbers." };
  }
  if (cleaned.replace(/[^a-zA-Z0-9]/g, "").length < 3) {
    return { error: "Street address is too short. Please enter a valid street name." };
  }
  const redundantPhrases = [
    "Valenzuela City",
    "Metro Manila",
    "National Capital Region",
    city ? city + " City" : "",
    province ? province + " Province" : "",
    barangay,
    city,
    province,
    region,
    "Valenzuela",
    "NCR"
  ].filter(Boolean);
  redundantPhrases.sort((a, b) => b.length - a.length);
  for (const phrase of redundantPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("(?:,\\s*|\\s+|-)\\s*" + escaped + "\\b", "gi");
    cleaned = cleaned.replace(regex, "");
  }
  const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bSt\.?\b/gi, "Street"],
    [/\bAve\.?\b/gi, "Avenue"],
    [/\bRd\.?\b/gi, "Road"],
    [/\bBlvd\.?\b/gi, "Boulevard"],
    [/\bDr\.?\b/gi, "Drive"],
    [/\bExt\.?\b/gi, "Extension"],
    [/\bSubd\.?\b/gi, "Subdivision"],
    [/\bVl?ge\.?\b/gi, "Village"],
    [/\bCpd\.?\b/gi, "Compound"],
    [/\bHwy\.?\b/gi, "Highway"],
    [/\bBldg\.?\b/gi, "Building"],
    [/\bBrgy\.?\b/gi, "Barangay"]
  ];
  for (const [abbrRegex, replacement] of ABBREVIATIONS) {
    cleaned = cleaned.replace(abbrRegex, replacement);
  }
  cleaned = cleaned.replace(/[,.-]+$/, "").trim();
  cleaned = cleaned.toLowerCase().split(" ").filter(Boolean).map((word) => {
    if (word.includes("-")) {
      return word.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("-");
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
  if (cleaned.length < 3 || cleaned.length > 120) {
    return { error: "Street must be between 3 and 120 characters." };
  }
  return { cleaned };
};

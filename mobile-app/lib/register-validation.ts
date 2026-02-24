export const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
export const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
export const BIRTHDATE_PATTERN = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;

function normalizeOcrText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, " ");
}

export function isLikelySchoolId(ocrText: string) {
  const normalized = normalizeOcrText(ocrText);
  const keywords = ["PLVWORLD", "PAMANTASAN", "NG", "LUNGSOD", "VALENZUELA"];
  return keywords.some((word) => normalized.includes(word));
}

export function isValidName(name: string) {
  return NAME_PATTERN.test(name.trim());
}

export function isValidStudentNumber(value: string) {
  return STUDENT_NUMBER_PATTERN.test(value.trim());
}

export function isValidBirthdate(value: string) {
  return BIRTHDATE_PATTERN.test(value.trim());
}

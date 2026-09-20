export const STUDENT_ID_PATTERN = /^\d{2}-\d{4}$/;

export const AUTH_MESSAGES = {
  enterUsernameAndPassword: "Please enter your Student ID and password.",
  studentIdRequired: "Student ID is required.",
  passwordRequired: "Password is required.",
  invalidEmailOrPassword: "Invalid student ID or password.",
} as const;

export function normalizeStudentIdInput(value: string) {
  return value.trim();
}

export function isValidStudentId(value: string) {
  return STUDENT_ID_PATTERN.test(normalizeStudentIdInput(value));
}


/** Practical email check: local@domain.tld (rejects trailing "@" etc.). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function isStrongPassword(value: string) {
  return STRONG_PASSWORD_PATTERN.test(String(value || ""));
}

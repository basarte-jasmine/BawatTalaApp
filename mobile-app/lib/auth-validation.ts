export const STUDENT_ID_PATTERN = /^\d{2}-\d{4}$/;

export const AUTH_MESSAGES = {
  enterUsernameAndPassword: "Please enter your username and password.",
  studentIdRequired: "Student ID is required.",
  passwordRequired: "Password is required.",
  invalidEmailOrPassword: "Invalid email or password.",
} as const;

export function normalizeStudentIdInput(value: string) {
  return value.trim();
}

export function isValidStudentId(value: string) {
  return STUDENT_ID_PATTERN.test(normalizeStudentIdInput(value));
}

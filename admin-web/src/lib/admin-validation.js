export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function validateAdminLogin({ email, password }) {
  if (!email && !password) return "Please enter your email and password.";
  if (!email) return "Email is required.";
  if (!EMAIL_PATTERN.test(email.trim())) return "Please enter a valid email address.";
  if (!password) return "Password is required.";
  return "";
}

export function validateResetPassword({ newPassword, confirmPassword }) {
  if (!newPassword) return "New password is required";
  if (!confirmPassword) return "Confirm your password";
  if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
    return "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.";
  }
  if (newPassword !== confirmPassword) return "Passwords do not match";
  return "";
}

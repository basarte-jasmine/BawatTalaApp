import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import OtpBoxes from "../components/auth/OtpBoxes";
import {
  resendAdminResetCode,
  resetAdminPassword,
  sendAdminResetCode,
  verifyAdminResetCode,
} from "../lib/admin-api";
import { EMAIL_PATTERN, validateResetPassword } from "../lib/admin-validation";

const RESEND_SECONDS = 30;
const OTP_LENGTH = 8;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!resendCountdown) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  async function handleSendCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setPending(true);
      await sendAdminResetCode({ email: trimmedEmail });
      setMessage("Verification code sent.");
      setStep("otp");
      setResendCountdown(RESEND_SECONDS);
    } catch (requestError) {
      setError(requestError.message || "Failed to send code.");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the 8-digit verification code.");
      return;
    }

    try {
      setPending(true);
      await verifyAdminResetCode({ email: email.trim(), token: otp });
      setMessage("Code verified.");
      setStep("password");
    } catch (requestError) {
      setError(requestError.message || "The code has expired or is invalid. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleResendCode() {
    setError("");
    setMessage("");
    try {
      setPending(true);
      await resendAdminResetCode({ email: email.trim() });
      setMessage("Code resent successfully.");
      setResendCountdown(RESEND_SECONDS);
    } catch (requestError) {
      setError(requestError.message || "Failed to resend code.");
    } finally {
      setPending(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationMessage = validateResetPassword({ newPassword, confirmPassword });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setPending(true);
      await resetAdminPassword({
        email: email.trim(),
        newPassword,
        confirmPassword,
      });
      setMessage("Password updated successfully");
      setTimeout(() => navigate("/login"), 1000);
    } catch (requestError) {
      setError(requestError.message || "Failed to update password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={step === "password" ? "Reset Your Password" : "Forgot Password"}
      subtitle={
        step === "email"
          ? "Enter your admin email to receive a verification code."
          : step === "otp"
            ? "Enter the 8-digit recovery code sent to your email."
            : "Enter and confirm your new password."
      }
    >
      <form
        onSubmit={
          step === "email" ? handleSendCode : step === "otp" ? handleVerifyCode : handleResetPassword
        }
        className="space-y-5"
      >
        {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {step === "email" ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-admin-ink">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              className="h-11 w-full rounded-lg border border-admin-border px-3 text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
            />
          </div>
        ) : null}

        {step === "otp" ? (
          <div className="space-y-3">
            <OtpBoxes value={otp} onChange={setOtp} length={OTP_LENGTH} />
            <button
              type="button"
              onClick={handleResendCode}
              disabled={pending || resendCountdown > 0}
              className="w-full rounded-lg border border-admin-border py-2 text-sm font-semibold text-admin-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendCountdown > 0 ? `Resend Code in ${resendCountdown}s` : "Resend Code"}
            </button>
          </div>
        ) : null}

        {step === "password" ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-admin-ink">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-admin-border px-3 pr-11 text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-admin-muted hover:text-admin-ink"
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-admin-ink">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-admin-border px-3 pr-11 text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-admin-muted hover:text-admin-ink"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-admin-ink text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {step === "email"
            ? pending
              ? "Sending..."
              : "Send Reset Code"
            : step === "otp"
              ? pending
                ? "Verifying..."
                : "Verify Code"
              : pending
                ? "Updating..."
                : "Change Password"}
        </button>

        <Link to="/login" className="block text-center text-sm font-semibold text-admin-brand hover:underline">
          Back to Login Page
        </Link>
      </form>
    </AuthShell>
  );
}

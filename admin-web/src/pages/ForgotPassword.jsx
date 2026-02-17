import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email, reset, success
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    // Mock API call
    setSuccess("Check your email for reset instructions");
    setTimeout(() => setStep("reset"), 1500);
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSuccess("Password reset successfully!");
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-mint via-primary-turquoise to-primary-lime flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4 shadow-lg">
            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-mint to-primary-lime">
              BT
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {step === "email" ? "Reset Password" : "Create New Password"}
          </h1>
          <p className="text-white/80">
            {step === "email"
              ? "Enter your email to receive reset instructions"
              : "Enter and confirm your new password"}
          </p>
        </div>

        {/* Reset Form */}
        <form
          onSubmit={step === "email" ? handleEmailSubmit : handleResetSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6"
        >
          {error && (
            <div className="p-4 bg-secondary-rust/10 border border-secondary-rust rounded-lg text-secondary-rust text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {step === "email" ? (
            <>
              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 text-lg">
                    📧
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full pl-12 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-secondary-coffee to-secondary-rust text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Send Reset Link
              </button>
            </>
          ) : (
            <>
              {/* New Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 text-lg">
                    🔒
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-lg"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 text-lg">
                    🔒
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-lg"
                  >
                    {showConfirm ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-secondary-coffee to-secondary-rust text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Change Password
              </button>
            </>
          )}

          {/* Back to Login Link */}
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-primary-mint hover:text-primary-lime font-medium text-sm"
          >
            <span>←</span>
            Back to Login Page
          </Link>
        </form>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          BAWAT TALA Admin Dashboard © 2024
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import { adminLogin, fetchAdminSession, getAdminApiUrl } from "../lib/admin-api";
import { validateAdminLogin } from "../lib/admin-validation";

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowFormEntry, setAllowFormEntry] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const oauthStatus = searchParams.get("oauth");
    const oauthMessage = searchParams.get("message");

    if (oauthStatus === "success") {
      fetchAdminSession()
        .then((data) => {
          if (!data?.admin) {
            throw new Error("Admin session was not established.");
          }
          onLogin(data.admin);
          navigate("/dashboard", { replace: true });
        })
        .catch(() => {
          setError("Google sign-in could not be completed. Please try again.");
        });
      return;
    }

    if (oauthStatus === "error" && oauthMessage) {
      setError(oauthMessage);
    }
  }, [searchParams, onLogin, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validationMessage = validateAdminLogin({ email, password });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      await adminLogin({
        email: email.trim(),
        password,
      });

      const sessionData = await fetchAdminSession();
      if (!sessionData?.admin) {
        throw new Error("Login succeeded but the admin session could not be verified.");
      }
      onLogin(sessionData.admin);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Invalid email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);
    window.location.href = getAdminApiUrl("/api/admin/oauth/google/start?redirect=1");
  }

  return (
    <AuthShell title="Welcome!" subtitle="Please enter your details to login.">
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        <input type="text" name="username" autoComplete="username" className="hidden" tabIndex="-1" aria-hidden="true" />
        <input type="password" name="password" autoComplete="current-password" className="hidden" tabIndex="-1" aria-hidden="true" />
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div>
          <label className="mb-1 block text-sm font-semibold text-admin-ink">Email</label>
          <input
            type="email"
            name="bt-admin-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onFocus={() => setAllowFormEntry(true)}
            placeholder="admin@example.com"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            readOnly={!allowFormEntry}
            className="h-11 w-full rounded-lg border border-admin-border px-3 text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-admin-ink">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="bt-admin-passcode"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setAllowFormEntry(true)}
              autoComplete="new-password"
              readOnly={!allowFormEntry}
              placeholder="Password"
              className="h-11 w-full rounded-lg border border-admin-border px-3 pr-11 text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-admin-muted hover:text-admin-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-[#229365] hover:underline">
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-[#229365] text-sm font-bold text-white transition hover:bg-[#1b7b54] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-admin-border" />
          <span className="text-xs font-semibold uppercase tracking-widest text-admin-muted">OR</span>
          <div className="h-px flex-1 bg-admin-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="h-11 w-full rounded-lg border border-admin-border bg-white text-sm font-bold text-admin-ink transition hover:bg-admin-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </button>
      </form>
    </AuthShell>
  );
}

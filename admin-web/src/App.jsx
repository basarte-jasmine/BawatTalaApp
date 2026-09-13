import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { Clock } from "lucide-react";
import { adminLogout, fetchAdminSession, setAdminUnauthorizedHandler } from "./lib/admin-api";
import { AdminPreferencesProvider, useAdminPreferences } from "./lib/admin-preferences";
import { isHeadCounselor } from "./lib/admin-roles";
import AnalyticsReports from "./pages/AnalyticsReports";
import CalendarScheduling from "./pages/CalendarScheduling";
import ForgotPassword from "./pages/ForgotPassword";
import FlaggedEntries from "./pages/FlaggedEntries";
import Feedbacks from "./pages/Feedbacks";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import PeerCounselors from "./pages/PeerCounselors";
import RiskTriggers from "./pages/RiskTriggers";
import RoleAssignments from "./pages/RoleAssignments";
import Settings from "./pages/Settings";
import StudentDirectory from "./pages/StudentDirectory";
const ADMIN_SESSION_STORAGE_KEY = "bt_admin_session_snapshot";
function rememberAdminSession(nextSession) {
  if (!nextSession?.email) return;
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

function forgetAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}


function InactivityTimerWatcher({ session, onLogout }) {
  const { preferences } = useAdminPreferences();
  const idleTimeoutEnabled = Boolean(preferences?.privacy?.idleTimeoutEnabled);
  const idleTimeoutMinutes = Number(preferences?.privacy?.idleTimeoutMinutes || 30);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(null);
  const warningActiveRef = useRef(false);

  useEffect(() => {
    warningActiveRef.current = warningSecondsLeft !== null;
  }, [warningSecondsLeft]);

  useEffect(() => {
    if (!session || !idleTimeoutEnabled || typeof window === "undefined") {
      setWarningSecondsLeft(null);
      return undefined;
    }

    // Don't run idle timeout watcher if currently on login or forgot-password
    if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/forgot-password")) {
      setWarningSecondsLeft(null);
      return undefined;
    }

    const timeoutMs = idleTimeoutMinutes * 60 * 1000;
    const warningMs = Math.min(2 * 60 * 1000, Math.max(30 * 1000, timeoutMs * 0.2));
    const LAST_ACTIVITY_KEY = "bt_admin_last_activity_ts";

    const updateActivity = () => {
      if (warningActiveRef.current) return;
      try {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        setWarningSecondsLeft(null);
      } catch {}
    };

    try {
      const currentVal = window.localStorage.getItem(LAST_ACTIVITY_KEY);
      const currentNum = currentVal ? Number(currentVal) : 0;
      if (!currentNum || Number.isNaN(currentNum) || Date.now() - currentNum > timeoutMs) {
        // Reset to now on fresh session load so we don't instantly trigger a stale timeout
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
    } catch {}

    const events = ["mousedown", "keydown", "touchstart", "click"];
    let lastThrottledTime = Date.now();
    const handleUserActivity = () => {
      if (warningActiveRef.current) return;
      const now = Date.now();
      if (now - lastThrottledTime > 2000) {
        lastThrottledTime = now;
        updateActivity();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const handleStorageChange = (e) => {
      if (e.key === LAST_ACTIVITY_KEY) {
        const storedTs = Number(e.newValue || Date.now());
        const elapsed = Date.now() - storedTs;
        if (elapsed < timeoutMs - warningMs) {
          setWarningSecondsLeft(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const checkInactivity = async () => {
      try {
        const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
        const storedTs = raw ? Number(raw) : Date.now();
        if (Number.isNaN(storedTs) || storedTs <= 0) {
          window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
          return;
        }
        const elapsed = Date.now() - storedTs;
        if (elapsed >= timeoutMs) {
          setWarningSecondsLeft(null);
          try {
            window.localStorage.removeItem(LAST_ACTIVITY_KEY);
          } catch {}
          if (onLogout) {
            await onLogout();
          }
          if (!window.location.pathname.startsWith("/login")) {
            window.location.assign("/login?notice=idle-timeout");
          }
          return;
        }

        const remainingMs = timeoutMs - elapsed;
        if (remainingMs <= warningMs) {
          setWarningSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
        } else {
          setWarningSecondsLeft(null);
        }
      } catch {}
    };

    checkInactivity();
    const checkInterval = window.setInterval(checkInactivity, 1000);

    const handleVisibilityOrFocus = () => {
      checkInactivity();
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handleVisibilityOrFocus);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handleVisibilityOrFocus);
      window.clearInterval(checkInterval);
    };
  }, [session, idleTimeoutEnabled, idleTimeoutMinutes, onLogout]);

  if (warningSecondsLeft === null) {
    return null;
  }

  const minutes = Math.floor(warningSecondsLeft / 60);
  const seconds = warningSecondsLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes} minute${minutes === 1 ? "" : "s"}${seconds > 0 ? ` and ${seconds} second${seconds === 1 ? "" : "s"}` : ""}`
    : `${seconds} second${seconds === 1 ? "" : "s"}`;

  const handleStaySignedIn = () => {
    try {
      window.localStorage.setItem("bt_admin_last_activity_ts", String(Date.now()));
      setWarningSecondsLeft(null);
    } catch {}
  };

  const handleSignOutNow = async () => {
    setWarningSecondsLeft(null);
    try {
      window.localStorage.removeItem("bt_admin_last_activity_ts");
    } catch {}
    if (onLogout) {
      await onLogout();
    }
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login?notice=idle-timeout");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Session Expiration Warning</h3>
            <p className="text-xs font-medium text-slate-500">Inactivity Timeout Alert</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50/80 border border-amber-200/60 p-4 text-sm leading-relaxed text-amber-900">
          Your session will expire in <strong>{timeDisplay}</strong> due to inactivity. Would you like to stay signed in?
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSignOutNow}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Sign Out Now
          </button>
          <button
            type="button"
            onClick={handleStaySignedIn}
            className="rounded-xl bg-[#229365] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1b7b54]"
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function HeadRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!isHeadCounselor(session)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    setAdminUnauthorizedHandler(() => {
      setSession(null);
      forgetAdminSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    });
    return () => setAdminUnauthorizedHandler(null);
  }, []);
  useEffect(() => {
    let isMounted = true;
    async function loadSession() {
      try {
        const data = await fetchAdminSession();
        if (!isMounted) return;
        const nextSession = data?.admin || null;
        setSession(nextSession);
        if (nextSession) {
          rememberAdminSession(nextSession);
        } else {
          forgetAdminSession();
        }
      } catch (error) {
        if (!isMounted) return;
        setSession(null);
        forgetAdminSession();
      } finally {
        if (isMounted) {
          setSessionChecked(true);
        }
      }
    }
    void loadSession();
    return () => {
      isMounted = false;
    };
  }, []);
  const authActions = useMemo(
    () => ({
      login(nextSession) {
        setSession(nextSession);
        rememberAdminSession(nextSession);
      },
      async logout() {
        try {
          await adminLogout();
        } catch {
          // The local session should still be cleared if the logout request fails.
        }
        setSession(null);
        forgetAdminSession();
      },
    }),
    [],
  );
  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgba(14,90,58,0.1)] text-sm font-semibold text-admin-muted">
        Checking admin session...
      </div>
    );
  }
  return (
    <AdminPreferencesProvider session={session}>
      <InactivityTimerWatcher session={session} onLogout={authActions.logout} />
      <Router>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/dashboard" replace /> : <Login onLogin={authActions.login} />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session}>
              <Overview session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute session={session}>
              <CalendarScheduling session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/peer-counselors"
          element={
            <ProtectedRoute session={session}>
              <PeerCounselors session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flagged"
          element={
            <ProtectedRoute session={session}>
              <FlaggedEntries session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute session={session}>
              <StudentDirectory session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedbacks"
          element={
            <ProtectedRoute session={session}>
              <Feedbacks session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute session={session}>
              <AnalyticsReports session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <HeadRoute session={session}>
              <RoleAssignments session={session} onLogout={authActions.logout} />
            </HeadRoute>
          }
        />
        <Route
          path="/risk-triggers"
          element={
            <HeadRoute session={session}>
              <RiskTriggers session={session} onLogout={authActions.logout} />
            </HeadRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute session={session}>
              <Settings session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
      </Routes>
      </Router>
    </AdminPreferencesProvider>
  );
}

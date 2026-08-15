import { useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { adminLogout, fetchAdminSession } from "./lib/admin-api";
import { AdminPreferencesProvider } from "./lib/admin-preferences";
import AnalyticsReports from "./pages/AnalyticsReports";
import CalendarScheduling from "./pages/CalendarScheduling";
import ForgotPassword from "./pages/ForgotPassword";
import FlaggedEntries from "./pages/FlaggedEntries";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import PeerCounselors from "./pages/PeerCounselors";
import RiskTriggers from "./pages/RiskTriggers";
import RoleAssignments from "./pages/RoleAssignments";
import Settings from "./pages/Settings";
import StudentDirectory from "./pages/StudentDirectory";

const ADMIN_SESSION_STORAGE_KEY = "bt_admin_session_snapshot";

function readStoredAdminSession() {
  try {
    const stored = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function rememberAdminSession(nextSession) {
  if (!nextSession?.email) return;
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

function forgetAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState(() => readStoredAdminSession());
  const [sessionChecked, setSessionChecked] = useState(() => Boolean(readStoredAdminSession()));

  useEffect(() => {
    let isMounted = true;
    const storedSession = readStoredAdminSession();

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
        if (error?.status === 401 && storedSession) {
          setSession(storedSession);
        } else if (error?.status === 401) {
          setSession(null);
          forgetAdminSession();
        } else if (storedSession) {
          setSession(storedSession);
        }
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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6ef] text-sm font-semibold text-admin-muted">
        Checking admin session...
      </div>
    );
  }

  return (
    <AdminPreferencesProvider session={session}>
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
            <ProtectedRoute session={session}>
              <RoleAssignments session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/risk-triggers"
          element={
            <ProtectedRoute session={session}>
              <RiskTriggers session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
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

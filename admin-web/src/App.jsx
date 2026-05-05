import { useMemo, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
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

const SESSION_KEY = "bt_admin_session";

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState(readSession);

  const authActions = useMemo(
    () => ({
      login(nextSession) {
        setSession(nextSession);
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      },
      logout() {
        setSession(null);
        window.localStorage.removeItem(SESSION_KEY);
      },
    }),
    [],
  );

  return (
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
  );
}

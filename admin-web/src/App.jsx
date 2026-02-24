import { useMemo, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Appointments from "./pages/Appointments";
import Users from "./pages/Users";
import Journals from "./pages/Journals";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

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
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={authActions.login} />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session}>
              <Dashboard session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute session={session}>
              <Appointments session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute session={session}>
              <Users session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/journals"
          element={
            <ProtectedRoute session={session}>
              <Journals session={session} onLogout={authActions.logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute session={session}>
              <Reports session={session} onLogout={authActions.logout} />
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
        <Route
          path="/"
          element={<Navigate to={session ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}

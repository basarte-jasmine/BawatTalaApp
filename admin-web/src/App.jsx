import { useState } from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import FeatureToggles from "./pages/FeatureToggles";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Logs from "./pages/Logs";
import Overview from "./pages/Overview";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLogin={handleLogin} />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {isAuthenticated ? (
          <>
            <Route
              path="/dashboard"
              element={<Dashboard onLogout={handleLogout} />}
            />
            <Route path="/overview" element={<Overview />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/feature-toggles" element={<FeatureToggles />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </>
        ) : (
          <Route path="/" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </Router>
  );
}

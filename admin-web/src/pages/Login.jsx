import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    // Mock login - in real app, validate against backend
    onLogin();
    navigate("/dashboard");
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
          <h1 className="text-3xl font-bold text-white mb-2">Welcome!</h1>
          <p className="text-white/80">Please enter your details to login.</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6"
        >
          {/* Demo Credentials Info */}
          <div className="p-4 bg-primary-yellow/20 border border-primary-lime rounded-lg text-neutral-900 text-sm">
            <p className="font-medium mb-1">Demo Account</p>
            <p>
              Email:{" "}
              <code className="bg-white px-2 py-1 rounded">
                admin@example.com
              </code>
            </p>
            <p>
              Password: any password (e.g.,{" "}
              <code className="bg-white px-2 py-1 rounded">123456</code>)
            </p>
          </div>

          {error && (
            <div className="p-4 bg-secondary-rust/10 border border-secondary-rust rounded-lg text-secondary-rust text-sm">
              {error}
            </div>
          )}

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

          {/* Password Field */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-900">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 text-lg">
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-mint hover:text-primary-lime font-medium"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-secondary-coffee to-secondary-rust text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            Login
          </button>

          {/* Sign Up Link */}
          <p className="text-center text-neutral-600 text-sm">
            Don't have an account?{" "}
            <a
              href="#"
              className="text-primary-mint font-medium hover:text-primary-lime"
            >
              Sign up
            </a>
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          BAWAT TALA Admin Dashboard © 2024
        </p>
      </div>
    </div>
  );
}

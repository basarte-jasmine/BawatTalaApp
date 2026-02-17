import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { path: "/dashboard", label: "Overview", icon: "👁️" },
    { path: "/statistics", label: "Statistics", icon: "📊" },
    { path: "/logs", label: "Logs", icon: "📝" },
    { path: "/feature-toggles", label: "Feature Toggles", icon: "🔘" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-primary-mint to-primary-turquoise shadow-lg transition-all duration-300 ${isOpen ? "w-64" : "w-20"} flex flex-col z-50`}
    >
      {/* Header */}
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center justify-between">
          {isOpen && (
            <h1 className="text-xl font-bold text-neutral-900">BAWAT TALA</h1>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-lg"
          >
            {isOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                isActive(item.path)
                  ? "bg-white text-secondary-coffee shadow-md"
                  : "text-neutral-900 hover:bg-white/30"
              }`}
            >
              <span className="flex-shrink-0 text-xl">{item.icon}</span>
              {isOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-white/20">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 bg-secondary-rust text-white rounded-lg hover:bg-secondary-rust/90 font-medium transition-all"
        >
          <span className="flex-shrink-0 text-lg">🚪</span>
          {isOpen && <span>Log Out</span>}
        </button>
      </div>
    </div>
  );
}

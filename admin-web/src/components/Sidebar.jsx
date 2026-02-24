import { useLocation, useNavigate } from "react-router-dom";

const MENU_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/appointments", label: "Appointments", icon: "📅" },
  { path: "/users", label: "Users", icon: "👥" },
  { path: "/journals", label: "Journals", icon: "📘" },
  { path: "/reports", label: "Reports", icon: "📈" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({ onLogout, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-admin-border bg-admin-sidebar p-4 transition-transform duration-200 md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-8 flex items-center gap-3 rounded-xl border border-admin-border bg-white/80 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-brand/15 font-black text-admin-brand">
          BT
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-admin-muted">Bawat Tala</p>
          <p className="font-semibold text-admin-ink">Admin Panel</p>
        </div>
      </div>

      <nav className="space-y-2">
        {MENU_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                navigate(item.path);
                onClose?.();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                active ? "bg-admin-ink text-white" : "text-admin-ink hover:bg-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="absolute bottom-4 left-4 right-4 rounded-lg border border-admin-border bg-white py-2 text-sm font-semibold text-admin-ink hover:bg-admin-surface"
      >
        Log Out
      </button>
    </aside>
  );
}

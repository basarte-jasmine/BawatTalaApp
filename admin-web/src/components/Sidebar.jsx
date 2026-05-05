import {
  BarChart3,
  CalendarDays,
  Flag,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmActionModal from "./ConfirmActionModal";

const MAIN_MENU_ITEMS = [
  { path: "/dashboard", label: "Overview & Analytics", icon: LayoutGrid, active: true },
  { path: "/flagged", label: "Flagged Entries", icon: Flag, badge: "7" },
  { path: "/users", label: "Student Directory", icon: Users },
  { path: "/appointments", label: "Guidance Scheduling", icon: CalendarDays },
  { path: "/peer-counselors", label: "Peer Counselors", icon: Users },
  { path: "/reports", label: "Reports", icon: BarChart3 },
];

const SYSTEM_MENU_ITEMS = [
  { path: "/roles", label: "Role Assignments", icon: ShieldCheck },
  { path: "/risk-triggers", label: "Risk Triggers", icon: Flag },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onLogout, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[17.5rem] shrink-0 flex-col overflow-y-auto bg-[#134611] p-4 text-white transition-transform duration-200 lg:static lg:h-full lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white px-3 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4d8fef] font-black text-white">
            BT
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-admin-muted">Bawat Tala</p>
            <p className="font-semibold text-admin-ink">Admin Panel</p>
          </div>
        </div>

        <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ccf72]">
          Main Menu
        </div>
        <nav className="space-y-2">
          {MAIN_MENU_ITEMS.map((item) => {
            const isCurrent = item.path && location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.path) {
                    navigate(item.path);
                    onClose?.();
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-admin-accent text-white"
                    : "text-[#e4f7d2] hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mb-4 mt-8 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ccf72]">
          System Settings
        </div>
        <nav className="space-y-2">
          {SYSTEM_MENU_ITEMS.map((item) => {
            const isCurrent = item.path && location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.path) {
                    navigate(item.path);
                    onClose?.();
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                  isCurrent ? "bg-admin-accent text-white" : "text-[#e4f7d2] hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-white/10 p-4">
          <p className="font-semibold text-white">System Status</p>
          <p className="mt-2 text-sm text-[#b9ebb0]">All systems operational</p>
        </div>

        <button
          type="button"
          onClick={() => setIsLogoutConfirmOpen(true)}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-admin-ink hover:bg-admin-surface"
        >
          <LogOut className="h-4 w-4" />
          <span>Log Out</span>
        </button>
      </aside>

      <ConfirmActionModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          onClose?.();
          onLogout?.();
        }}
        title="Log Out"
        description="Are you sure you want to log out of the admin panel?"
        cancelLabel="Stay Logged In"
        confirmLabel="Log Out"
        confirmTone="rose"
      />
    </>
  );
}

import {
  BarChart3,
  CalendarDays,
  Flag,
  GraduationCap,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import adminLogo from "../assets/BT_Logo.png";
import { fetchAdminRiskFlags } from "../lib/admin-api";
import ConfirmActionModal from "./ConfirmActionModal";
import { isHeadCounselor } from "../lib/admin-roles";

const MAIN_MENU_ITEMS = [
  { path: "/dashboard", label: "Overview & Analytics", icon: LayoutGrid, active: true },
  { path: "/flagged", label: "Flagged Entries", icon: Flag, badgeKey: "criticalEntries" },
  { path: "/users", label: "Student Directory", icon: Users },
  { path: "/appointments", label: "Guidance Scheduling", icon: CalendarDays },
  { path: "/peer-counselors", label: "Peer Counselors", icon: GraduationCap },
  { path: "/feedbacks", label: "Help & Support", icon: MessageSquare },
  { path: "/reports", label: "Reports", icon: BarChart3 },
];

const SYSTEM_MENU_ITEMS = [
  { path: "/roles", label: "Role Assignments", icon: ShieldCheck },
  { path: "/risk-triggers", label: "Risk Triggers", icon: Flag },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onLogout, session, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [criticalEntriesCount, setCriticalEntriesCount] = useState(0);
  const head = isHeadCounselor(session);
  const visibleSystemItems = SYSTEM_MENU_ITEMS.filter((item) => head || !["/roles", "/risk-triggers"].includes(item.path));

  useEffect(() => {
    let isMounted = true;

    async function loadCriticalEntriesCount() {
      try {
        const data = await fetchAdminRiskFlags();
        const count = (Array.isArray(data?.entries) ? data.entries : []).filter((entry) =>
          ["HIGH", "CRITICAL"].includes(String(entry?.riskLevel || "").toUpperCase()),
        ).length;
        if (isMounted) {
          setCriticalEntriesCount(count);
        }
      } catch (_error) {
        if (isMounted) {
          setCriticalEntriesCount(0);
        }
      }
    }

    void loadCriticalEntriesCount();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[17.5rem] shrink-0 flex-col overflow-y-auto border-r border-[#b8e3d2] bg-white p-4 text-[#229365] transition-transform duration-200 lg:static lg:h-full lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex shrink-0 items-center gap-3 px-3 py-3">
          <img
            src={adminLogo}
            alt="Bawat Tala"
            className="h-12 w-12 object-contain"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#5f7a5f]">Bawat Tala</p>
            <p className="font-semibold text-admin-ink">Admin Panel</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 pr-1">
          <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7c8f]">
            Main Menu
          </div>
          <nav className="space-y-1.5">
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
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                    isCurrent
                      ? "bg-[#229365] text-white"
                      : "text-[#229365] hover:bg-[#229365]/10"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                {item.badgeKey === "criticalEntries" && criticalEntriesCount > 0 ? (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {criticalEntriesCount}
                  </span>
                ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mb-3 mt-6 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7c8f]">
            System Settings
          </div>
          <nav className="space-y-1.5">
            {visibleSystemItems.map((item) => {
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
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold ${
                    isCurrent ? "bg-[#229365] text-white" : "text-[#229365] hover:bg-[#229365]/10"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setIsLogoutConfirmOpen(true)}
          className="mt-3 flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#229365] py-3 text-sm font-semibold text-white hover:bg-[#1b7b54]"
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

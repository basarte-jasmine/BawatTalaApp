import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCheck,
  Flag,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminGlobalSearch,
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../lib/admin-api";
import Modal from "./Modal";

const NOTIFICATION_REFRESH_MS = 60000;
const EMPTY_GLOBAL_SEARCH_RESULTS = {
  students: [],
  entries: [],
  appointments: [],
  team: [],
  riskTriggers: [],
};

const GLOBAL_SEARCH_PAGES = [
  { path: "/dashboard", label: "Overview & Analytics", group: "Page", icon: LayoutGrid, keywords: ["dashboard", "overview", "analytics", "home", "summary", "demographics", "distribution", "themes", "risk trends"] },
  { path: "/flagged", label: "Flagged Entries", group: "Page", icon: Flag, keywords: ["flagged", "risk", "critical", "support", "review"] },
  { path: "/users", label: "Student Directory", group: "Page", icon: Users, keywords: ["students", "users", "directory", "profiles"] },
  { path: "/appointments", label: "Guidance Scheduling", group: "Page", icon: CalendarDays, keywords: ["appointments", "calendar", "schedule", "guidance", "sessions"] },
  { path: "/peer-counselors", label: "Peer Counselors", group: "Page", icon: Users, keywords: ["peer", "counselors", "advisers"] },
  { path: "/reports", label: "Reports", group: "Page", icon: BarChart3, keywords: ["reports", "export", "analytics"] },
  { path: "/roles", label: "Role Assignments", group: "System", icon: ShieldCheck, keywords: ["roles", "admins", "counselors", "permissions"] },
  { path: "/risk-triggers", label: "Risk Triggers", group: "System", icon: Flag, keywords: ["triggers", "risk words", "keywords", "phrases"] },
  { path: "/settings", label: "Settings", group: "System", icon: Settings, keywords: ["settings", "profile", "account", "preferences"] },
];

function getAdminProfile(session) {
  const email = String(session?.email || "").trim().toLowerCase();
  if (email === "basartejasmine@gmail.com") {
    return {
      initials: "JB",
      name: session?.name || "Jasmine Batumbakal",
      role: "Head Counselor",
      pictureUrl: session?.pictureUrl || "",
    };
  }

  const displayName = String(session?.name || "").trim();
  const localPart = email.split("@")[0] || "Counselor";
  const words = (displayName || localPart)
    .split(/[._-]+/)
    .flatMap((part) => part.split(/\s+/))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const name = displayName || words.join(" ") || "Counselor Account";
  const initials = words.slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase() || "CO";
  return {
    initials,
    name,
    role: "Counselor",
    pictureUrl: session?.pictureUrl || "",
  };
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const minutesAgo = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function NotificationEmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d7e2d0] bg-[#f9fcf7] px-4 py-6 text-center text-sm text-[#73836f]">
      {children}
    </div>
  );
}

function NotificationBellButton({ unreadCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-full p-2 transition-colors hover:bg-gray-100"
      aria-label="Open notifications"
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {unreadCount > 0 ? (
        <>
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-admin-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        </>
      ) : null}
    </button>
  );
}

function NotificationListItem({ item, onOpen }) {
  const isRead = Boolean(item?.isRead);

  return (
    <button
      type="button"
      onClick={() => void onOpen(item)}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
        isRead
          ? "border-[#edf2ea] bg-white hover:border-[#d6e2cf]"
          : "border-[#dce9d3] bg-[#f6fbf3] shadow-[inset_0_0_0_1px_rgba(111,174,70,0.08)] hover:border-[#bfd5b2]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isRead ? "bg-[#d0d9ca]" : "bg-[#6a994e]"}`} />
            <p className="truncate text-sm font-semibold text-admin-ink">{item.title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#516152]">{item.message}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#eef5e9] px-2.5 py-1 text-[11px] font-semibold text-[#63805f]">
          {formatNotificationTime(item.createdAt)}
        </span>
      </div>
    </button>
  );
}

function formatSearchDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getPageSearchResults(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (normalized.length < 2) return [];

  return GLOBAL_SEARCH_PAGES.filter((item) => {
    const haystack = [item.label, item.group, ...item.keywords].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

function GlobalSearchSection({ title, count, children }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function GlobalSearchEmpty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
      {children}
    </div>
  );
}

function GlobalSearchResultButton({ icon: Icon, title, meta, detail, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
    >
      {Icon ? (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-700">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
            {meta ? <span className="mt-1 block truncate text-xs text-slate-500">{meta}</span> : null}
          </span>
          {badge ? <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{badge}</span> : null}
        </span>
        {detail ? <span className="mt-2 line-clamp-2 block text-sm leading-5 text-slate-600">{detail}</span> : null}
      </span>
    </button>
  );
}

function useAdminNotifications(adminEmail) {
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!adminEmail) {
      setNotifications([]);
      return undefined;
    }

    let isMounted = true;
    async function loadNotifications() {
      try {
        setNotificationsLoading(true);
        const data = await fetchAdminNotifications(adminEmail);
        if (isMounted) {
          setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
        }
      } catch (_error) {
        if (isMounted) {
          setNotifications([]);
        }
      } finally {
        if (isMounted) {
          setNotificationsLoading(false);
        }
      }
    }

    void loadNotifications();
    const intervalId = setInterval(() => {
      void loadNotifications();
    }, NOTIFICATION_REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [adminEmail]);

  return {
    notifications,
    notificationsLoading,
    setNotifications,
  };
}

export default function Header({
  title = "Dashboard",
  subtitle = "",
  onMenuToggle,
  session,
}) {
  const navigate = useNavigate();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState(EMPTY_GLOBAL_SEARCH_RESULTS);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationPanelRef = useRef(null);
  const adminProfile = getAdminProfile(session);
  const adminEmail = String(session?.email || "").trim().toLowerCase();
  const { notifications, notificationsLoading, setNotifications } = useAdminNotifications(adminEmail);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );
  const pageSearchResults = useMemo(() => getPageSearchResults(globalSearchTerm), [globalSearchTerm]);
  const globalSearchResultCount = useMemo(
    () =>
      pageSearchResults.length +
      globalSearchResults.students.length +
      globalSearchResults.entries.length +
      globalSearchResults.appointments.length +
      globalSearchResults.team.length +
      globalSearchResults.riskTriggers.length,
    [globalSearchResults, pageSearchResults],
  );

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!notificationPanelRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!isSearchModalOpen) return undefined;
    const query = globalSearchTerm.trim();
    if (query.length < 2) {
      setGlobalSearchResults(EMPTY_GLOBAL_SEARCH_RESULTS);
      setGlobalSearchError("");
      setGlobalSearchLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setGlobalSearchLoading(true);
        const data = await fetchAdminGlobalSearch(query);
        setGlobalSearchResults({
          students: Array.isArray(data?.students) ? data.students : [],
          entries: Array.isArray(data?.entries) ? data.entries : [],
          appointments: Array.isArray(data?.appointments) ? data.appointments : [],
          team: Array.isArray(data?.team) ? data.team : [],
          riskTriggers: Array.isArray(data?.riskTriggers) ? data.riskTriggers : [],
        });
        setGlobalSearchError("");
      } catch (error) {
        setGlobalSearchError(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [globalSearchTerm, isSearchModalOpen]);

  function openDirectorySearch(searchValue) {
    const query = String(searchValue || "").trim();
    setIsSearchModalOpen(false);
    navigate(query ? `/users?search=${encodeURIComponent(query)}` : "/users");
  }

  function openSearchPath(path) {
    setIsSearchModalOpen(false);
    navigate(path);
  }

  function handleHeaderSearchChange(event) {
    setGlobalSearchTerm(event.target.value);
    setIsSearchModalOpen(true);
  }

  async function handleOpenNotification(item) {
    if (!item?.id || item.isRead || !adminEmail) {
      return;
    }

    try {
      await markAdminNotificationRead(item.id, adminEmail);
      setNotifications((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
      );
    } catch (_error) {}
  }

  async function handleMarkAllNotificationsRead() {
    if (!adminEmail || unreadCount === 0) {
      return;
    }

    try {
      await markAllAdminNotificationsRead(adminEmail);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (_error) {}
  }

  return (
    <>
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onMenuToggle}
              className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-sm font-bold text-admin-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm text-admin-muted">Admin Panel</p>
              <h2 className="font-display text-3xl text-admin-ink">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-admin-muted">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex h-12 min-w-0 items-center md:w-[34rem]">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 transition-colors group-hover:text-emerald-600" />
              <input
                type="text"
                value={globalSearchTerm}
                onFocus={() => setIsSearchModalOpen(true)}
                onClick={() => setIsSearchModalOpen(true)}
                onChange={handleHeaderSearchChange}
                placeholder="Search students, entries, or settings..."
                className="w-full rounded-lg border border-gray-200 bg-[#FAFAF9] py-2 pl-10 pr-4 text-sm text-admin-ink transition-all hover:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="flex items-center gap-6 self-end md:self-auto">
              <div className="relative" ref={notificationPanelRef}>
                <NotificationBellButton unreadCount={unreadCount} onClick={() => setIsNotificationsOpen((current) => !current)} />

                {isNotificationsOpen ? (
                  <div className="absolute right-0 z-20 mt-3 w-[22rem] overflow-hidden rounded-3xl border border-[#dbe5d4] bg-white shadow-[0_22px_55px_rgba(32,49,38,0.16)]">
                    <div className="border-b border-[#e7eee2] bg-[linear-gradient(135deg,#f7fbf3_0%,#eef6ea_100%)] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6d816d]">Notifications</p>
                          <h3 className="mt-1 text-base font-semibold text-admin-ink">
                            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleMarkAllNotificationsRead()}
                          className="inline-flex items-center gap-2 rounded-full border border-[#d3dfcb] bg-white px-3 py-1.5 text-xs font-semibold text-[#39563f] transition hover:border-[#b8cbaf] hover:bg-[#f8fbf6]"
                          disabled={unreadCount === 0}
                        >
                          <CheckCheck className="h-4 w-4" />
                          Mark all read
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[24rem] overflow-y-auto px-3 py-3">
                      {notificationsLoading ? (
                        <NotificationEmptyState>Loading notifications...</NotificationEmptyState>
                      ) : notifications.length ? (
                        <div className="space-y-2">
                          {notifications.map((item) => (
                            <NotificationListItem key={item.id} item={item} onOpen={handleOpenNotification} />
                          ))}
                        </div>
                      ) : (
                        <NotificationEmptyState>No notifications yet.</NotificationEmptyState>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{adminProfile.name}</div>
                  <div className="text-xs font-medium text-emerald-700">{adminProfile.role}</div>
                </div>
                {adminProfile.pictureUrl ? (
                  <img
                    src={adminProfile.pictureUrl}
                    alt={adminProfile.name}
                    className="h-10 w-10 rounded-full border border-gray-200 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-[linear-gradient(135deg,#96E072,#3DA35D)] text-sm font-bold text-white shadow-sm">
                    {adminProfile.initials}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title="Global Search" maxWidth="max-w-6xl">
        <div className="space-y-5">
          <div className="sticky top-0 z-10 -mx-6 -mt-6 border-b border-slate-100 bg-white px-6 pb-4 pt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={globalSearchTerm}
                onChange={(event) => setGlobalSearchTerm(event.target.value)}
                placeholder="Search pages, students, journal entries, appointments, team members, and risk triggers..."
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>Global search scans admin pages and live records across the admin panel.</span>
              {globalSearchTerm.trim().length >= 2 ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  {globalSearchLoading ? "Searching..." : `${globalSearchResultCount} result${globalSearchResultCount === 1 ? "" : "s"}`}
                </span>
              ) : null}
            </div>
          </div>

          {globalSearchError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{globalSearchError}</div> : null}

          {globalSearchTerm.trim().length < 2 ? (
            <div className="grid gap-4 py-4 md:grid-cols-3">
              <GlobalSearchEmpty>Search navigation, student profiles, journal summaries, appointment records, counselor accounts, and risk trigger words.</GlobalSearchEmpty>
              <GlobalSearchEmpty>Try names, student numbers, course names, concerns, appointment status, counselor names, or system page names.</GlobalSearchEmpty>
              <GlobalSearchEmpty>Results open the matching admin area so you can continue the workflow.</GlobalSearchEmpty>
            </div>
          ) : globalSearchLoading ? (
            <div className="grid gap-4 py-4 md:grid-cols-3">
              <GlobalSearchEmpty>Searching admin pages...</GlobalSearchEmpty>
              <GlobalSearchEmpty>Searching student and journal records...</GlobalSearchEmpty>
              <GlobalSearchEmpty>Searching appointments, team, and risk triggers...</GlobalSearchEmpty>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.9fr,1.1fr]">
              <div className="space-y-5">
                <GlobalSearchSection title="Pages & Tools" count={pageSearchResults.length}>
                  {pageSearchResults.length ? (
                    pageSearchResults.map((item) => (
                      <GlobalSearchResultButton
                        key={item.path}
                        icon={item.icon}
                        title={item.label}
                        meta={item.group}
                        detail={`Open ${item.label}`}
                        onClick={() => openSearchPath(item.path)}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No pages matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>

                <GlobalSearchSection title="Students" count={globalSearchResults.students.length}>
                  {globalSearchResults.students.length ? (
                    globalSearchResults.students.map((student) => (
                      <GlobalSearchResultButton
                        key={student.studentNumber}
                        icon={Users}
                        title={student.fullName}
                        meta={`${student.studentNumber} - ${student.program || "Unspecified"}`}
                        detail={[student.email, student.barangay, student.city].filter(Boolean).join(" - ")}
                        badge={student.status}
                        onClick={() => openDirectorySearch(student.studentNumber)}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No students matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>

                <GlobalSearchSection title="Team" count={globalSearchResults.team.length}>
                  {globalSearchResults.team.length ? (
                    globalSearchResults.team.map((member) => (
                      <GlobalSearchResultButton
                        key={`${member.kind}-${member.id}`}
                        icon={ShieldCheck}
                        title={member.fullName}
                        meta={`${member.kind} - ${member.role}`}
                        detail={[member.email, member.studentNumber, member.program].filter(Boolean).join(" - ")}
                        badge={member.status}
                        onClick={() => openSearchPath(member.kind === "Peer Counselor" ? "/peer-counselors" : "/roles")}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No team members matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>
              </div>

              <div className="space-y-5">
                <GlobalSearchSection title="Journal Entries" count={globalSearchResults.entries.length}>
                  {globalSearchResults.entries.length ? (
                    globalSearchResults.entries.map((entry) => (
                      <GlobalSearchResultButton
                        key={entry.id}
                        icon={Flag}
                        title={entry.title || entry.primaryConcern || "Journal entry"}
                        meta={`${entry.fullName || entry.studentNumber} - ${formatSearchDate(entry.entryDate)}`}
                        detail={entry.summary || entry.primaryConcern || "Open this student's directory record."}
                        badge={entry.riskLevel && entry.riskLevel !== "NONE" ? entry.riskLevel : undefined}
                        onClick={() => openDirectorySearch(entry.studentNumber)}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No journal entries matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>

                <GlobalSearchSection title="Appointments" count={globalSearchResults.appointments.length}>
                  {globalSearchResults.appointments.length ? (
                    globalSearchResults.appointments.map((appointment) => (
                      <GlobalSearchResultButton
                        key={appointment.id}
                        icon={CalendarDays}
                        title={`${appointment.studentName} - ${appointment.concern || "Appointment"}`}
                        meta={`${formatSearchDate(appointment.appointmentDate)} ${appointment.slotTime || ""} - ${appointment.supportType || "GUIDANCE"}`}
                        detail={[appointment.program, appointment.counselorName, appointment.counselingType, appointment.studentNote].filter(Boolean).join(" - ")}
                        badge={appointment.status}
                        onClick={() => openSearchPath(String(appointment.supportType || "").toUpperCase() === "PEER" ? "/peer-counselors" : "/appointments")}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No appointments matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>

                <GlobalSearchSection title="Risk Triggers" count={globalSearchResults.riskTriggers.length}>
                  {globalSearchResults.riskTriggers.length ? (
                    globalSearchResults.riskTriggers.map((trigger) => (
                      <GlobalSearchResultButton
                        key={trigger.id}
                        icon={Flag}
                        title={trigger.phrase}
                        meta={trigger.riskLabel || trigger.riskLevel}
                        badge={trigger.isEnabled ? "Enabled" : "Disabled"}
                        onClick={() => openSearchPath("/risk-triggers")}
                      />
                    ))
                  ) : (
                    <GlobalSearchEmpty>No risk triggers matched.</GlobalSearchEmpty>
                  )}
                </GlobalSearchSection>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

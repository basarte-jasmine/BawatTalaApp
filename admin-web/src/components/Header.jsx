import { Bell, CheckCheck, Menu, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../lib/admin-api";
import Modal from "./Modal";

const NOTIFICATION_REFRESH_MS = 60000;

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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationPanelRef = useRef(null);
  const adminProfile = getAdminProfile(session);
  const adminEmail = String(session?.email || "").trim().toLowerCase();
  const { notifications, notificationsLoading, setNotifications } = useAdminNotifications(adminEmail);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
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
      <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
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
              <p className="text-sm text-admin-muted">Overview</p>
              <h2 className="font-display text-3xl text-admin-ink">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-admin-muted">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex h-12 min-w-0 items-center md:w-[34rem]">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 transition-colors group-hover:text-emerald-600" />
              <input
                type="text"
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                placeholder="Search students, entries, or settings..."
                className="w-full cursor-text rounded-lg border border-gray-200 bg-[#FAFAF9] py-2 pl-10 pr-4 text-sm text-admin-ink transition-all hover:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
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

      <Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title="Global Search">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Type to search anything..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="py-8 text-center text-sm text-gray-500">
            Start typing to see students, recent entries, and appointments.
          </div>
        </div>
      </Modal>
    </>
  );
}

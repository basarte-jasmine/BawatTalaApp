import type { AppNotification } from "./backend-api";

type NotificationLike = Pick<AppNotification, "kind"> | { kind?: string | null };

const ADMIN_MESSAGE_KIND = "ADMIN_MESSAGE";

function normalizeNotificationKind(kind: string | null | undefined) {
  return String(kind ?? "").trim().toUpperCase();
}

export function isAdminMessageNotification(item: NotificationLike) {
  return normalizeNotificationKind(item.kind) === ADMIN_MESSAGE_KIND;
}

export function getNotificationVisual(kind: string) {
  const normalized = String(kind || "").toLowerCase();

  if (normalized.includes("admin_message") || normalized.includes("message")) {
    return {
      accent: "#4F7D63",
      chip: "#E6F4EA",
      icon: "mail-open-outline" as const,
      label: "Admin message",
      surface: "#F7FCF8",
    };
  }

  if (normalized.includes("future_self") || normalized.includes("future-self") || normalized.includes("letter")) {
    return {
      accent: "#3B7A8C",
      chip: "#E1F3F8",
      icon: "mail-outline" as const,
      label: "Future Me",
      surface: "#F4FAFC",
    };
  }

  if (normalized.includes("referral") || normalized.includes("reward")) {
    return {
      accent: "#5A8A36",
      chip: "#EAF7DD",
      icon: "star-outline" as const,
      label: "Congratulations",
      surface: "#F6FFF0",
      usesTalaLogo: true,
    };
  }

  if (normalized.includes("appointment") || normalized.includes("schedule")) {
    return {
      accent: "#6FCB43",
      chip: "#E9F8DD",
      icon: "calendar-clear-outline" as const,
      label: "Appointment",
      surface: "#F6FFF0",
    };
  }

  if (normalized.includes("journal") || normalized.includes("entry")) {
    return {
      accent: "#6D95C8",
      chip: "#E9F1FD",
      icon: "book-outline" as const,
      label: "Journal",
      surface: "#F7FBFF",
    };
  }

  if (normalized.includes("flag") || normalized.includes("safety")) {
    return {
      accent: "#F19137",
      chip: "#FFF1E1",
      icon: "warning-outline" as const,
      label: "Safety",
      surface: "#FFF9F3",
    };
  }

  return {
    accent: "#7D89D8",
    chip: "#F0EEFF",
    icon: "notifications-outline" as const,
    label: "Update",
    surface: "#FBFAFF",
  };
}

export function getNotificationDetailTitle(kind?: string) {
  return normalizeNotificationKind(kind) === ADMIN_MESSAGE_KIND ? "Message" : "Notification";
}

export function getNotificationFallbackRoute(kind?: string) {
  return normalizeNotificationKind(kind) === ADMIN_MESSAGE_KIND ? "/messages" : "/notifications";
}

function getStringMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function getAppointmentNoticeStatus(item: AppNotification) {
  const metadata = item.metadata || {};
  const haystack = [
    getStringMetadataValue(metadata, "status"),
    getStringMetadataValue(metadata, "appointmentStatus"),
    getStringMetadataValue(metadata, "newStatus"),
    item.kind,
    item.title,
    item.message,
  ]
    .join(" ")
    .toUpperCase();

  if (haystack.includes("RESCHED")) return "RESCHEDULED";
  if (haystack.includes("DISAPPROV") || haystack.includes("DECLIN") || haystack.includes("REJECT")) return "DISAPPROVED";
  if (haystack.includes("CONFIRM") || haystack.includes("APPROV")) return "CONFIRMED";
  return "";
}

function hrefFromRoute(route: string): string | { pathname: string; params: Record<string, string> } {
  const trimmed = route.trim();
  if (!trimmed) return "";
  const [path, query = ""] = trimmed.split("?");
  if (!query) return trimmed;
  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [key, value = ""] = part.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return { pathname: path, params };
}

export function getNotificationRoute(item: AppNotification): string | { pathname: string; params: Record<string, string> } | "" {
  const metadata = item.metadata || {};
  const kind = String(item.kind || "").toUpperCase();
  const route = (typeof item.route === "string" ? item.route.trim() : "") || getStringMetadataValue(metadata, "route");
  const appointmentId = getStringMetadataValue(metadata, "appointmentId");
  const entryId = getStringMetadataValue(metadata, "entryId");
  const supportType = getStringMetadataValue(metadata, "supportType").toUpperCase();
  const isFutureMe =
    kind.startsWith("FUTURE_SELF") ||
    kind.includes("FUTURE") ||
    route === "/home" ||
    route.includes("future");

  const routeKey = route.toLowerCase();
  if (routeKey === "schedule" || routeKey.includes("section=schedule") || routeKey.includes("/profile-settings")) {
    return { pathname: "/profile-settings", params: { section: "schedule" } };
  }
  if (routeKey === "home" || routeKey === "/home") {
    return "/home";
  }
  if (appointmentId || kind.includes("APPOINTMENT")) {
    const status = getAppointmentNoticeStatus(item);
    if (status === "CONFIRMED" || status === "RESCHEDULED") {
      return { pathname: "/profile-settings", params: { section: "schedule" } };
    }
    if (status === "DISAPPROVED") {
      return "";
    }
  }
  if (isFutureMe) {
    return "/home";
  }
  if (entryId || route === "/journal-entry-view") {
    return entryId ? { pathname: "/journal-entry-view", params: { entryId } } : "/journal-entries";
  }
  if (route === "/journal" || kind.includes("JOURNAL") || kind.includes("ENTRY")) {
    return "/journal-entries";
  }
  if (route === "/messages" || kind.includes("ADMIN_MESSAGE")) {
    return "";
  }
  if (route === "/consult") {
    return supportType === "PEER"
      ? { pathname: "/consult", params: { track: "peer", skipIntro: "1" } }
      : { pathname: "/consult", params: { track: "professional", skipIntro: "1" } };
  }
  if (route && route !== "/notifications") {
    return hrefFromRoute(route);
  }
  return "";
}

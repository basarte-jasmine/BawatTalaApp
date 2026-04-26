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

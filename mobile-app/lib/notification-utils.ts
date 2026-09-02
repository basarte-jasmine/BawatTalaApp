import type { AppNotification } from "./backend-api";

type NotificationLike = Pick<AppNotification, "kind"> | { kind?: string | null };
type AdminMessageItem = Pick<AppNotification, "id" | "kind" | "message" | "metadata" | "title">;

const ADMIN_MESSAGE_KIND = "ADMIN_MESSAGE";
const GENERIC_STAFF_NAMES = new Set(["guidance staff", "guidance", "staff", "admin", "administrator", "counselor"]);

function normalizeNotificationKind(kind: string | null | undefined) {
  return String(kind ?? "").trim().toUpperCase();
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstMetadataString(metadata: Record<string, unknown> | undefined, keys: string[]): string {
  if (!metadata) return "";
  for (const key of keys) {
    const value = asTrimmedString(metadata[key]);
    if (value) return value;
  }
  return "";
}

function isGenericStaffName(name: string) {
  return !name.trim() || GENERIC_STAFF_NAMES.has(name.trim().toLowerCase());
}

export function isAdminMessageNotification(item: NotificationLike) {
  return normalizeNotificationKind(item.kind) === ADMIN_MESSAGE_KIND;
}

export function getAdminMessageActor(item: AdminMessageItem) {
  const metadata = item.metadata || {};
  const fromRecord = asRecord(metadata.from);
  const senderRecord = asRecord(metadata.sender);
  const counselorId =
    firstMetadataString(metadata, ["counselorId", "actorId", "adminId", "userId"]) ||
    (metadata.thread === true || String(metadata.thread || "").toLowerCase() === "true" ? asTrimmedString(item.id) : "");
  const email =
    firstMetadataString(metadata, ["actorEmail", "email", "counselorEmail"]) ||
    asTrimmedString(fromRecord?.email) ||
    asTrimmedString(senderRecord?.email);
  const named =
    firstMetadataString(metadata, ["counselorName", "actorName", "full_name", "fullName", "name", "displayName"]) ||
    asTrimmedString(fromRecord?.name) ||
    asTrimmedString(fromRecord?.full_name) ||
    asTrimmedString(fromRecord?.fullName) ||
    asTrimmedString(senderRecord?.name) ||
    asTrimmedString(item.title);
  const name = isGenericStaffName(named) ? "" : named;
  const role =
    firstMetadataString(metadata, ["actorRole", "role", "counselorRole"]) ||
    asTrimmedString(fromRecord?.role) ||
    asTrimmedString(senderRecord?.role);
  const photoUrl =
    firstMetadataString(metadata, ["pictureUrl", "photoUrl", "avatarUrl", "photo", "profilePicture", "imageUrl"]) ||
    asTrimmedString(fromRecord?.pictureUrl) ||
    asTrimmedString(fromRecord?.photoUrl) ||
    asTrimmedString(senderRecord?.pictureUrl);
  return { counselorId, email, name, photoUrl, role };
}

export function getAdminMessageThreadKey(item: AdminMessageItem) {
  const actor = getAdminMessageActor(item);
  if (actor.counselorId) return `id:${actor.counselorId.toLowerCase()}`;
  if (actor.email) return `email:${actor.email.toLowerCase()}`;
  if (actor.name) return `name:${actor.name.toLowerCase()}`;
  const title = asTrimmedString(item.title);
  if (title && !isGenericStaffName(title)) return `title:${title.toLowerCase()}`;
  return "staff";
}

export function getAdminMessageDisplayName(item: AdminMessageItem) {
  const actor = getAdminMessageActor(item);
  if (actor.name) return actor.name;
  const title = asTrimmedString(item.title);
  if (title && !isGenericStaffName(title)) return title;
  return "Guidance staff";
}

export function getAdminMessagePhotoUrl(item: AdminMessageItem) {
  return getAdminMessageActor(item).photoUrl;
}

export function getAdminMessageInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "GS";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "";
  return (first + last).toUpperCase() || "GS";
}

export function getNotificationDateTimeLabel(item: Pick<AppNotification, "createdAt" | "timeLabel">) {
  const raw = String(item.createdAt || "").trim();
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      try {
        return new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(date);
      } catch {
        // Fall through to the API time label.
      }
    }
  }
  return String(item.timeLabel || "").trim();
}

export type AdminMessageThread = {
  actorRole: string;
  counselorId: string;
  displayName: string;
  key: string;
  latest: AppNotification;
  messages: AppNotification[];
  photoUrl: string;
  unreadCount: number;
};

function nestedAdminMessages(item: AppNotification): AppNotification[] {
  const metadata = item.metadata || {};
  const nested = metadata.messages ?? metadata.threadMessages ?? metadata.items;
  if (!Array.isArray(nested) || !nested.length) return [item];
  const expanded: AppNotification[] = [];
  nested.forEach((raw, index) => {
    const record = asRecord(raw);
    if (!record) return;
    const body = asTrimmedString(record.body) || asTrimmedString(record.message) || asTrimmedString(record.text);
    if (!body) return;
    const childMeta: Record<string, unknown> = {
      ...metadata,
      ...(asRecord(record.metadata) || {}),
      counselorId: firstMetadataString(asRecord(record.metadata) || {}, ["counselorId"]) || metadata.counselorId,
      actorEmail: firstMetadataString(asRecord(record.metadata) || {}, ["actorEmail"]) || metadata.actorEmail,
      actorName:
        firstMetadataString(asRecord(record.metadata) || {}, ["actorName", "counselorName", "full_name", "fullName"]) ||
        asTrimmedString(asRecord(record.from)?.name) ||
        metadata.actorName ||
        metadata.counselorName,
      from: record.from ?? metadata.from,
    };
    expanded.push({
      createdAt: asTrimmedString(record.createdAt) || item.createdAt,
      id: asTrimmedString(record.id) || `${item.id}:${index}`,
      isRead: typeof record.isRead === "boolean" ? record.isRead : item.isRead,
      kind: asTrimmedString(record.kind) || item.kind || ADMIN_MESSAGE_KIND,
      message: body,
      metadata: childMeta,
      route: item.route,
      timeLabel: asTrimmedString(record.timeLabel) || item.timeLabel,
      title: asTrimmedString(record.title) || asTrimmedString(childMeta.counselorName) || item.title,
    });
  });
  return expanded.length ? expanded : [item];
}

function unreadCountForMessages(messages: AppNotification[], latest: AppNotification) {
  const metadata = latest.metadata || {};
  const explicit = Number(metadata.unreadCount ?? metadata.unread);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const unreadMessages = messages.filter((entry) => !entry.isRead).length;
  if (unreadMessages) return unreadMessages;
  if (!latest.isRead) {
    const count = Number(metadata.messageCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }
  return 0;
}

export function groupAdminMessageThreads(items: AppNotification[]): AdminMessageThread[] {
  const expanded = items.flatMap((item) => (isAdminMessageNotification(item) ? nestedAdminMessages(item) : []));
  const grouped = new Map<string, AppNotification[]>();
  for (const item of expanded) {
    const key = getAdminMessageThreadKey(item);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }

  const staffBucket = grouped.get("staff");
  if (staffBucket && staffBucket.length > 1) {
    grouped.delete("staff");
    for (const item of staffBucket) {
      const actor = getAdminMessageActor(item);
      const splitKey = actor.email
        ? `email:${actor.email.toLowerCase()}`
        : actor.name
          ? `name:${actor.name.toLowerCase()}`
          : asTrimmedString(item.title) && !isGenericStaffName(item.title)
            ? `title:${item.title.trim().toLowerCase()}`
            : "staff";
      const bucket = grouped.get(splitKey);
      if (bucket) bucket.push(item);
      else grouped.set(splitKey, [item]);
    }
  }

  const threads: AdminMessageThread[] = [];
  for (const [key, messages] of grouped) {
    const chronological = [...messages].sort((a, b) => {
      const aTime = Date.parse(a.createdAt) || 0;
      const bTime = Date.parse(b.createdAt) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id).localeCompare(String(b.id));
    });
    const latest = chronological[chronological.length - 1];
    const named = chronological.map((entry) => getAdminMessageDisplayName(entry)).find((name) => !isGenericStaffName(name));
    const actor = getAdminMessageActor(latest);
    const photoUrl = chronological.map((entry) => getAdminMessagePhotoUrl(entry)).find(Boolean) || "";
    threads.push({
      actorRole: actor.role,
      counselorId: actor.counselorId,
      displayName: named || getAdminMessageDisplayName(latest),
      key,
      latest,
      messages: chronological,
      photoUrl,
      unreadCount: unreadCountForMessages(chronological, latest),
    });
  }

  threads.sort((a, b) => {
    const aTime = Date.parse(a.latest.createdAt) || 0;
    const bTime = Date.parse(b.latest.createdAt) || 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.key.localeCompare(b.key);
  });
  return threads;
}

export function getNotificationDateSeparator(item: Pick<AppNotification, "createdAt">) {
  const raw = String(item.createdAt || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function getNotificationTimeOnlyLabel(item: Pick<AppNotification, "createdAt" | "timeLabel">) {
  const raw = String(item.createdAt || "").trim();
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      try {
        return new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
        }).format(date);
      } catch {
        // Fall through to the full label.
      }
    }
  }
  return getNotificationDateTimeLabel(item);
}

export function isOutgoingAdminMessage(item: AppNotification) {
  const metadata = item.metadata || {};
  const fromValue = metadata.from;
  const fromText =
    asTrimmedString(fromValue) ||
    asTrimmedString(asRecord(fromValue)?.role) ||
    asTrimmedString(asRecord(fromValue)?.type) ||
    firstMetadataString(metadata, ["direction", "senderRole"]);
  const normalized = fromText.toLowerCase();
  return normalized === "student" || normalized === "self" || normalized === "outgoing" || normalized === "me";
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

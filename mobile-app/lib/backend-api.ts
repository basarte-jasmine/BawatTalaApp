import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type AuthUser = {
  email: string;
  firstName: string;
  fullName: string;
  studentNumber: string;
};

export type StudentProfile = {
  barangay: string;
  birthdate: string;
  city: string;
  email: string;
  fullName: string;
  program: string;
  province: string;
  region: string;
  street: string;
  studentNumber: string;
};

export type StudentPreferences = {
  hasJournalLockPin: boolean;
  journalLockAutoLock: boolean;
  journalLockEnabled: boolean;
  notificationPreviewsEnabled: boolean;
  privateJournalModeEnabled: boolean;
};

export type StudentReferral = {
  hasRedeemed: boolean;
  referralCode: string;
  redeemRewardTala: number;
  redeemedAt?: string | null;
  referredByCode?: string | null;
  shareRewardTala: number;
};

export type JournalMessage = {
  createdAt: string;
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type JournalEntry = {
  adminFlagReason: string | null;
  aiEnabled: boolean;
  concernTags: string[];
  contentText?: string;
  createdAt: string;
  entryDate: string;
  finishedAt: string | null;
  id: string;
  insights: string[];
  isFinished: boolean;
  primaryConcern?: string | null;
  preview?: string;
  riskLevel: "HIGH" | "LOW" | "NONE";
  dominantEmotion?: string | null;
  sentimentConfidence?: number | null;
  sentimentLabel?: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED" | null;
  sentimentScore?: number | null;
  summary: string;
  summaryFeedbackReason?: string | null;
  summaryRatedAt?: string | null;
  summaryRating?: "HELPFUL" | "NEEDS_WORK" | null;
  supportPromptShownAt?: string | null;
  supportResponse?: "CONTACTED" | "DECLINED" | null;
  supportResponseAt?: string | null;
  title: string;
  updatedAt: string;
};

export type CounselorAppointment = {
  appointmentDate: string;
  appointmentDateLabel: string;
  concern: string;
  counselor: {
    fullName: string;
    gender: string;
    pictureUrl: string;
    program?: string;
    role: string;
    studentNumber?: string;
    supportType?: "GUIDANCE" | "PEER";
  };
  createdAt?: string;
  decisionDueAt?: string | null;
  id: string;
  slotLabel: string;
  slotTime: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  studentNote?: string;
  supportType?: "GUIDANCE" | "PEER";
};

export type MoodSource = "INPUT" | "JOURNAL";

export type MoodEntryRecord = {
  createdAt?: string;
  id?: string;
  moodDate: string;
  moodId: string;
  moodLabel: string;
  moodSource?: MoodSource;
};

export type LibraryBookProgress = {
  bookId: string;
  currentPage: number;
  finishedAt?: string | null;
  lastOpenedAt?: string | null;
  percent: number;
  rating?: number | null;
  status: "STARTED" | "FINISHED";
  totalPages: number;
  updatedAt?: string | null;
};

export type LibraryBookRecord = {
  accessLabel?: string;
  accessType?: "full" | "borrow" | "waitlist" | "preview" | "online" | "catalog";
  accentColor: string;
  actionLabel?: string;
  author: string;
  blurb: string;
  bundledEpubAsset?: number;
  category: string;
  coverImageUrl: string;
  downloadableEpub?: boolean;
  downloadablePdf?: boolean;
  downloaded?: boolean;
  downloadedAt?: string | null;
  downloadUrl?: string;
  estimatedMinutes: number;
  externalReaderLink?: string;
  id: string;
  infoLink?: string;
  isFreeEbook?: boolean;
  language?: string;
  localEpubUri?: string;
  pageCount?: number;
  previewLink?: string;
  provider?: string;
  progress?: LibraryBookProgress | null;
  publishedDate?: string;
  publisher?: string;
  readerLink?: string;
  rewardLabel: string;
  shelfLabel: string;
  sourceId?: string;
  sourceReaderLink?: string;
  statusLabel?: string;
  supportsInAppReader?: boolean;
  title: string;
};

export type ReadingAchievementReward = {
  claimed?: boolean;
  description: string;
  durationLabel: string;
  key: string;
  rewardTala: number;
  seconds: number;
  title: string;
};

export type CounselorDirectoryItem = {
  email: string;
  fullName: string;
  gender: string;
  id: string;
  pictureUrl: string;
  program?: string;
  role: string;
  specialties: string[];
  studentNumber?: string;
  supportType?: "GUIDANCE" | "PEER";
};

export type AppNotification = {
  createdAt: string;
  id: string;
  isRead: boolean;
  kind: string;
  message: string;
  metadata?: Record<string, unknown>;
  timeLabel: string;
  title: string;
};

export type StudentNotificationCategory = "messages" | "notifications";

export type FutureSelfMessage = {
  createdAt: string;
  deliveryAt: string;
  id: string;
  message: string;
  studentNumber: string;
  updatedAt?: string;
};

function getDefaultApiBaseUrl() {
  return Platform.OS === "android"
    ? "http://10.0.2.2:4002"
    : "http://localhost:4002";
}

function normalizeApiBaseUrl(rawUrl: string) {
  if (
    Platform.OS === "android" &&
    (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1"))
  ) {
    return rawUrl
      .replace("localhost", "10.0.2.2")
      .replace("127.0.0.1", "10.0.2.2");
  }
  return rawUrl;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultApiBaseUrl(),
);
let backendWarmupPromise: Promise<void> | null = null;

type ApiResult = {
  ok: boolean;
  message?: string;
};

type StoredJournalEntry = JournalEntry & {
  syncStatus?: "pending" | "synced";
};

type StoredJournalRecord = {
  entry: StoredJournalEntry;
  messages: JournalMessage[];
};

type StoredJournalData = {
  entries: Record<string, StoredJournalRecord>;
};

type StoredMoodData = {
  entries: Record<string, MoodEntryRecord & { syncStatus?: "pending" | "synced" }>;
};

type CheckInStatusSnapshot = {
  activeDay?: number;
  completedDays?: number;
  statusDate?: string;
  todayBonusReward?: number;
  todayCheckedIn?: boolean;
  todayReward?: number;
  totalTala?: number;
};

type StoredCheckInClaim = {
  baseReward: number;
  bonusReward: number;
  checkInDate: string;
  createdAt: string;
  cycleDay: number;
  syncStatus?: "pending" | "synced";
  totalReward: number;
};

type StoredCheckInData = {
  pendingClaims: Record<string, StoredCheckInClaim>;
  status?: CheckInStatusSnapshot;
};

const LOCAL_JOURNAL_STORAGE_PREFIX = "bawattala.localJournal.";
const LOCAL_MOOD_STORAGE_PREFIX = "bawattala.localMoods.";
const LOCAL_CHECKIN_STORAGE_PREFIX = "bawattala.localCheckIns.";
const DAILY_CHECKIN_REWARDS = [10, 20, 30, 50, 70, 100, 150];

function getLocalJournalStorageKey(studentNumber: string) {
  return `${LOCAL_JOURNAL_STORAGE_PREFIX}${studentNumber}`;
}

function getLocalMoodStorageKey(studentNumber: string) {
  return `${LOCAL_MOOD_STORAGE_PREFIX}${studentNumber}`;
}

function getLocalCheckInStorageKey(studentNumber: string) {
  return `${LOCAL_CHECKIN_STORAGE_PREFIX}${studentNumber}`;
}

function getNowIsoString() {
  return new Date().toISOString();
}

function getTodayIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getManilaTodayIsoDate(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } catch {
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    const manilaDate = new Date(utcTime + 8 * 60 * 60 * 1000);
    const year = manilaDate.getUTCFullYear();
    const month = manilaDate.getUTCMonth() + 1;
    const day = manilaDate.getUTCDate();

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
}

function getDayDiff(previousDate: string, nextDate: string) {
  const previous = new Date(`${previousDate}T00:00:00Z`);
  const next = new Date(`${nextDate}T00:00:00Z`);
  return Math.round((next.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
}

function getNextCheckInProgress(latestCycleDay: number) {
  if (latestCycleDay >= DAILY_CHECKIN_REWARDS.length) {
    return { activeDay: 1, completedDays: 0 };
  }

  return {
    activeDay: Math.max(1, latestCycleDay + 1),
    completedDays: Math.max(0, latestCycleDay),
  };
}

function createLocalJournalEntry(studentNumber: string, aiEnabled: boolean): StoredJournalEntry {
  const now = getNowIsoString();
  return {
    adminFlagReason: null,
    aiEnabled,
    concernTags: [],
    createdAt: now,
    entryDate: getTodayIsoDate(),
    finishedAt: null,
    id: `local-${studentNumber}-${Date.now()}`,
    insights: [],
    isFinished: false,
    primaryConcern: null,
    riskLevel: "NONE",
    summary: "",
    syncStatus: "pending",
    title: "Journal entry",
    updatedAt: now,
  };
}

function summarizeLocalMessages(messages: JournalMessage[]) {
  const text = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text.trim())
    .filter(Boolean)
    .join(" ");

  if (!text) return "";
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function normalizeJournalMessage(value: unknown): JournalMessage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const roleText = String(raw.role || "").trim().toLowerCase();
  const role = roleText === "assistant" || roleText === "muni" ? "assistant" : "user";
  const text = String(raw.text || raw.messageText || raw.message_text || raw.content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  return {
    createdAt: String(raw.createdAt || raw.created_at || getNowIsoString()),
    id: String(raw.id || `message-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    role,
    text,
  };
}

function normalizeJournalMessages(values: unknown): JournalMessage[] {
  return Array.isArray(values)
    ? values.map(normalizeJournalMessage).filter((message): message is JournalMessage => Boolean(message))
    : [];
}

function buildPreviewJournalMessages(entry?: {
  contentText?: string;
  createdAt?: string;
  id?: string;
  preview?: string;
  summary?: string;
  title?: string;
} | null): JournalMessage[] {
  const preview = String(entry?.contentText || entry?.preview || entry?.summary || entry?.title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!entry?.id || !preview) return [];
  return [
    {
      createdAt: entry.createdAt || getNowIsoString(),
      id: `preview-${entry.id}`,
      role: "user",
      text: preview,
    },
  ];
}

async function readLocalJournalData(studentNumber: string): Promise<StoredJournalData> {
  const storedValue = await AsyncStorage.getItem(getLocalJournalStorageKey(studentNumber));
  if (!storedValue) return { entries: {} };

  try {
    const parsed = JSON.parse(storedValue);
    return {
      entries:
        parsed?.entries && typeof parsed.entries === "object"
          ? parsed.entries
          : {},
    };
  } catch {
    return { entries: {} };
  }
}

async function writeLocalJournalData(studentNumber: string, data: StoredJournalData) {
  await AsyncStorage.setItem(getLocalJournalStorageKey(studentNumber), JSON.stringify(data));
}

async function upsertLocalJournalRecord(
  studentNumber: string,
  entry?: JournalEntry | null,
  messages: JournalMessage[] = [],
  syncStatus: "pending" | "synced" = "synced",
) {
  if (!entry?.id) return;
  const data = await readLocalJournalData(studentNumber);
  const existingRecord = data.entries[entry.id];
  const normalizedMessages = normalizeJournalMessages(messages);
  const nextMessages = normalizedMessages.length > 0
    ? normalizedMessages
    : normalizeJournalMessages(existingRecord?.messages);
  data.entries[entry.id] = {
    entry: { ...entry, syncStatus },
    messages: nextMessages,
  };
  await writeLocalJournalData(studentNumber, data);
}

async function getLocalJournalRecord(studentNumber: string, entryId: string) {
  const data = await readLocalJournalData(studentNumber);
  return data.entries[entryId] ?? null;
}

async function getLocalJournalRecords(studentNumber: string) {
  const data = await readLocalJournalData(studentNumber);
  return Object.values(data.entries);
}

async function removeLocalJournalRecord(studentNumber: string, entryId: string) {
  const data = await readLocalJournalData(studentNumber);
  delete data.entries[entryId];
  await writeLocalJournalData(studentNumber, data);
}

function mergeJournalEntryLists<
  T extends {
    entryDate: string;
    id: string;
  },
>(remoteEntries: T[], localEntries: T[]) {
  const entriesById = new Map<string, T>();
  for (const entry of remoteEntries) entriesById.set(entry.id, entry);
  for (const entry of localEntries) entriesById.set(entry.id, entry);
  return Array.from(entriesById.values()).sort((a, b) => b.id.localeCompare(a.id));
}

async function getLocalFinishedJournalEntries(studentNumber: string) {
  const records = await getLocalJournalRecords(studentNumber);
  return records
    .filter((record) => record.entry.isFinished)
    .map((record) => {
      const preview = summarizeLocalMessages(record.messages) || record.entry.summary || record.entry.title;
      return {
        createdAt: record.entry.createdAt,
        entryDate: record.entry.entryDate,
        id: record.entry.id,
        insights: record.entry.insights,
        isFinished: record.entry.isFinished,
        preview,
        summary: record.entry.summary,
        title: record.entry.title || "Journal entry",
      };
    });
}

async function syncPendingJournalEntries(studentNumber: string) {
  const data = await readLocalJournalData(studentNumber);
  const pendingRecords = Object.values(data.entries).filter(
    (record) => record.entry.syncStatus === "pending",
  );

  for (const record of pendingRecords) {
    try {
      const createResult = await post("/api/journal/session/create", {
        aiEnabled: false,
        forceNew: true,
        studentNumber,
      });
      if (!createResult.response.ok || !createResult.data?.entry?.id) {
        continue;
      }

      let remoteEntry = createResult.data.entry as JournalEntry;
      let remoteMessages: JournalMessage[] = createResult.data?.messages ?? [];
      const userMessages = record.messages.filter((message) => message.role === "user");

      for (const message of userMessages) {
        const messageResult = await post("/api/journal/message", {
          aiEnabled: false,
          entryId: remoteEntry.id,
          message: message.text,
          studentNumber,
        });
        if (!messageResult.response.ok) {
          throw new Error("Unable to sync journal message.");
        }
        remoteEntry = messageResult.data?.entry ?? remoteEntry;
        remoteMessages = messageResult.data?.messages ?? remoteMessages;
      }

      if (record.entry.isFinished) {
        const finishResult = await post("/api/journal/session/finish", {
          concernTags: record.entry.concernTags,
          entryId: remoteEntry.id,
          primaryConcern: record.entry.primaryConcern ?? record.entry.concernTags[0] ?? "Others",
          studentNumber,
        });
        if (!finishResult.response.ok) {
          throw new Error("Unable to finish synced journal entry.");
        }
        remoteEntry = finishResult.data?.entry ?? remoteEntry;
        remoteMessages = finishResult.data?.messages ?? remoteMessages;
      }

      delete data.entries[record.entry.id];
      data.entries[remoteEntry.id] = {
        entry: { ...remoteEntry, syncStatus: "synced" },
        messages: remoteMessages,
      };
      await writeLocalJournalData(studentNumber, data);
    } catch {
      await writeLocalJournalData(studentNumber, data);
      return;
    }
  }
}

async function readLocalMoodData(studentNumber: string): Promise<StoredMoodData> {
  const storedValue = await AsyncStorage.getItem(getLocalMoodStorageKey(studentNumber));
  if (!storedValue) return { entries: {} };

  try {
    const parsed = JSON.parse(storedValue);
    return {
      entries:
        parsed?.entries && typeof parsed.entries === "object"
          ? parsed.entries
          : {},
    };
  } catch {
    return { entries: {} };
  }
}

async function writeLocalMoodData(studentNumber: string, data: StoredMoodData) {
  await AsyncStorage.setItem(getLocalMoodStorageKey(studentNumber), JSON.stringify(data));
}

async function upsertLocalMoodEntry(
  studentNumber: string,
  entry?: MoodEntryRecord | null,
  syncStatus: "pending" | "synced" = "synced",
) {
  if (!entry?.moodDate) return;
  const data = await readLocalMoodData(studentNumber);
  data.entries[entry.moodDate] = { ...entry, syncStatus };
  await writeLocalMoodData(studentNumber, data);
}

async function syncPendingMoodEntries(studentNumber: string) {
  const data = await readLocalMoodData(studentNumber);
  const pendingEntries = Object.values(data.entries).filter((entry) => entry.syncStatus === "pending");

  for (const entry of pendingEntries) {
    try {
      const result = await post("/api/moods", {
        studentNumber,
        moodId: entry.moodId,
        moodDate: entry.moodDate,
        moodSource: entry.moodSource ?? "INPUT",
      });
      if (!result.response.ok) {
        continue;
      }
      data.entries[entry.moodDate] = {
        ...(result.data?.entry ?? entry),
        syncStatus: "synced",
      };
      await writeLocalMoodData(studentNumber, data);
    } catch {
      await writeLocalMoodData(studentNumber, data);
      return;
    }
  }
}

function normalizeCheckInStatus(
  data: Partial<CheckInStatusSnapshot>,
  statusDate = getManilaTodayIsoDate(),
): CheckInStatusSnapshot {
  return {
    activeDay: Number(data.activeDay ?? 1),
    completedDays: Number(data.completedDays ?? 0),
    statusDate,
    todayBonusReward: data.todayBonusReward === undefined ? undefined : Number(data.todayBonusReward),
    todayCheckedIn: Boolean(data.todayCheckedIn),
    todayReward: data.todayReward === undefined ? undefined : Number(data.todayReward),
    totalTala: Number(data.totalTala ?? 0),
  };
}

async function readLocalCheckInData(studentNumber: string): Promise<StoredCheckInData> {
  const storedValue = await AsyncStorage.getItem(getLocalCheckInStorageKey(studentNumber));
  if (!storedValue) return { pendingClaims: {} };

  try {
    const parsed = JSON.parse(storedValue);
    return {
      pendingClaims:
        parsed?.pendingClaims && typeof parsed.pendingClaims === "object"
          ? parsed.pendingClaims
          : {},
      status:
        parsed?.status && typeof parsed.status === "object"
          ? parsed.status
          : undefined,
    };
  } catch {
    return { pendingClaims: {} };
  }
}

async function writeLocalCheckInData(studentNumber: string, data: StoredCheckInData) {
  await AsyncStorage.setItem(getLocalCheckInStorageKey(studentNumber), JSON.stringify(data));
}

async function cacheCheckInStatus(
  studentNumber: string,
  status: Partial<CheckInStatusSnapshot>,
  statusDate = getManilaTodayIsoDate(),
) {
  const data = await readLocalCheckInData(studentNumber);
  data.status = normalizeCheckInStatus(status, statusDate);
  await writeLocalCheckInData(studentNumber, data);
}

function buildEffectiveLocalCheckInStatus(
  data: StoredCheckInData,
  today = getManilaTodayIsoDate(),
): CheckInStatusSnapshot {
  const storedStatus = data.status;
  const storedStatusDate = storedStatus?.statusDate;
  const storedCompletedDays = Number(storedStatus?.completedDays ?? 0);
  const storedTotalTala = Number(storedStatus?.totalTala ?? 0);
  const shouldCarryToday =
    storedStatusDate === today ||
    (storedStatusDate ? getDayDiff(storedStatusDate, today) < 0 : false);
  const baseProgress =
    !shouldCarryToday && storedStatus?.todayCheckedIn
      ? getNextCheckInProgress(storedCompletedDays)
      : {
          activeDay: Number(storedStatus?.activeDay ?? 1),
          completedDays: storedCompletedDays,
        };
  const status: CheckInStatusSnapshot = {
    ...baseProgress,
    todayCheckedIn: shouldCarryToday ? Boolean(storedStatus?.todayCheckedIn) : false,
    totalTala: storedTotalTala,
  };

  if (shouldCarryToday && storedStatus?.todayReward !== undefined) {
    status.todayReward = Number(storedStatus.todayReward);
  }
  if (shouldCarryToday && storedStatus?.todayBonusReward !== undefined) {
    status.todayBonusReward = Number(storedStatus.todayBonusReward);
  }

  const pendingClaims = Object.values(data.pendingClaims ?? {})
    .filter((claim) => claim.syncStatus === "pending" && getDayDiff(claim.checkInDate, today) >= 0)
    .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate));

  for (const claim of pendingClaims) {
    status.totalTala = Number(status.totalTala ?? 0) + Number(claim.totalReward ?? 0);

    if (claim.checkInDate === today) {
      status.activeDay = claim.cycleDay >= DAILY_CHECKIN_REWARDS.length ? 1 : claim.cycleDay + 1;
      status.completedDays = claim.cycleDay;
      status.todayBonusReward = claim.bonusReward;
      status.todayCheckedIn = true;
      status.todayReward = claim.totalReward;
      continue;
    }

    const nextProgress = getNextCheckInProgress(claim.cycleDay);
    status.activeDay = nextProgress.activeDay;
    status.completedDays = nextProgress.completedDays;
    status.todayBonusReward = undefined;
    status.todayCheckedIn = false;
    status.todayReward = undefined;
  }

  return status;
}

async function syncPendingCheckIns(studentNumber: string) {
  const data = await readLocalCheckInData(studentNumber);
  const pendingClaims = Object.values(data.pendingClaims ?? {})
    .filter((claim) => claim.syncStatus === "pending")
    .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate));

  for (const claim of pendingClaims) {
    try {
      const result = await post("/api/checkins", {
        studentNumber,
        checkInDate: claim.checkInDate,
      });

      if (!result.response.ok && result.response.status !== 409) {
        await writeLocalCheckInData(studentNumber, data);
        return false;
      }

      delete data.pendingClaims[claim.checkInDate];
      data.status = normalizeCheckInStatus(result.data ?? {}, getManilaTodayIsoDate());
      await writeLocalCheckInData(studentNumber, data);
    } catch {
      await writeLocalCheckInData(studentNumber, data);
      return false;
    }
  }

  return true;
}

async function claimLocalDailyCheckIn(studentNumber: string) {
  const today = getManilaTodayIsoDate();
  const data = await readLocalCheckInData(studentNumber);
  const currentStatus = buildEffectiveLocalCheckInStatus(data, today);

  if (currentStatus.todayCheckedIn) {
    return {
      ok: false,
      message: "Today's check-in has already been claimed on this device.",
      ...currentStatus,
    };
  }

  const cycleDay = Math.min(
    Math.max(Number(currentStatus.activeDay ?? 1), 1),
    DAILY_CHECKIN_REWARDS.length,
  );
  const baseReward = DAILY_CHECKIN_REWARDS[cycleDay - 1] ?? DAILY_CHECKIN_REWARDS[0];
  const bonusReward = 0;
  const totalReward = baseReward + bonusReward;
  const claim: StoredCheckInClaim = {
    baseReward,
    bonusReward,
    checkInDate: today,
    createdAt: getNowIsoString(),
    cycleDay,
    syncStatus: "pending",
    totalReward,
  };
  data.pendingClaims[today] = claim;

  const nextStatus = buildEffectiveLocalCheckInStatus(data, today);
  await writeLocalCheckInData(studentNumber, data);

  return {
    ok: true,
    message: "Check-in saved offline. It will sync when your connection returns.",
    activeDay: nextStatus.activeDay,
    baseReward,
    bonusReward,
    completedDays: nextStatus.completedDays,
    savedOffline: true,
    todayBonusReward: nextStatus.todayBonusReward,
    todayCheckedIn: nextStatus.todayCheckedIn,
    todayReward: nextStatus.todayReward,
    totalReward,
    totalTala: nextStatus.totalTala,
  };
}

function shouldWarmBackend() {
  return API_BASE_URL.includes(".onrender.com");
}

export async function warmBackend(): Promise<void> {
  if (!shouldWarmBackend()) {
    return;
  }

  if (!backendWarmupPromise) {
    backendWarmupPromise = fetch(`${API_BASE_URL}/health`)
      .then(() => undefined)
      .catch(() => undefined);
  }

  await backendWarmupPromise;
}

async function get(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function del(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function patch(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function buildLibraryBookFileUrl(studentNumber: string, bookId: string) {
  const params = new URLSearchParams({ bookId, studentNumber });
  return `${API_BASE_URL}/api/library/download-file?${params.toString()}`;
}

export async function sendOtp(email: string): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/send-otp", { email });
  return { ok: response.ok, message: data?.message };
}

export async function loginWithStudentId(
  studentNumber: string,
  password: string,
): Promise<ApiResult & { user?: AuthUser }> {
  const { response, data } = await post("/api/auth/login", {
    studentNumber,
    password,
  });
  return { ok: response.ok, message: data?.message, user: data?.user };
}

export async function fetchStudentProfile(
  studentNumber: string,
): Promise<ApiResult & { profile?: StudentProfile | null }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/auth/profile?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    profile: data?.profile ?? null,
  };
}

export async function fetchStudentPreferences(
  studentNumber: string,
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/auth/preferences?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    preferences: data?.preferences ?? null,
  };
}

export async function saveStudentPreferences(
  studentNumber: string,
  preferences: Partial<
    Pick<
      StudentPreferences,
      | "journalLockAutoLock"
      | "journalLockEnabled"
      | "notificationPreviewsEnabled"
      | "privateJournalModeEnabled"
    >
  > & {
    journalLockPin?: string;
    previousJournalLockPin?: string;
  },
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  const { response, data } = await patch("/api/auth/preferences", {
    studentNumber,
    ...preferences,
  });

  return {
    ok: response.ok,
    message: data?.message,
    preferences: data?.preferences ?? null,
  };
}

export async function verifyJournalLockPin(
  studentNumber: string,
  pin: string,
): Promise<ApiResult & { unlocked?: boolean }> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/verify", {
    studentNumber,
    pin,
  });

  return {
    ok: response.ok,
    message: data?.message,
    unlocked: Boolean(data?.unlocked),
  };
}

export async function resetJournalLockWithStudentId(
  studentNumber: string,
  studentNumberConfirmation: string,
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/reset", {
    studentNumber,
    studentNumberConfirmation,
  });

  return {
    ok: response.ok,
    message: data?.message,
    preferences: data?.preferences ?? null,
  };
}

export async function fetchStudentReferral(
  studentNumber: string,
): Promise<ApiResult & { referral?: StudentReferral | null }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/auth/referral?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    referral: data?.referral ?? null,
  };
}

export async function redeemStudentReferralCode(
  studentNumber: string,
  referralCode: string,
): Promise<ApiResult & { referral?: StudentReferral | null; rewardTala?: number; totalTala?: number }> {
  const { response, data } = await post("/api/auth/referral/redeem", {
    studentNumber,
    referralCode,
  });

  return {
    ok: response.ok,
    message: data?.message,
    referral: data?.referral ?? null,
    rewardTala: data?.rewardTala,
    totalTala: data?.totalTala,
  };
}

export async function forgotPasswordSendCode(
  studentNumber: string,
  password: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/send-code", {
    studentNumber,
    password,
  });
  return { ok: response.ok, message: data?.message };
}

export async function profilePasswordSendCode(
  studentNumber: string,
  email: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/profile-password/send-code", {
    studentNumber,
    email,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordResendCode(
  studentNumber: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/resend-code", {
    studentNumber,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordVerifyCode(
  studentNumber: string,
  token: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/verify-code", {
    studentNumber,
    token,
  });
  return { ok: response.ok, message: data?.message };
}

export async function forgotPasswordReset(
  studentNumber: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/forgot-password/reset", {
    studentNumber,
    newPassword,
    confirmPassword,
  });
  return { ok: response.ok, message: data?.message };
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/verify-otp", {
    email,
    token,
  });
  return { ok: response.ok, message: data?.message };
}

export async function registerProfile(payload: {
  fullName: string;
  studentNumber: string;
  program: string;
  gender: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
  email: string;
  birthdate: string;
  password: string;
}): Promise<ApiResult> {
  const { response, data } = await post(
    "/api/auth/register-profile",
    payload as unknown as Record<string, string>,
  );
  return { ok: response.ok, message: data?.message };
}

export async function scanSchoolId(imageBase64: string): Promise<{
  ok: boolean;
  isValidId: boolean;
  ocrText: string;
  message?: string;
}> {
  const { response, data } = await post("/api/ocr/scan-id", { imageBase64 });
  return {
    ok: response.ok,
    isValidId: Boolean(data?.isValidId),
    ocrText: data?.ocrText ?? "",
    message: data?.message,
  };
}

export async function saveDailyMood(
  studentNumber: string,
  moodId: string,
  moodDate?: string,
  moodSource: MoodSource = "INPUT",
): Promise<ApiResult & { entry?: MoodEntryRecord }> {
  const effectiveMoodDate = moodDate || getTodayIsoDate();
  try {
    await syncPendingMoodEntries(studentNumber);
    const { response, data } = await post("/api/moods", {
      studentNumber,
      moodId,
      moodDate: effectiveMoodDate,
      moodSource,
    });

    if (response.ok) {
      await upsertLocalMoodEntry(studentNumber, data?.entry ?? {
        createdAt: getNowIsoString(),
        moodDate: effectiveMoodDate,
        moodId,
        moodLabel: moodId,
        moodSource,
      });
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry,
    };
  } catch {
    const entry: MoodEntryRecord = {
      createdAt: getNowIsoString(),
      id: `local-mood-${studentNumber}-${effectiveMoodDate}`,
      moodDate: effectiveMoodDate,
      moodId,
      moodLabel: moodId,
      moodSource,
    };
    await upsertLocalMoodEntry(studentNumber, entry, "pending");
    return {
      ok: true,
      message: "Mood saved offline. It will sync when your connection returns.",
      entry,
    };
  }
}

export async function fetchDailyMood(
  studentNumber: string,
  moodDate?: string,
): Promise<
  ApiResult & {
    entries?: MoodEntryRecord[];
    entry?: MoodEntryRecord | null;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  if (moodDate) {
    params.set("moodDate", moodDate);
  }
  try {
    await syncPendingMoodEntries(studentNumber);
    const { response, data } = await get(`/api/moods/today?${params.toString()}`);
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    for (const entry of entries) {
      await upsertLocalMoodEntry(studentNumber, entry);
    }
    if (data?.entry) {
      await upsertLocalMoodEntry(studentNumber, data.entry);
    }

    return {
      ok: response.ok,
      message: data?.message,
      entries,
      entry: data?.entry ?? null,
    };
  } catch {
    const localData = await readLocalMoodData(studentNumber);
    const effectiveMoodDate = moodDate || getTodayIsoDate();
    const entry = localData.entries[effectiveMoodDate] ?? null;
    return {
      ok: true,
      message: "Showing mood saved on this device.",
      entries: entry ? [entry] : [],
      entry,
    };
  }
}

export async function fetchMonthlyMoods(
  studentNumber: string,
  year: number,
  month: number,
): Promise<
  ApiResult & {
    counts?: Record<string, number>;
    entries?: MoodEntryRecord[];
    mostCommonMoodId?: string | null;
    mostCommonMoodLabel?: string | null;
    totalCheckIns?: number;
  }
> {
  const params = new URLSearchParams({
    studentNumber,
    year: String(year),
    month: String(month),
  });
  try {
    await syncPendingMoodEntries(studentNumber);
    const { response, data } = await get(`/api/moods/month?${params.toString()}`);
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    for (const entry of entries) {
      await upsertLocalMoodEntry(studentNumber, entry);
    }

    return {
      ok: response.ok,
      message: data?.message,
      counts: data?.counts,
      entries,
      mostCommonMoodId: data?.mostCommonMoodId ?? null,
      mostCommonMoodLabel: data?.mostCommonMoodLabel ?? null,
      totalCheckIns: data?.totalCheckIns ?? 0,
    };
  } catch {
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
    const entries = Object.values((await readLocalMoodData(studentNumber)).entries).filter((entry) =>
      entry.moodDate.startsWith(monthPrefix),
    );
    const counts = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.moodId] = (acc[entry.moodId] ?? 0) + 1;
      return acc;
    }, {});
    const mostCommonMoodId =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      ok: true,
      message: "Showing moods saved on this device.",
      counts,
      entries,
      mostCommonMoodId,
      mostCommonMoodLabel: mostCommonMoodId,
      totalCheckIns: entries.length,
    };
  }
}

export async function fetchLibraryBooks(
  studentNumber?: string,
  searchQuery?: string,
): Promise<ApiResult & { books?: LibraryBookRecord[]; totalItems?: number }> {
  const params = new URLSearchParams({ maxResults: "24" });
  if (studentNumber) {
    params.set("studentNumber", studentNumber);
  }
  if (searchQuery?.trim()) {
    params.set("q", searchQuery.trim());
  }

  const { response, data } = await get(`/api/library/books?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    books: Array.isArray(data?.books) ? data.books : [],
    totalItems: Number(data?.totalItems ?? 0),
  };
}

export async function downloadLibraryBook(payload: {
  authors?: string;
  bookId: string;
  bookTitle?: string;
  downloadUrl?: string;
  provider?: string;
  readerLink?: string;
  sourceId?: string;
  sourceReaderLink?: string;
  studentNumber: string;
}): Promise<ApiResult & { alreadyDownloaded?: boolean; download?: { bookId: string; downloadedAt?: string | null; downloadUrl?: string } | null }> {
  const { response, data } = await post("/api/library/download", payload as unknown as Record<string, unknown>);
  const download = data?.download
    ? {
        ...data.download,
        downloadUrl: buildLibraryBookFileUrl(payload.studentNumber, data.download.bookId ?? payload.bookId),
      }
    : null;

  return {
    ok: response.ok,
    alreadyDownloaded: Boolean(data?.alreadyDownloaded),
    message: data?.message,
    download,
  };
}

export async function removeLibraryBookFromShelf(
  studentNumber: string,
  bookId: string,
): Promise<ApiResult & { removed?: boolean }> {
  const params = new URLSearchParams({ bookId, studentNumber });
  const { response, data } = await del(`/api/library/download?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    removed: Boolean(data?.removed),
  };
}

export async function fetchLibraryMyShelf(
  studentNumber: string,
  builtInBookIds: string[] = [],
): Promise<
  ApiResult & {
    books?: LibraryBookRecord[];
    progressByBookId?: Record<string, LibraryBookProgress | null>;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  if (builtInBookIds.length) {
    params.set("builtInBookIds", builtInBookIds.join(","));
  }

  const { response, data } = await get(`/api/library/my-shelf?${params.toString()}`);
  const rawProgressByBookId = data?.progressByBookId;

  return {
    ok: response.ok,
    message: data?.message,
    books: Array.isArray(data?.books) ? data.books : [],
    progressByBookId:
      rawProgressByBookId && typeof rawProgressByBookId === "object"
        ? rawProgressByBookId
        : {},
  };
}

export async function saveLibraryBookProgress(payload: {
  authors?: string;
  bookId: string;
  bookTitle?: string;
  currentPage: number;
  status?: "STARTED" | "FINISHED";
  studentNumber: string;
  totalPages: number;
}): Promise<ApiResult & { progress?: LibraryBookProgress | null }> {
  const { response, data } = await post("/api/library/progress", payload);

  return {
    ok: response.ok,
    message: data?.message,
    progress: data?.progress ?? null,
  };
}

export async function claimLibraryReadingReward(payload: {
  achievementKey?: string;
  bookId: string;
  bookTitle?: string;
  readingSeconds: number;
  studentNumber: string;
}): Promise<
  ApiResult & {
    achievement?: ReadingAchievementReward | null;
    achievements?: ReadingAchievementReward[];
    completedCount?: number;
    nextAchievement?: ReadingAchievementReward | null;
    rewardTala?: number;
    totalCount?: number;
    totalTala?: number;
  }
> {
  const { response, data } = await post("/api/library/reading-reward", payload);

  return {
    ok: response.ok,
    message: data?.message,
    achievement: data?.achievement ?? null,
    achievements: Array.isArray(data?.achievements) ? data.achievements : [],
    completedCount: data?.completedCount,
    nextAchievement: data?.nextAchievement ?? null,
    rewardTala: data?.rewardTala,
    totalCount: data?.totalCount,
    totalTala: data?.totalTala,
  };
}

export async function fetchLibraryReadingRewardStatus(
  studentNumber: string,
): Promise<
  ApiResult & {
    achievements?: ReadingAchievementReward[];
    completedCount?: number;
    nextAchievement?: ReadingAchievementReward | null;
    totalCount?: number;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/library/reading-reward/status?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    achievements: Array.isArray(data?.achievements) ? data.achievements : [],
    completedCount: data?.completedCount,
    nextAchievement: data?.nextAchievement ?? null,
    totalCount: data?.totalCount,
  };
}

export async function rateLibraryBook(payload: {
  authors?: string;
  bookId: string;
  bookTitle?: string;
  currentPage: number;
  rating: number;
  status?: "STARTED" | "FINISHED";
  studentNumber: string;
  totalPages: number;
}): Promise<ApiResult & { progress?: LibraryBookProgress | null }> {
  const { response, data } = await post("/api/library/rating", payload);

  return {
    ok: response.ok,
    message: data?.message,
    progress: data?.progress ?? null,
  };
}

export async function fetchCheckInStatus(
  studentNumber: string,
): Promise<
  ApiResult & {
    activeDay?: number;
    completedDays?: number;
    todayBonusReward?: number;
    todayCheckedIn?: boolean;
    todayReward?: number;
    totalTala?: number;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  try {
    await syncPendingCheckIns(studentNumber);
    const { response, data } = await get(`/api/checkins/status?${params.toString()}`);

    if (response.ok) {
      await cacheCheckInStatus(studentNumber, data ?? {});
    }

    const localData = await readLocalCheckInData(studentNumber);
    const hasPendingClaims = Object.values(localData.pendingClaims ?? {}).some(
      (claim) => claim.syncStatus === "pending",
    );
    if (hasPendingClaims) {
      const localStatus = buildEffectiveLocalCheckInStatus(localData);
      return {
        ok: true,
        message: data?.message,
        activeDay: localStatus.activeDay,
        completedDays: localStatus.completedDays,
        todayBonusReward: localStatus.todayBonusReward,
        todayCheckedIn: localStatus.todayCheckedIn,
        todayReward: localStatus.todayReward,
        totalTala: localStatus.totalTala,
      };
    }

    return {
      ok: response.ok,
      message: data?.message,
      activeDay: data?.activeDay,
      completedDays: data?.completedDays,
      todayBonusReward: data?.todayBonusReward,
      todayCheckedIn: data?.todayCheckedIn,
      todayReward: data?.todayReward,
      totalTala: data?.totalTala,
    };
  } catch {
    const localStatus = buildEffectiveLocalCheckInStatus(await readLocalCheckInData(studentNumber));
    return {
      ok: true,
      message: "Showing check-in status saved on this device.",
      activeDay: localStatus.activeDay,
      completedDays: localStatus.completedDays,
      todayBonusReward: localStatus.todayBonusReward,
      todayCheckedIn: localStatus.todayCheckedIn,
      todayReward: localStatus.todayReward,
      totalTala: localStatus.totalTala,
    };
  }
}

export async function claimDailyCheckIn(
  studentNumber: string,
): Promise<
  ApiResult & {
    activeDay?: number;
    baseReward?: number;
    bonusReward?: number;
    completedDays?: number;
    todayBonusReward?: number;
    todayCheckedIn?: boolean;
    todayReward?: number;
    totalReward?: number;
    totalTala?: number;
    savedOffline?: boolean;
  }
> {
  try {
    await syncPendingCheckIns(studentNumber);
    const { response, data } = await post("/api/checkins", {
      studentNumber,
      checkInDate: getManilaTodayIsoDate(),
    });

    if (response.ok || response.status === 409) {
      await cacheCheckInStatus(studentNumber, data ?? {});
    }

    return {
      ok: response.ok,
      message: data?.message,
      activeDay: data?.activeDay,
      baseReward: data?.baseReward,
      bonusReward: data?.bonusReward,
      completedDays: data?.completedDays,
      todayBonusReward: data?.todayBonusReward,
      todayCheckedIn: data?.todayCheckedIn,
      todayReward: data?.todayReward,
      totalReward: data?.totalReward,
      totalTala: data?.totalTala,
    };
  } catch {
    return claimLocalDailyCheckIn(studentNumber);
  }
}

export async function fetchTodayJournalSession(
  studentNumber: string,
): Promise<
  ApiResult & {
    entry?: JournalEntry | null;
    messages?: JournalMessage[];
  }
> {
  try {
    await syncPendingJournalEntries(studentNumber);
    const params = new URLSearchParams({ studentNumber });
    const { response, data } = await get(`/api/journal/session/today?${params.toString()}`);

    if (response.ok) {
      await upsertLocalJournalRecord(studentNumber, data?.entry ?? null, data?.messages ?? []);
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry ?? null,
      messages: data?.messages ?? [],
    };
  } catch {
    const localToday = (await getLocalJournalRecords(studentNumber))
      .filter((record) => record.entry.entryDate === getTodayIsoDate() && !record.entry.isFinished)
      .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt))[0];

    return {
      ok: true,
      message: localToday ? "Loaded your offline journal draft." : "You are offline. Start writing and it will sync later.",
      entry: localToday?.entry ?? null,
      messages: localToday?.messages ?? [],
    };
  }
}

export async function createJournalSession(payload: {
  aiEnabled: boolean;
  forceNew?: boolean;
  studentNumber: string;
}): Promise<
  ApiResult & {
    entry?: JournalEntry | null;
    messages?: JournalMessage[];
  }
> {
  try {
    await syncPendingJournalEntries(payload.studentNumber);
    const { response, data } = await post("/api/journal/session/create", {
      aiEnabled: payload.aiEnabled,
      forceNew: payload.forceNew === true,
      studentNumber: payload.studentNumber,
    });

    if (response.ok) {
      await upsertLocalJournalRecord(payload.studentNumber, data?.entry ?? null, data?.messages ?? []);
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry ?? null,
      messages: data?.messages ?? [],
    };
  } catch {
    const entry = createLocalJournalEntry(payload.studentNumber, payload.aiEnabled);
    await upsertLocalJournalRecord(payload.studentNumber, entry, [], "pending");
    return {
      ok: true,
      message: "Offline journal started. It will sync when your connection returns.",
      entry,
      messages: [],
    };
  }
}

export async function sendJournalMessage(payload: {
  aiEnabled: boolean;
  entryId?: string;
  message: string;
  studentNumber: string;
}): Promise<
  ApiResult & {
    aiReply?: string | null;
    entry?: JournalEntry;
    messages?: JournalMessage[];
  }
> {
  try {
    if (payload.entryId?.startsWith("local-")) {
      throw new Error("Local journal entry.");
    }
    if (!payload.entryId?.startsWith("local-")) {
      await syncPendingJournalEntries(payload.studentNumber);
    }
    const { response, data } = await post("/api/journal/message", {
      aiEnabled: payload.aiEnabled,
      entryId: payload.entryId ?? "",
      message: payload.message,
      studentNumber: payload.studentNumber,
    });

    if (response.ok) {
      await upsertLocalJournalRecord(payload.studentNumber, data?.entry ?? null, data?.messages ?? []);
    }

    return {
      ok: response.ok,
      aiReply: data?.aiReply ?? null,
      entry: data?.entry,
      message: data?.message,
      messages: data?.messages ?? [],
    };
  } catch {
    const data = await readLocalJournalData(payload.studentNumber);
    const existingRecord = payload.entryId ? data.entries[payload.entryId] : null;
    const entry = existingRecord?.entry ?? createLocalJournalEntry(payload.studentNumber, payload.aiEnabled);
    const now = getNowIsoString();
    const messages = [
      ...(existingRecord?.messages ?? []),
      {
        createdAt: now,
        id: `local-message-${Date.now()}`,
        role: "user" as const,
        text: payload.message,
      },
    ];
    const summary = summarizeLocalMessages(messages);
    const nextEntry: StoredJournalEntry = {
      ...entry,
      aiEnabled: payload.aiEnabled,
      summary,
      syncStatus: "pending",
      title: summary ? summary.slice(0, 48) : entry.title,
      updatedAt: now,
    };
    data.entries[nextEntry.id] = { entry: nextEntry, messages };
    await writeLocalJournalData(payload.studentNumber, data);

    return {
      ok: true,
      aiReply: null,
      entry: nextEntry,
      message: "Saved offline. Muni replies will resume when you are online.",
      messages,
    };
  }
}

export async function finishJournalEntry(payload: {
  concernTags?: string[];
  entryId: string;
  primaryConcern?: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry; messages?: JournalMessage[] }> {
  try {
    if (payload.entryId.startsWith("local-")) {
      throw new Error("Local journal entry.");
    }
    if (!payload.entryId.startsWith("local-")) {
      await syncPendingJournalEntries(payload.studentNumber);
    }
    const { response, data } = await post("/api/journal/session/finish", payload);

    if (response.ok) {
      const localRecord = await getLocalJournalRecord(payload.studentNumber, payload.entryId);
      await upsertLocalJournalRecord(
        payload.studentNumber,
        data?.entry ?? null,
        data?.messages?.length ? data.messages : localRecord?.messages ?? [],
      );
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry,
      messages: data?.messages ?? [],
    };
  } catch {
    const record = await getLocalJournalRecord(payload.studentNumber, payload.entryId);
    if (!record) {
      return { ok: false, message: "Unable to finish this journal entry offline." };
    }

    const now = getNowIsoString();
    const summary = record.entry.summary || summarizeLocalMessages(record.messages);
    const entry: StoredJournalEntry = {
      ...record.entry,
      concernTags: payload.concernTags ?? record.entry.concernTags,
      finishedAt: now,
      insights: record.entry.insights?.length ? record.entry.insights : summary ? [summary] : [],
      isFinished: true,
      primaryConcern: payload.primaryConcern ?? payload.concernTags?.[0] ?? record.entry.primaryConcern,
      summary,
      syncStatus: "pending",
      updatedAt: now,
    };
    await upsertLocalJournalRecord(payload.studentNumber, entry, record.messages, "pending");
    return {
      ok: true,
      message: "Saved offline. This entry will sync when your connection returns.",
      entry,
      messages: record.messages,
    };
  }
}

export async function suggestJournalTags(payload: {
  entryId: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry; suggestedTags?: string[]; tagOptions?: string[] }> {
  try {
    if (payload.entryId.startsWith("local-")) {
      throw new Error("Local journal entry.");
    }
    if (!payload.entryId.startsWith("local-")) {
      await syncPendingJournalEntries(payload.studentNumber);
    }
    const { response, data } = await post("/api/journal/session/tag-suggestions", payload);

    if (response.ok && data?.entry) {
      const localRecord = await getLocalJournalRecord(payload.studentNumber, payload.entryId);
      await upsertLocalJournalRecord(
        payload.studentNumber,
        data.entry,
        data?.messages?.length ? data.messages : localRecord?.messages ?? [],
      );
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry,
      suggestedTags: Array.isArray(data?.suggestedTags) ? data.suggestedTags : [],
      tagOptions: Array.isArray(data?.tagOptions) ? data.tagOptions : [],
    };
  } catch {
    const record = await getLocalJournalRecord(payload.studentNumber, payload.entryId);
    if (!record) {
      return { ok: false, message: "Unable to suggest tags while offline." };
    }
    return {
      ok: true,
      message: "Choose tags manually while offline.",
      entry: record.entry,
      suggestedTags: record.entry.concernTags,
      tagOptions: [],
    };
  }
}

export async function saveJournalSupportResponse(payload: {
  entryId: string;
  response: "CONTACTED" | "DECLINED";
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry }> {
  const { response, data } = await post("/api/journal/session/support-response", payload);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry,
  };
}

export async function saveJournalConcerns(payload: {
  concernTags?: string[];
  entryId: string;
  primaryConcern: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry }> {
  const { response, data } = await post("/api/journal/session/concerns", payload);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry,
  };
}

export async function discardEmptyJournalEntry(payload: {
  entryId: string;
  studentNumber: string;
}): Promise<ApiResult & { removed?: boolean }> {
  if (payload.entryId.startsWith("local-")) {
    await removeLocalJournalRecord(payload.studentNumber, payload.entryId);
    return { ok: true, removed: true };
  }

  const { response, data } = await post("/api/journal/session/discard-empty", payload);

  return {
    ok: response.ok,
    message: data?.message,
    removed: Boolean(data?.removed),
  };
}

export async function discardJournalEntry(payload: {
  entryId: string;
  studentNumber: string;
}): Promise<ApiResult & { removed?: boolean }> {
  if (payload.entryId.startsWith("local-")) {
    await removeLocalJournalRecord(payload.studentNumber, payload.entryId);
    return { ok: true, removed: true };
  }

  const { response, data } = await post("/api/journal/session/discard", payload);

  return {
    ok: response.ok,
    message: data?.message,
    removed: Boolean(data?.removed),
  };
}

export async function fetchRecentJournalEntries(
  studentNumber: string,
  windowDays = 20,
): Promise<
  ApiResult & {
    entries?: Array<{
      createdAt: string;
      entryDate: string;
      id: string;
      isFinished?: boolean;
      preview: string;
      summary: string;
      title: string;
    }>;
    progress?: {
      monthlyCount: number;
      todayCount: number;
      totalCount: number;
    };
  }
> {
  const params = new URLSearchParams({
    studentNumber,
    windowDays: String(windowDays),
  });
  try {
    await syncPendingJournalEntries(studentNumber);
    const { response, data } = await get(`/api/journal/entries/recent?${params.toString()}`);
    const remoteEntries = data?.entries ?? [];
    const localEntries = await getLocalFinishedJournalEntries(studentNumber);
    const entries = mergeJournalEntryLists(remoteEntries, localEntries).slice(0, windowDays);
    const todayIso = getTodayIsoDate();
    const currentMonth = todayIso.slice(0, 7);

    for (const entry of remoteEntries) {
      const record = await getLocalJournalRecord(studentNumber, entry.id);
      if (record) continue;
      await upsertLocalJournalRecord(studentNumber, {
        adminFlagReason: null,
        aiEnabled: false,
        concernTags: [],
        contentText: entry.preview || entry.summary || "",
        createdAt: entry.createdAt,
        entryDate: entry.entryDate,
        finishedAt: null,
        id: entry.id,
        insights: [],
        isFinished: Boolean(entry.isFinished),
        preview: entry.preview,
        riskLevel: "NONE",
        summary: entry.summary || entry.preview || "",
        title: entry.title,
        updatedAt: entry.createdAt,
      }, buildPreviewJournalMessages(entry), "synced");
    }

    return {
      ok: response.ok,
      entries,
      message: data?.message,
      progress: data?.progress ?? {
        monthlyCount: entries.filter((entry) => entry.entryDate.startsWith(currentMonth)).length,
        todayCount: entries.filter((entry) => entry.entryDate === todayIso).length,
        totalCount: entries.length,
      },
    };
  } catch {
    const entries = (await getLocalFinishedJournalEntries(studentNumber)).slice(0, windowDays);
    const todayIso = getTodayIsoDate();
    const currentMonth = todayIso.slice(0, 7);
    return {
      ok: true,
      entries,
      message: "Showing entries saved on this device.",
      progress: {
        monthlyCount: entries.filter((entry) => entry.entryDate.startsWith(currentMonth)).length,
        todayCount: entries.filter((entry) => entry.entryDate === todayIso).length,
        totalCount: entries.length,
      },
    };
  }
}

export async function fetchJournalEntryById(
  studentNumber: string,
  entryId: string,
): Promise<
  ApiResult & {
    entry?: JournalEntry | null;
    messages?: JournalMessage[];
  }
> {
  if (entryId.startsWith("local-")) {
    const record = await getLocalJournalRecord(studentNumber, entryId);
    const localMessages = normalizeJournalMessages(record?.messages);
    const messages = localMessages.length ? localMessages : buildPreviewJournalMessages(record?.entry);
    return {
      ok: Boolean(record),
      message: record ? "Loaded offline journal entry." : "Unable to load this offline entry.",
      entry: record?.entry ?? null,
      messages,
    };
  }

  try {
    await syncPendingJournalEntries(studentNumber);
    const params = new URLSearchParams({ studentNumber });
    const { response, data } = await get(`/api/journal/entries/${entryId}?${params.toString()}`);
    const localRecord = await getLocalJournalRecord(studentNumber, entryId);
    const remoteMessages = normalizeJournalMessages(data?.messages);
    const localMessages = normalizeJournalMessages(localRecord?.messages);
    const responseMessages = remoteMessages.length > 0
      ? remoteMessages
      : localMessages.length > 0
        ? localMessages
        : buildPreviewJournalMessages(data?.entry);
    if (response.ok) {
      await upsertLocalJournalRecord(studentNumber, data?.entry ?? null, responseMessages);
    }

    return {
      ok: response.ok,
      message: data?.message,
      entry: data?.entry ?? null,
      messages: responseMessages,
    };
  } catch {
    const record = await getLocalJournalRecord(studentNumber, entryId);
    const localMessages = normalizeJournalMessages(record?.messages);
    const messages = localMessages.length ? localMessages : buildPreviewJournalMessages(record?.entry);
    return {
      ok: Boolean(record),
      message: record ? "Loaded journal entry saved on this device." : "Unable to load this journal entry offline.",
      entry: record?.entry ?? null,
      messages,
    };
  }
}

export async function rateJournalEntrySummary(payload: {
  entryId: string;
  rating: "HELPFUL" | "NEEDS_WORK";
  reason?: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry | null }> {
  const { entryId, ...body } = payload;
  const { response, data } = await post(`/api/journal/entries/${entryId}/summary-rating`, body);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry ?? null,
  };
}

export async function deleteJournalEntry(
  studentNumber: string,
  entryId: string,
): Promise<ApiResult> {
  if (entryId.startsWith("local-")) {
    await removeLocalJournalRecord(studentNumber, entryId);
    return { ok: true };
  }

  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await del(`/api/journal/entries/${entryId}?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
  };
}

export async function fetchJournalEntriesByDate(
  studentNumber: string,
  date: string,
): Promise<
  ApiResult & {
    date?: string;
    entries?: Array<{
      createdAt: string;
      entryDate: string;
      id: string;
      isFinished?: boolean;
      insights?: string[];
      preview: string;
      summary: string;
      title: string;
    }>;
  }
> {
  const params = new URLSearchParams({
    studentNumber,
    date,
  });
  try {
    await syncPendingJournalEntries(studentNumber);
    const { response, data } = await get(`/api/journal/entries/by-date?${params.toString()}`);

    if (!response.ok) {
      const fallback = await fetchRecentJournalEntries(studentNumber, 366);
      const filteredEntries = (fallback.entries ?? []).filter((entry) => entry.entryDate === date);

      return {
        ok: fallback.ok,
        message: fallback.message,
        date,
        entries: filteredEntries,
      };
    }

    const localEntries = (await getLocalFinishedJournalEntries(studentNumber)).filter((entry) => entry.entryDate === date);
    const remoteEntries = data?.entries ?? [];
    for (const entry of remoteEntries) {
      const record = await getLocalJournalRecord(studentNumber, entry.id);
      if (record) continue;
      await upsertLocalJournalRecord(studentNumber, {
        adminFlagReason: null,
        aiEnabled: false,
        concernTags: [],
        contentText: entry.preview || entry.summary || "",
        createdAt: entry.createdAt,
        entryDate: entry.entryDate,
        finishedAt: null,
        id: entry.id,
        insights: Array.isArray(entry.insights) ? entry.insights : [],
        isFinished: Boolean(entry.isFinished),
        preview: entry.preview,
        riskLevel: "NONE",
        summary: entry.summary || entry.preview || "",
        title: entry.title,
        updatedAt: entry.createdAt,
      }, buildPreviewJournalMessages(entry), "synced");
    }

    const entries = mergeJournalEntryLists(remoteEntries, localEntries);
    return {
      ok: response.ok,
      message: data?.message,
      date: data?.date,
      entries,
    };
  } catch {
    return {
      ok: true,
      message: "Showing entries saved on this device.",
      date,
      entries: (await getLocalFinishedJournalEntries(studentNumber)).filter((entry) => entry.entryDate === date),
    };
  }
}

export async function fetchJournalCalendar(
  studentNumber: string,
  year: number,
): Promise<
  ApiResult & {
    entryCountsByMonth?: Record<string, Record<string, number>>;
    writtenDaysByMonth?: Record<string, number[]>;
    year?: number;
  }
> {
  const params = new URLSearchParams({
    studentNumber,
    year: String(year),
  });
  try {
    await syncPendingJournalEntries(studentNumber);
    const { response, data } = await get(`/api/journal/entries/calendar?${params.toString()}`);

    const writtenDaysByMonth = data?.writtenDaysByMonth ?? {};
    const entryCountsByMonth =
      data?.entryCountsByMonth ??
      Object.fromEntries(
        Object.entries(writtenDaysByMonth).map(([monthKey, days]) => [
          monthKey,
          Object.fromEntries(
            (Array.isArray(days) ? days : []).map((day) => [String(day), 1]),
          ),
        ]),
      );

    const localEntries = (await getLocalFinishedJournalEntries(studentNumber)).filter((entry) =>
      entry.entryDate.startsWith(`${year}-`),
    );
    for (const entry of localEntries) {
      const [, monthText, dayText] = entry.entryDate.split("-");
      const monthKey = String(Number(monthText) - 1);
      const day = Number(dayText);
      const monthDays = new Set<number>(writtenDaysByMonth[monthKey] ?? []);
      monthDays.add(day);
      writtenDaysByMonth[monthKey] = Array.from(monthDays).sort((a, b) => a - b);
      entryCountsByMonth[monthKey] = {
        ...(entryCountsByMonth[monthKey] ?? {}),
        [String(day)]: Number(entryCountsByMonth[monthKey]?.[String(day)] ?? 0) + 1,
      };
    }

    return {
      entryCountsByMonth,
      ok: response.ok,
      message: data?.message,
      writtenDaysByMonth,
      year: data?.year,
    };
  } catch {
    const writtenDaysByMonth: Record<string, number[]> = {};
    const entryCountsByMonth: Record<string, Record<string, number>> = {};
    const localEntries = (await getLocalFinishedJournalEntries(studentNumber)).filter((entry) =>
      entry.entryDate.startsWith(`${year}-`),
    );
    for (const entry of localEntries) {
      const [, monthText, dayText] = entry.entryDate.split("-");
      const monthKey = String(Number(monthText) - 1);
      const day = Number(dayText);
      const monthDays = new Set<number>(writtenDaysByMonth[monthKey] ?? []);
      monthDays.add(day);
      writtenDaysByMonth[monthKey] = Array.from(monthDays).sort((a, b) => a - b);
      entryCountsByMonth[monthKey] = {
        ...(entryCountsByMonth[monthKey] ?? {}),
        [String(day)]: Number(entryCountsByMonth[monthKey]?.[String(day)] ?? 0) + 1,
      };
    }

    return {
      entryCountsByMonth,
      ok: true,
      message: "Showing journal dates saved on this device.",
      writtenDaysByMonth,
      year,
    };
  }
}

export async function fetchAppointmentCounselors(): Promise<
  ApiResult & {
    concernOptions?: string[];
    concernSubcategories?: Record<string, string[]>;
    counselors?: CounselorDirectoryItem[];
    peerConcernOptions?: string[];
    slotTimes?: Array<{ label: string; value: string }>;
  }
> {
  const { response, data } = await get("/api/appointments/counselors");

  return {
    ok: response.ok,
    message: data?.message,
    concernOptions: data?.concernOptions ?? [],
    concernSubcategories: data?.concernSubcategories ?? {},
    counselors: data?.counselors ?? [],
    peerConcernOptions: data?.peerConcernOptions ?? [],
    slotTimes: data?.slotTimes ?? [],
  };
}

export async function fetchAppointmentAvailability(
  counselorId: string,
  month: string,
  studentNumber?: string,
  supportType?: "GUIDANCE" | "PEER",
): Promise<
  ApiResult & {
    counselor?: CounselorDirectoryItem;
    days?: Array<{
      availableSlots: Array<{ available: boolean; booked: boolean; enabled: boolean; label: string; time: string }>;
      blockedByLeadTime?: boolean;
      blockedByStudentSchedule?: boolean;
      date: string;
      dayLabel: string;
      dayNumber: number;
      dayOfWeek: number;
      isPast: boolean;
      slots: Array<{ available: boolean; blockedByLeadTime?: boolean; booked: boolean; enabled: boolean; label: string; time: string }>;
    }>;
    month?: string;
  }
> {
  const params = new URLSearchParams({
    counselorId,
    month,
  });
  if (supportType) {
    params.set("supportType", supportType);
  }
  if (studentNumber) {
    params.set("studentNumber", studentNumber);
  }
  const { response, data } = await get(`/api/appointments/availability?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    counselor: data?.counselor,
    days: data?.days ?? [],
    month: data?.month,
  };
}

export async function bookCounselorAppointment(payload: {
  appointmentDate: string;
  concern: string;
  counselorGenderPreference: string;
  counselorId: string;
  slotTime: string;
  studentNote?: string;
  studentNumber: string;
  supportType?: "GUIDANCE" | "PEER";
}): Promise<ApiResult & { appointment?: CounselorAppointment }> {
  const { response, data } = await post("/api/appointments/book", payload as unknown as Record<string, unknown>);

  return {
    ok: response.ok,
    message: data?.message,
    appointment: data?.appointment,
  };
}

export async function fetchStudentAppointments(
  studentNumber: string,
): Promise<ApiResult & { appointments?: CounselorAppointment[]; upcomingAppointment?: CounselorAppointment | null }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/appointments/student?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    appointments: data?.appointments ?? [],
    upcomingAppointment: data?.upcomingAppointment ?? null,
  };
}

export async function fetchStudentNotifications(
  studentNumber: string,
  category?: StudentNotificationCategory,
): Promise<ApiResult & { notifications?: AppNotification[]; unreadCount?: number }> {
  const params = new URLSearchParams({ studentNumber });
  if (category) {
    params.set("category", category);
  }
  const { response, data } = await get(`/api/appointments/notifications?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    notifications: data?.notifications ?? [],
    unreadCount: Number(data?.unreadCount ?? 0),
  };
}

export async function markStudentNotificationRead(
  studentNumber: string,
  notificationId: string,
): Promise<ApiResult> {
  const { response, data } = await post(`/api/appointments/notifications/${notificationId}/read`, { studentNumber });

  return {
    ok: response.ok,
    message: data?.message,
  };
}

export async function markAllStudentNotificationsRead(
  studentNumber: string,
  category?: StudentNotificationCategory,
): Promise<ApiResult> {
  const { response, data } = await post("/api/appointments/notifications/read-all", { studentNumber, category });

  return {
    ok: response.ok,
    message: data?.message,
  };
}

export async function deleteStudentNotification(
  studentNumber: string,
  notificationId: string,
): Promise<ApiResult> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await del(`/api/appointments/notifications/${notificationId}?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
  };
}

export async function fetchFutureSelfMessage(
  studentNumber: string,
): Promise<ApiResult & { futureSelfMessage?: FutureSelfMessage | null }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/future-self/messages/current?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    futureSelfMessage: data?.futureSelfMessage ?? null,
  };
}

export async function saveFutureSelfMessage(payload: {
  deliveryAt: string;
  id: string;
  message: string;
  studentNumber: string;
}): Promise<ApiResult & { futureSelfMessage?: FutureSelfMessage | null }> {
  const { response, data } = await post("/api/future-self/messages", payload);

  return {
    ok: response.ok,
    message: data?.message,
    futureSelfMessage: data?.futureSelfMessage ?? null,
  };
}

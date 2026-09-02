import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type AuthUser = {
  email: string;
  firstName: string;
  fullName: string;
  profilePictureUrl?: string;
  studentNumber: string;
  token?: string;
};

export type StudentProfile = {
  barangay: string;
  birthdate: string;
  city: string;
  email: string;
  fullName: string;
  gender?: string;
  program: string;
  profilePictureUrl: string;
  province: string;
  region: string;
  street: string;
  studentNumber: string;
};

export type StudentProfilePicturePayload = {
  contentType: "image/jpeg" | "image/png";
  dataUrl: string;
  fileName: string;
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

export type FeedbackAttachmentPayload = {
  contentType: string;
  dataUrl: string;
  fileName: string;
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
  counselingType?: string;
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
  route?: string;
  timeLabel: string;
  title: string;
};

export type StudentNotificationCategory = "guidance" | "messages" | "notifications" | "peer" | "future-self" | "other";

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

type StoredStudentPreferences = {
  journalLockPin?: string | null;
  pendingPreferences?: (Partial<StudentPreferences> & { journalLockPin?: string }) | null;
  preferences?: StudentPreferences | null;
  syncStatus?: "pending" | "synced";
  updatedAt?: string;
};

const LOCAL_JOURNAL_STORAGE_PREFIX = "bawattala.localJournal.";
const LOCAL_MOOD_STORAGE_PREFIX = "bawattala.localMoods.";
const LOCAL_CHECKIN_STORAGE_PREFIX = "bawattala.localCheckIns.";
const LOCAL_PREFERENCES_STORAGE_PREFIX = "bawattala.localPreferences.";
const DAILY_CHECKIN_REWARDS = [10, 20, 30, 50, 70, 100, 150];
const DEFAULT_STUDENT_PREFERENCES: StudentPreferences = {
  hasJournalLockPin: false,
  journalLockAutoLock: true,
  journalLockEnabled: false,
  notificationPreviewsEnabled: true,
  privateJournalModeEnabled: true,
};

function getLocalJournalStorageKey(studentNumber: string) {
  return `${LOCAL_JOURNAL_STORAGE_PREFIX}${studentNumber}`;
}

function getLocalMoodStorageKey(studentNumber: string) {
  return `${LOCAL_MOOD_STORAGE_PREFIX}${studentNumber}`;
}

function getLocalCheckInStorageKey(studentNumber: string) {
  return `${LOCAL_CHECKIN_STORAGE_PREFIX}${studentNumber}`;
}

function getLocalPreferencesStorageKey(studentNumber: string) {
  return `${LOCAL_PREFERENCES_STORAGE_PREFIX}${studentNumber}`;
}

function looksLikePlaintextJournalPin(value: string) {
  return /^\d{4,8}$/.test(value);
}

function sha256Hex(message: string) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const bytes: number[] = [];
  for (let index = 0; index < message.length; index += 1) {
    const code = message.charCodeAt(index);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }
  bytes.push(
    (bitLenHi >>> 24) & 0xff,
    (bitLenHi >>> 16) & 0xff,
    (bitLenHi >>> 8) & 0xff,
    bitLenHi & 0xff,
    (bitLenLo >>> 24) & 0xff,
    (bitLenLo >>> 16) & 0xff,
    (bitLenLo >>> 8) & 0xff,
    bitLenLo & 0xff,
  );

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Array<number>(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = ((bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(7, words[index - 15]) ^ rotr(18, words[index - 15]) ^ (words[index - 15] >>> 3);
      const s1 = rotr(17, words[index - 2]) ^ rotr(19, words[index - 2]) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[index] + words[index]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, "0")).join("");
}

function hashJournalLockPin(studentNumber: string, pin: string) {
  return sha256Hex(`${studentNumber}\0${pin}`);
}

function looksLikeJournalPinHash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function toCachedJournalLockPin(studentNumber: string, pin: string) {
  return looksLikeJournalPinHash(pin) ? pin : hashJournalLockPin(studentNumber, pin);
}

function storedJournalLockPinMatches(studentNumber: string, stored: string | null | undefined, pin: string) {
  if (!stored || !pin) {
    return false;
  }
  if (stored === hashJournalLockPin(studentNumber, pin)) {
    return true;
  }
  return looksLikePlaintextJournalPin(stored) && stored === pin;
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
    entryDate: getManilaTodayIsoDate(),
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
} | null): JournalMessage[] {
  const preview = String(entry?.contentText || entry?.preview || "")
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
  const hasAssistantMessages = nextMessages.some((message) => message.role === "assistant");
  const nextEntry = {
    ...(existingRecord?.entry ?? {}),
    ...entry,
    aiEnabled: Boolean(entry.aiEnabled || existingRecord?.entry?.aiEnabled || hasAssistantMessages),
    syncStatus,
  };
  data.entries[entry.id] = {
    entry: nextEntry,
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

function normalizeStudentPreferences(value?: Partial<StudentPreferences> | null): StudentPreferences {
  return {
    hasJournalLockPin: Boolean(value?.hasJournalLockPin),
    journalLockAutoLock:
      value?.journalLockAutoLock === undefined
        ? DEFAULT_STUDENT_PREFERENCES.journalLockAutoLock
        : Boolean(value.journalLockAutoLock),
    journalLockEnabled: Boolean(value?.journalLockEnabled),
    notificationPreviewsEnabled:
      value?.notificationPreviewsEnabled === undefined
        ? DEFAULT_STUDENT_PREFERENCES.notificationPreviewsEnabled
        : Boolean(value.notificationPreviewsEnabled),
    privateJournalModeEnabled:
      value?.privateJournalModeEnabled === undefined
        ? DEFAULT_STUDENT_PREFERENCES.privateJournalModeEnabled
        : Boolean(value.privateJournalModeEnabled),
  };
}

async function readLocalStudentPreferences(studentNumber: string): Promise<StoredStudentPreferences> {
  const storedValue = await AsyncStorage.getItem(getLocalPreferencesStorageKey(studentNumber));
  if (!storedValue) return {};

  try {
    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalStudentPreferences(studentNumber: string, data: StoredStudentPreferences) {
  await AsyncStorage.setItem(getLocalPreferencesStorageKey(studentNumber), JSON.stringify({
    ...data,
    updatedAt: getNowIsoString(),
  }));
}

async function cacheStudentPreferences(
  studentNumber: string,
  preferences?: Partial<StudentPreferences> | null,
  journalLockPin?: string,
  syncStatus: "pending" | "synced" = "synced",
  pendingPreferences?: StoredStudentPreferences["pendingPreferences"],
) {
  const current = await readLocalStudentPreferences(studentNumber);
  const normalized = normalizeStudentPreferences({
    ...(current.preferences ?? DEFAULT_STUDENT_PREFERENCES),
    ...(preferences ?? {}),
  });
  await writeLocalStudentPreferences(studentNumber, {
    ...current,
    journalLockPin:
      journalLockPin !== undefined
        ? journalLockPin
          ? toCachedJournalLockPin(studentNumber, journalLockPin)
          : journalLockPin
        : normalized.hasJournalLockPin
          ? current.journalLockPin ?? null
          : null,
    pendingPreferences:
      pendingPreferences === undefined
        ? current.pendingPreferences ?? null
        : pendingPreferences,
    preferences: normalized,
    syncStatus,
  });
}

function omitRawJournalPins<T extends Record<string, unknown>>(value: T): Omit<T, "journalLockPin" | "previousJournalLockPin"> {
  const next = { ...value } as T & {
    journalLockPin?: unknown;
    previousJournalLockPin?: unknown;
  };
  delete next.journalLockPin;
  delete next.previousJournalLockPin;
  return next;
}

async function syncPendingStudentPreferences(studentNumber: string) {
  const local = await readLocalStudentPreferences(studentNumber);
  if (local.syncStatus !== "pending" || !local.pendingPreferences) {
    return true;
  }

  try {
    const { response, data } = await patch("/api/auth/preferences", {
      ...omitRawJournalPins(local.pendingPreferences as Record<string, unknown>),
    });
    if (!response.ok) {
      return false;
    }

    await cacheStudentPreferences(
      studentNumber,
      data?.preferences ?? local.preferences ?? DEFAULT_STUDENT_PREFERENCES,
      local.journalLockPin ?? undefined,
      "synced",
      null,
    );
    return true;
  } catch {
    return false;
  }
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

export async function syncOfflineStudentData(studentNumber: string): Promise<ApiResult> {
  try {
    const [preferencesSynced, checkInsSynced] = await Promise.all([
      syncPendingStudentPreferences(studentNumber),
      syncPendingCheckIns(studentNumber),
    ]);
    await syncPendingMoodEntries(studentNumber);
    await syncPendingJournalEntries(studentNumber);

    return {
      ok: preferencesSynced && checkInsSynced,
      message:
        preferencesSynced && checkInsSynced
          ? "Offline data synced."
          : "Some offline data is still waiting to sync.",
    };
  } catch {
    return {
      ok: false,
      message: "Offline data will sync when your connection returns.",
    };
  }
}

let activeAuthToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  activeAuthToken = token;
}

export function getApiAuthToken() {
  return activeAuthToken;
}

function buildHeaders(customHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...customHeaders };
  if (activeAuthToken) {
    headers["Authorization"] = `Bearer ${activeAuthToken}`;
  }
  return headers;
}

async function get(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: buildHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function del(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: buildHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function patch(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function buildLibraryBookFileUrl(studentNumber: string, bookId: string) {
  const params = new URLSearchParams({ bookId, studentNumber });
  return `${API_BASE_URL}/api/library/download-file?${params.toString()}`;
}

export async function sendOtp(email: string): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/send-otp", { email });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
}

export async function loginWithStudentId(
  studentNumber: string,
  password: string,
): Promise<ApiResult & { user?: AuthUser }> {
  try {
    const { response, data } = await post("/api/auth/login", {
      studentNumber,
      password,
    });
    if (response.ok && data?.token) {
      setApiAuthToken(data.token);
      if (data?.user) {
        data.user.token = data.token;
      }
    }
    return { ok: response.ok, message: data?.message, user: data?.user };
  } catch {
    return {
      ok: false,
      message: "Unable to reach the server. Please check your connection and try again.",
    };
  }
}

export async function fetchStudentProfile(
  _studentNumber?: string,
): Promise<ApiResult & { profile?: StudentProfile | null }> {
  const { response, data } = await get("/api/auth/profile");

  return {
    ok: response.ok,
    message: data?.message,
    profile: data?.profile ?? null,
  };
}

export async function fetchStudentPreferences(
  studentNumber: string,
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  try {
    await syncPendingStudentPreferences(studentNumber);
    const { response, data } = await get("/api/auth/preferences");

    if (response.ok && data?.preferences) {
      await cacheStudentPreferences(studentNumber, data.preferences);
    }

    return {
      ok: response.ok,
      message: data?.message,
      preferences: data?.preferences ?? null,
    };
  } catch {
    const local = await readLocalStudentPreferences(studentNumber);
    return {
      ok: Boolean(local.preferences),
      message: local.preferences ? "Showing preferences saved on this device." : "Unable to load preferences offline.",
      preferences: local.preferences ?? null,
    };
  }
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
    currentJournalLockPin?: string;
    journalLockPin?: string;
    previousJournalLockPin?: string;
  },
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  try {
    await syncPendingStudentPreferences(studentNumber);
    const isExplicitPinSet = typeof preferences.journalLockPin === "string" && preferences.journalLockPin.length > 0;
    const preferencePayload: Record<string, unknown> = {
      ...omitRawJournalPins(preferences as Record<string, unknown>),
    };
    if (isExplicitPinSet) {
      preferencePayload.journalLockPin = preferences.journalLockPin;
    }
    if (preferences.previousJournalLockPin) {
      preferencePayload.previousJournalLockPin = preferences.previousJournalLockPin;
    }
    if (preferences.currentJournalLockPin) {
      preferencePayload.currentJournalLockPin = preferences.currentJournalLockPin;
    }
    const { response, data } = await patch("/api/auth/preferences", preferencePayload);

    if (response.ok && data?.preferences) {
      await cacheStudentPreferences(studentNumber, data.preferences, preferences.journalLockPin);
    }

    return {
      ok: response.ok,
      message: data?.message,
      preferences: data?.preferences ?? null,
    };
  } catch {
    const local = await readLocalStudentPreferences(studentNumber);
    if (
      preferences.previousJournalLockPin &&
      !storedJournalLockPinMatches(studentNumber, local.journalLockPin, preferences.previousJournalLockPin)
    ) {
      return { ok: false, message: "Previous PIN does not match this device." };
    }

    const nextPreferences = normalizeStudentPreferences({
      ...(local.preferences ?? DEFAULT_STUDENT_PREFERENCES),
      ...preferences,
      hasJournalLockPin:
        preferences.journalLockPin !== undefined || local.preferences?.hasJournalLockPin === true,
      journalLockEnabled:
        preferences.journalLockEnabled ??
        local.preferences?.journalLockEnabled ??
        DEFAULT_STUDENT_PREFERENCES.journalLockEnabled,
    });
    if (preferences.journalLockPin !== undefined) {
      nextPreferences.hasJournalLockPin = true;
    }
    if (preferences.journalLockEnabled === false) {
      nextPreferences.journalLockEnabled = false;
    }

    const pendingPreferences = omitRawJournalPins({ ...preferences } as Record<string, unknown>) as StoredStudentPreferences["pendingPreferences"];

    await cacheStudentPreferences(
      studentNumber,
      nextPreferences,
      preferences.journalLockPin,
      "pending",
      pendingPreferences,
    );

    return {
      ok: true,
      message: "Saved on this device. It will sync when your connection returns.",
      preferences: nextPreferences,
    };
  }
}

export async function verifyJournalLockPin(
  studentNumber: string,
  pin: string,
): Promise<ApiResult & { unlocked?: boolean }> {
  try {
    const { response, data } = await post("/api/auth/preferences/journal-lock/verify", {
      pin,
    });

    if (response.ok && data?.unlocked) {
      const local = await readLocalStudentPreferences(studentNumber);
      await cacheStudentPreferences(
        studentNumber,
        local.preferences ?? { hasJournalLockPin: true, journalLockEnabled: true },
        pin,
        local.syncStatus ?? "synced",
        local.pendingPreferences,
      );
    }

    return {
      ok: response.ok,
      message: data?.message,
      unlocked: Boolean(data?.unlocked),
    };
  } catch {
    const local = await readLocalStudentPreferences(studentNumber);
    const unlocked = storedJournalLockPinMatches(studentNumber, local.journalLockPin, pin);
    if (unlocked && local.journalLockPin && looksLikePlaintextJournalPin(local.journalLockPin)) {
      await cacheStudentPreferences(
        studentNumber,
        local.preferences ?? { hasJournalLockPin: true, journalLockEnabled: true },
        pin,
        local.syncStatus ?? "synced",
        local.pendingPreferences,
      );
    }
    return {
      ok: unlocked,
      message: unlocked
        ? "Unlocked with the PIN saved on this device."
        : "Connect once after setting your PIN so this device can unlock your journal offline.",
      unlocked,
    };
  }
}

export async function sendJournalLockResetCode(): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/reset/send-code", {});
  return {
    ok: response.ok,
    message: data?.message ?? (response.ok ? "Verification code sent to your email." : "Unable to send the verification code."),
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
}

export async function resendJournalLockResetCode(): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/reset/resend-code", {});
  return {
    ok: response.ok,
    message: data?.message ?? (response.ok ? "A new verification code was sent." : "Unable to resend the verification code."),
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
}

export async function verifyJournalLockResetCode(
  token: string,
): Promise<ApiResult> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/reset/verify-code", {
    token,
  });
  return {
    ok: response.ok,
    message: data?.message,
  };
}

export async function resetJournalLockWithEmailCode(
  studentNumber: string,
  journalLockPin: string,
): Promise<ApiResult & { preferences?: StudentPreferences | null }> {
  const { response, data } = await post("/api/auth/preferences/journal-lock/reset", {
    journalLockPin,
  });

  if (response.ok && data?.preferences) {
    await cacheStudentPreferences(studentNumber, data.preferences, journalLockPin, "synced", null);
  }

  return {
    ok: response.ok,
    message: data?.message,
    preferences: data?.preferences ?? null,
  };
}

export async function fetchStudentReferral(
  _studentNumber?: string,
): Promise<ApiResult & { referral?: StudentReferral | null }> {
  const { response, data } = await get("/api/auth/referral");

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
  email: string,
): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/forgot-password/send-code", {
    email,
    studentNumber,
  });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
}

export async function profilePasswordSendCode(
  studentNumber: string,
  email: string,
): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/profile-password/send-code", {
    studentNumber,
    email,
  });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
}

export async function forgotPasswordResendCode(
  studentNumber: string,
): Promise<ApiResult & { resendAfterSeconds?: number }> {
  const { response, data } = await post("/api/auth/forgot-password/resend-code", {
    studentNumber,
  });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
  };
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
}): Promise<ApiResult & { token?: string; user?: AuthUser }> {
  const { response, data } = await post(
    "/api/auth/register-profile",
    payload as unknown as Record<string, string>,
  );
  if (response.ok && data?.token) {
    setApiAuthToken(data.token);
  }
  return { ok: response.ok, message: data?.message, token: data?.token, user: data?.user };
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

export async function submitStudentFeedback(payload: {
  attachment?: FeedbackAttachmentPayload | null;
  category: string;
  message: string;
  studentNumber?: string;
  subject?: string;
  title?: string;
  submissionType?: "FEEDBACK" | "SUPPORT";
}): Promise<ApiResult> {
  const { studentNumber: _studentNumber, subject, title, submissionType, ...rest } = payload;
  const resolvedSubject = (subject ?? title)?.trim();
  const feedbackBody = {
    ...rest,
    submissionType: submissionType ?? "FEEDBACK",
    ...(resolvedSubject ? { subject: resolvedSubject } : {}),
  };
  const { response, data } = await post("/api/feedback", feedbackBody);
  const isSupport = (submissionType ?? "FEEDBACK") === "SUPPORT";
  return {
    ok: response.ok,
    message:
      data?.message ??
      (response.ok
        ? isSupport
          ? "Support request sent."
          : "Feedback sent."
        : isSupport
          ? "Unable to send support request."
          : "Unable to send feedback."),
  };
}

export async function saveDailyMood(
  studentNumber: string,
  moodId: string,
  moodDate?: string,
  moodSource: MoodSource = "INPUT",
): Promise<ApiResult & { entry?: MoodEntryRecord }> {
  const effectiveMoodDate = moodDate || getManilaTodayIsoDate();
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
    const effectiveMoodDate = moodDate || getManilaTodayIsoDate();
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
  searchQuery?: string,
): Promise<ApiResult & { books?: LibraryBookRecord[]; totalItems?: number }> {
  const params = new URLSearchParams({ maxResults: "24" });
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
  studentNumber?: string;
}): Promise<ApiResult & { alreadyDownloaded?: boolean; download?: { bookId: string; downloadedAt?: string | null; downloadUrl?: string } | null }> {
  const { studentNumber, ...downloadBody } = payload;
  const { response, data } = await post("/api/library/download", downloadBody as unknown as Record<string, unknown>);
  const download = data?.download
    ? {
        ...data.download,
        downloadUrl: studentNumber
          ? buildLibraryBookFileUrl(studentNumber, data.download.bookId ?? payload.bookId)
          : (data.download.downloadUrl ?? payload.downloadUrl),
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
  const params = new URLSearchParams({ bookId });
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
  const params = new URLSearchParams();
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
  studentNumber?: string;
  totalPages: number;
}): Promise<ApiResult & { progress?: LibraryBookProgress | null }> {
  const { studentNumber: _studentNumber, ...progressBody } = payload;
  const { response, data } = await post("/api/library/progress", progressBody);

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
  const { studentNumber: _rewardStudent, ...rewardBody } = payload;
  const { response, data } = await post("/api/library/reading-reward", rewardBody);

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
  const { response, data } = await get("/api/library/reading-reward/status");

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
  studentNumber?: string;
  totalPages: number;
}): Promise<ApiResult & { progress?: LibraryBookProgress | null }> {
  const { studentNumber: _studentNumber, ...ratingBody } = payload;
  const { response, data } = await post("/api/library/rating", ratingBody);

  return {
    ok: response.ok,
    message: data?.message,
    progress: data?.progress ?? null,
  };
}


export type MuniLoadoutRecord = {
  background: string | null;
  eye: string | null;
  head: string | null;
  outfit: string | null;
};

export type MuniOwnedItemsRecord = {
  background: string[];
  eye: string[];
  head: string[];
  outfit: string[];
};

export async function fetchMuniWardrobe(
  studentNumber: string,
): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/muni/wardrobe?${params.toString()}`);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
  };
}

export async function purchaseMuniWardrobeItem(payload: {
  itemId: string;
  sectionId: string;
  studentNumber: string;
}): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const { response, data } = await post("/api/muni/purchase", payload);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
  };
}

export async function saveMuniLoadoutRemote(payload: {
  loadout: MuniLoadoutRecord;
  studentNumber: string;
}): Promise<
  ApiResult & {
    loadout?: MuniLoadoutRecord;
    ownedItems?: MuniOwnedItemsRecord;
    totalTala?: number;
  }
> {
  const { response, data } = await patch("/api/muni/loadout", payload);
  return {
    ok: response.ok,
    message: data?.message,
    loadout: data?.loadout,
    ownedItems: data?.ownedItems,
    totalTala: typeof data?.totalTala === "number" ? data.totalTala : undefined,
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
      .filter((record) => record.entry.entryDate === getManilaTodayIsoDate() && !record.entry.isFinished)
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
  messages?: JournalMessage[];
  requireExistingEntry?: boolean;
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
      messages: payload.messages ?? [],
      requireExistingEntry: payload.requireExistingEntry === true,
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
    const submittedMessages = normalizeJournalMessages(payload.messages);
    if (payload.requireExistingEntry && !existingRecord && submittedMessages.length === 0) {
      return {
        ok: false,
        message: "Voice journal session was not found on this device.",
        messages: [],
      };
    }
    const entry = existingRecord?.entry ?? createLocalJournalEntry(payload.studentNumber, payload.aiEnabled);
    const now = getNowIsoString();
    const messages = [
      ...(submittedMessages.length ? submittedMessages : existingRecord?.messages ?? []),
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
  forceAnalyze?: boolean;
  messages?: JournalMessage[];
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
    const submittedMessages = normalizeJournalMessages(payload.messages);
    const messages = submittedMessages.length ? submittedMessages : record.messages;
    const summary = record.entry.summary || summarizeLocalMessages(messages);
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
    await upsertLocalJournalRecord(payload.studentNumber, entry, messages, "pending");
    return {
      ok: true,
      message: "Saved offline. This entry will sync when your connection returns.",
      entry,
      messages,
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
    windowDays: String(windowDays),
  });
  try {
    await syncPendingJournalEntries(studentNumber);
    const { response, data } = await get(`/api/journal/entries/recent?${params.toString()}`);
    const remoteEntries = data?.entries ?? [];
    const localEntries = await getLocalFinishedJournalEntries(studentNumber);
    const entries = mergeJournalEntryLists(remoteEntries, localEntries).slice(0, windowDays);
    const todayIso = getManilaTodayIsoDate();
    const currentMonth = todayIso.slice(0, 7);

    for (const entry of remoteEntries) {
      const record = await getLocalJournalRecord(studentNumber, entry.id);
      if (record) continue;
      await upsertLocalJournalRecord(studentNumber, {
        adminFlagReason: null,
        aiEnabled: false,
        concernTags: [],
        contentText: entry.preview || "",
        createdAt: entry.createdAt,
        entryDate: entry.entryDate,
        finishedAt: null,
        id: entry.id,
        insights: [],
        isFinished: Boolean(entry.isFinished),
        preview: entry.preview,
        riskLevel: "NONE",
        summary: entry.summary || "",
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
    const todayIso = getManilaTodayIsoDate();
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
    if (!response.ok) {
      const fallbackMessages = localMessages.length ? localMessages : buildPreviewJournalMessages(localRecord?.entry);
      return {
        ok: Boolean(localRecord),
        message: localRecord ? "Loaded journal entry saved on this device." : data?.message,
        entry: localRecord?.entry ?? null,
        messages: fallbackMessages,
      };
    }
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
        contentText: entry.preview || "",
        createdAt: entry.createdAt,
        entryDate: entry.entryDate,
        finishedAt: null,
        id: entry.id,
        insights: Array.isArray(entry.insights) ? entry.insights : [],
        isFinished: Boolean(entry.isFinished),
        preview: entry.preview,
        riskLevel: "NONE",
        summary: entry.summary || "",
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
  counselingType?: string;
  counselorGenderPreference: string;
  counselorId: string;
  slotTime: string;
  studentNote?: string;
  studentNumber?: string;
  supportType?: "GUIDANCE" | "PEER";
}): Promise<ApiResult & { appointment?: CounselorAppointment }> {
  const { studentNumber: _studentNumber, ...bookBody } = payload;
  const { response, data } = await post("/api/appointments/book", bookBody as unknown as Record<string, unknown>);

  return {
    ok: response.ok,
    message: data?.message,
    appointment: data?.appointment,
  };
}

export async function fetchStudentAppointments(
  _studentNumber?: string,
): Promise<ApiResult & { appointments?: CounselorAppointment[]; upcomingAppointment?: CounselorAppointment | null }> {
  try {
    const { response, data } = await get("/api/appointments/student");

    return {
      ok: response.ok,
      message: data?.message,
      appointments: data?.appointments ?? [],
      upcomingAppointment: data?.upcomingAppointment ?? null,
    };
  } catch {
    return {
      ok: false,
      message: "Unable to load appointments while offline.",
      appointments: [],
      upcomingAppointment: null,
    };
  }
}

export async function fetchStudentNotifications(
  studentNumber: string,
  category?: StudentNotificationCategory,
): Promise<ApiResult & { notifications?: AppNotification[]; unreadCount?: number; totalCount?: number }> {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  try {
    const inbox = await get(`/api/inbox?${params.toString()}`);
    const inboxItems = Array.isArray(inbox.data?.notifications)
      ? inbox.data.notifications
      : Array.isArray(inbox.data?.items)
        ? inbox.data.items
        : null;
    if (inbox.response.ok && inboxItems) {
      return {
        ok: true,
        message: inbox.data?.message,
        notifications: inboxItems,
        unreadCount: Number(inbox.data?.unreadCount ?? 0),
        totalCount: Number(inbox.data?.totalCount ?? inboxItems.length),
      };
    }
  } catch {
    // Fall through to the appointments inbox until GET /api/inbox is live.
  }
  try {
    const { response, data } = await get(`/api/appointments/notifications?${params.toString()}`);

    return {
      ok: response.ok,
      message: data?.message,
      notifications: data?.notifications ?? [],
      unreadCount: Number(data?.unreadCount ?? 0),
      totalCount: Number(data?.totalCount ?? (data?.notifications ?? []).length),
    };
  } catch {
    return {
      ok: false,
      message: "Unable to load notifications while offline.",
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
    };
  }
}

export type StudentMessageThreadItem = {
  body: string;
  createdAt: string;
  from?: unknown;
  id: string;
  isRead?: boolean;
};

export type StudentMessageThread = {
  counselorId: string;
  counselorName?: string;
  messages: StudentMessageThreadItem[];
  photoUrl?: string;
  pictureUrl?: string;
};

function parseStudentMessageThread(data: any, fallbackId: string): StudentMessageThread | null {
  const payload = data?.thread ?? data;
  if (!payload || typeof payload !== "object") return null;
  const messagesRaw = payload.messages ?? payload.items ?? payload.notifications;
  const messages = Array.isArray(messagesRaw)
    ? messagesRaw
        .map((entry: any, index: number) => {
          const body = String(entry?.body ?? entry?.message ?? entry?.text ?? "").trim();
          if (!body) return null;
          return {
            body,
            createdAt: String(entry?.createdAt ?? ""),
            from: entry?.from,
            id: String(entry?.id ?? `${fallbackId}:${index}`),
            isRead: typeof entry?.isRead === "boolean" ? entry.isRead : undefined,
          } as StudentMessageThreadItem;
        })
        .filter(Boolean) as StudentMessageThreadItem[]
    : [];
  return {
    counselorId: String(payload.counselorId ?? fallbackId),
    counselorName: typeof payload.counselorName === "string" ? payload.counselorName : undefined,
    messages,
    photoUrl: typeof payload.photoUrl === "string" ? payload.photoUrl : undefined,
    pictureUrl: typeof payload.pictureUrl === "string" ? payload.pictureUrl : undefined,
  };
}

export async function fetchStudentMessageThread(
  counselorId: string,
): Promise<ApiResult & { thread?: StudentMessageThread | null }> {
  const encoded = encodeURIComponent(counselorId);
  const paths = [`/api/inbox/threads/${encoded}`, `/api/appointments/notifications/threads/${encoded}`];
  for (const path of paths) {
    try {
      const { response, data } = await get(path);
      if (!response.ok) continue;
      const thread = parseStudentMessageThread(data, counselorId);
      if (thread) {
        return { ok: true, message: data?.message, thread };
      }
    } catch {
      // Try the appointments alias next.
    }
  }
  return { ok: false, thread: null };
}

export async function markStudentMessageThreadRead(
  counselorId: string,
): Promise<ApiResult> {
  const encoded = encodeURIComponent(counselorId);
  const paths = [`/api/inbox/threads/${encoded}/read`, `/api/appointments/notifications/threads/${encoded}/read`];
  for (const path of paths) {
    try {
      const { response, data } = await post(path, {});
      if (response.ok) {
        return { ok: true, message: data?.message };
      }
    } catch {
      // Try the appointments alias next.
    }
  }
  return { ok: false };
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

export async function fetchFutureSelfMessages(
  studentNumber: string,
): Promise<ApiResult & { futureSelfMessages?: FutureSelfMessage[] }> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/future-self/messages?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    futureSelfMessages: Array.isArray(data?.futureSelfMessages) ? data.futureSelfMessages : [],
  };
}

export async function saveFutureSelfMessage(payload: {
  deliveryAt: string;
  id?: string;
  message: string;
  studentNumber: string;
}): Promise<ApiResult & { futureSelfMessage?: FutureSelfMessage | null }> {
  const { response, data } = await post("/api/future-self/messages", {
    deliveryAt: payload.deliveryAt,
    message: payload.message,
  });

  return {
    ok: response.ok,
    message: data?.message,
    futureSelfMessage: data?.futureSelfMessage ?? null,
  };
}

export async function updateFutureSelfMessage(
  id: string,
  payload: { deliveryAt?: string; message?: string },
): Promise<ApiResult & { futureSelfMessage?: FutureSelfMessage | null }> {
  const encodedId = encodeURIComponent(id);
  let response: Response;
  let data: any;
  try {
    ({ response, data } = await patch(`/api/future-self/messages/${encodedId}`, payload));
    if (response.status === 404) {
      ({ response, data } = await patch(`/api/future-self/${encodedId}`, payload));
    }
  } catch {
    return { ok: false, message: "Unable to update this letter right now." };
  }

  return {
    ok: response.ok,
    message: data?.message,
    futureSelfMessage: data?.futureSelfMessage ?? null,
  };
}

export async function deleteFutureSelfMessage(id: string): Promise<ApiResult> {
  const encodedId = encodeURIComponent(id);
  try {
    let { response, data } = await del(`/api/future-self/messages/${encodedId}`);
    if (response.status === 404) {
      ({ response, data } = await del(`/api/future-self/${encodedId}`));
    }
    return {
      ok: response.ok,
      message: data?.message,
    };
  } catch {
    return { ok: false, message: "Unable to delete this letter right now." };
  }
}

export async function updateStudentProfilePicture(
  studentNumber: string,
  uploadedProfilePicture: StudentProfilePicturePayload,
): Promise<ApiResult & { profilePictureUrl?: string }> {
  try {
    const { response, data } = await patch("/api/auth/profile-picture", {
      uploadedProfilePicture,
    });

    return {
      ok: response.ok,
      message: data?.message,
      profilePictureUrl: data?.profilePictureUrl || "",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach the server. Please check your connection and try again.",
    };
  }
}

export async function clearStudentProfilePicture(): Promise<ApiResult & { profilePictureUrl?: string }> {
  try {
    const deleted = await del("/api/auth/profile-picture");
    if (deleted.response.ok) {
      return {
        ok: true,
        message: deleted.data?.message,
        profilePictureUrl: deleted.data?.profilePictureUrl || "",
      };
    }
    const { response, data } = await patch("/api/auth/profile-picture", {
      uploadedProfilePicture: null,
    });
    return {
      ok: response.ok,
      message: data?.message,
      profilePictureUrl: data?.profilePictureUrl || "",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach the server. Please check your connection and try again.",
    };
  }
}

export async function updateStudentProfile(payload: {
  barangay?: string;
  birthdate?: string;
  city?: string;
  fullName?: string;
  gender?: string;
  program?: string;
  province?: string;
  region?: string;
  street?: string;
}): Promise<ApiResult & { profile?: StudentProfile | null }> {
  const { response, data } = await patch("/api/auth/profile", payload);
  return {
    ok: response.ok,
    message: data?.message,
    profile: data?.profile ?? null,
  };
}

export async function sendProfileEmailChangeCode(
  newEmail: string,
): Promise<ApiResult & { resendAfterSeconds?: number; stage?: string }> {
  const { response, data } = await post("/api/auth/profile/email-change/send-code", { newEmail });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
    stage: data?.stage,
  };
}

export async function resendProfileEmailChangeCode(): Promise<ApiResult & { resendAfterSeconds?: number; stage?: string }> {
  const { response, data } = await post("/api/auth/profile/email-change/resend-code", {});
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
    stage: data?.stage,
  };
}

export async function verifyProfileEmailChangeCode(
  token: string,
): Promise<ApiResult & { resendAfterSeconds?: number; stage?: string }> {
  const { response, data } = await post("/api/auth/profile/email-change/verify-code", { token });
  return {
    ok: response.ok,
    message: data?.message,
    resendAfterSeconds: Number(data?.resendAfterSeconds ?? 0) || undefined,
    stage: data?.stage,
  };
}

export async function confirmProfileEmailChange(
  token: string,
): Promise<ApiResult & { profile?: StudentProfile | null; stage?: string }> {
  const { response, data } = await post("/api/auth/profile/email-change/confirm", { token });
  return {
    ok: response.ok,
    message: data?.message,
    profile: data?.profile ?? null,
    stage: data?.stage,
  };
}


export async function transcribeAudio(payload: {
  audioBase64: string;
  filename?: string;
  mimeType?: string;
}): Promise<ApiResult & { language?: string; text?: string }> {
  const { response, data } = await post("/api/voice/transcribe", payload);
  return {
    ok: response.ok,
    message: data?.message,
    language: data?.language || "",
    text: data?.text || "",
  };
}

export async function synthesizeVoiceSpeech(payload: {
  pitch?: string;
  rate?: string;
  text: string;
  voice?: string;
}): Promise<
  ApiResult & {
    audioBase64?: string;
    contentType?: string;
    language?: string;
    voice?: string;
  }
> {
  const { response, data } = await post("/api/voice/speak", payload);
  return {
    ok: response.ok,
    message: data?.message,
    audioBase64: data?.audioBase64 || "",
    contentType: data?.contentType || "audio/mp3",
    language: data?.language || "",
    voice: data?.voice || "",
  };
}


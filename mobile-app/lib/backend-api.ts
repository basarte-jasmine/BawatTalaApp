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
  createdAt: string;
  entryDate: string;
  finishedAt: string | null;
  id: string;
  insights: string[];
  isFinished: boolean;
  primaryConcern?: string | null;
  riskLevel: "HIGH" | "LOW" | "NONE";
  summary: string;
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
    role: string;
  };
  createdAt?: string;
  decisionDueAt?: string | null;
  id: string;
  slotLabel: string;
  slotTime: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  studentNote?: string;
};

export type CounselorDirectoryItem = {
  email: string;
  fullName: string;
  gender: string;
  id: string;
  pictureUrl: string;
  role: string;
  specialties: string[];
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
): Promise<ApiResult & { entry?: { moodDate: string; moodId: string; moodLabel: string } }> {
  const { response, data } = await post("/api/moods", {
    studentNumber,
    moodId,
    moodDate: moodDate ?? "",
  });

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry,
  };
}

export async function fetchDailyMood(
  studentNumber: string,
  moodDate?: string,
): Promise<ApiResult & { entry?: { moodDate: string; moodId: string; moodLabel: string } | null }> {
  const params = new URLSearchParams({ studentNumber });
  if (moodDate) {
    params.set("moodDate", moodDate);
  }
  const { response, data } = await get(`/api/moods/today?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry ?? null,
  };
}

export async function fetchMonthlyMoods(
  studentNumber: string,
  year: number,
  month: number,
): Promise<
  ApiResult & {
    counts?: Record<string, number>;
    entries?: Array<{ moodDate: string; moodId: string; moodLabel: string }>;
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
  const { response, data } = await get(`/api/moods/month?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    counts: data?.counts,
    entries: data?.entries,
    mostCommonMoodId: data?.mostCommonMoodId ?? null,
    mostCommonMoodLabel: data?.mostCommonMoodLabel ?? null,
    totalCheckIns: data?.totalCheckIns ?? 0,
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
  const { response, data } = await get(`/api/checkins/status?${params.toString()}`);

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
  }
> {
  const { response, data } = await post("/api/checkins", { studentNumber });

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
}

export async function fetchTodayJournalSession(
  studentNumber: string,
): Promise<
  ApiResult & {
    entry?: JournalEntry | null;
    messages?: JournalMessage[];
  }
> {
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/journal/session/today?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry ?? null,
    messages: data?.messages ?? [],
  };
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
  const { response, data } = await post("/api/journal/session/create", {
    aiEnabled: payload.aiEnabled,
    forceNew: payload.forceNew === true,
    studentNumber: payload.studentNumber,
  });

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry ?? null,
    messages: data?.messages ?? [],
  };
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
  const { response, data } = await post("/api/journal/message", {
    aiEnabled: payload.aiEnabled,
    entryId: payload.entryId ?? "",
    message: payload.message,
    studentNumber: payload.studentNumber,
  });

  return {
    ok: response.ok,
    aiReply: data?.aiReply ?? null,
    entry: data?.entry,
    message: data?.message,
    messages: data?.messages ?? [],
  };
}

export async function finishJournalEntry(payload: {
  concernTags?: string[];
  entryId: string;
  primaryConcern?: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry }> {
  const { response, data } = await post("/api/journal/session/finish", payload);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry,
  };
}

export async function suggestJournalTags(payload: {
  entryId: string;
  studentNumber: string;
}): Promise<ApiResult & { entry?: JournalEntry; suggestedTags?: string[]; tagOptions?: string[] }> {
  const { response, data } = await post("/api/journal/session/tag-suggestions", payload);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry,
    suggestedTags: Array.isArray(data?.suggestedTags) ? data.suggestedTags : [],
    tagOptions: Array.isArray(data?.tagOptions) ? data.tagOptions : [],
  };
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
  const { response, data } = await get(`/api/journal/entries/recent?${params.toString()}`);

  return {
    ok: response.ok,
    entries: data?.entries ?? [],
    message: data?.message,
    progress: data?.progress,
  };
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
  const params = new URLSearchParams({ studentNumber });
  const { response, data } = await get(`/api/journal/entries/${entryId}?${params.toString()}`);

  return {
    ok: response.ok,
    message: data?.message,
    entry: data?.entry ?? null,
    messages: data?.messages ?? [],
  };
}

export async function rateJournalEntrySummary(payload: {
  entryId: string;
  rating: "HELPFUL" | "NEEDS_WORK";
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

  return {
    ok: response.ok,
    message: data?.message,
    date: data?.date,
    entries: data?.entries ?? [],
  };
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

  return {
    entryCountsByMonth,
    ok: response.ok,
    message: data?.message,
    writtenDaysByMonth,
    year: data?.year,
  };
}

export async function fetchAppointmentCounselors(): Promise<
  ApiResult & {
    concernOptions?: string[];
    concernSubcategories?: Record<string, string[]>;
    counselors?: CounselorDirectoryItem[];
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
    slotTimes: data?.slotTimes ?? [],
  };
}

export async function fetchAppointmentAvailability(
  counselorId: string,
  month: string,
  studentNumber?: string,
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
): Promise<ApiResult & { notifications?: AppNotification[]; unreadCount?: number }> {
  const params = new URLSearchParams({ studentNumber });
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
): Promise<ApiResult> {
  const { response, data } = await post("/api/appointments/notifications/read-all", { studentNumber });

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

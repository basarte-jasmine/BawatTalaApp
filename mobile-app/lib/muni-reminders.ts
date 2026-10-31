import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getManilaNow, getManilaTodayParts } from "./manila-date";
import {
  recordStudentMuniActivity,
  fetchMuniRemindersPreference,
  saveMuniRemindersPreference,
} from "./backend-api";

type MuniReminderPreference = {
  enabled: boolean;
  notificationIds: string[];
  updatedAt: string;
};

type WeatherReminderCategory = "clear" | "clouds" | "rain" | "snow" | "thunder";

type WeatherReminderContext = {
  category: WeatherReminderCategory;
  isDay: boolean;
  savedAt: number;
};

type ReminderTemplate = {
  hour: number;
  id: string;
  minute: number;
  route: string;
  title: string;
  body: (name: string) => string;
};

export type DailyRhythmKind = "morning" | "midday" | "evening";

export type DailyRhythmInfo = {
  badge: string;
  kind: DailyRhythmKind;
  label: string;
  muniMessage: string;
  timeWindow: string;
  title: string;
};

export const INACTIVITY_DAYS = 4;

export const INACTIVITY_REMINDER_TEMPLATE = {
  id: "muni-reconnect-inactivity",
  title: "Muni is just thinking of you ☁️",
  body: (name: string) =>
    (name ? "Hi " + name + " — n" : "N") +
    "o streaks to maintain, no pressure. Muni left a warm cup of cocoa on your desk.",
  route: "/home?reconnect=cocoa",
};

export const COZY_AMBIENT_REMINDER_TEMPLATE = {
  id: "muni-cozy-ambient",
  route: "/wellness-tools?mood=cozy",
};

export async function saveWeatherReminderContext(
  category: WeatherReminderCategory,
  isDay: boolean,
) {
  await AsyncStorage.setItem(
    WEATHER_REMINDER_CONTEXT_KEY,
    JSON.stringify({ category, isDay, savedAt: Date.now() } satisfies WeatherReminderContext),
  );
}

async function getWeatherReminderCopy(name: string) {
  const fallback = {
    title: "A cozy moment or a quiet break? 🌤️",
    body: (name ? name + ", stay" : "Stay") +
      " cozy. Muni has peaceful nature and ocean sounds ready whenever you want a breather.",
  };

  try {
    const raw = await AsyncStorage.getItem(WEATHER_REMINDER_CONTEXT_KEY);
    if (!raw) return fallback;
    const context = JSON.parse(raw) as Partial<WeatherReminderContext>;
    if (
      typeof context.savedAt !== "number" ||
      Date.now() - context.savedAt > 6 * 60 * 60 * 1000 ||
      typeof context.category !== "string"
    ) {
      return fallback;
    }

    const prefix = name ? name + ", " : "";
    switch (context.category) {
      case "rain":
        return {
          title: "A rainy little pause 🌧️",
          body: prefix + "it’s gloomy outside, but you can still make a little space for yourself today.",
        };
      case "thunder":
        return {
          title: "Loud skies, soft moments ⛈️",
          body: prefix + "the storm may be loud, but you can take things one calm breath at a time.",
        };
      case "clouds":
        return {
          title: "A softer sky today ☁️",
          body: prefix + "cloudy days are still worth noticing. Take the day gently.",
        };
      case "clear":
        return {
          title: "A little sunshine for you ☀️",
          body: prefix + "the skies are bright today. I hope you find a little brightness within you too.",
        };
      case "snow":
        return {
          title: "Keep cozy today 🧣",
          body: prefix + "the air is chilly, so take your time and be extra kind to yourself.",
        };
      default:
        return fallback;
    }
  } catch {
    return fallback;
  }
}

export function getInactivityTriggerDate(days = INACTIVITY_DAYS, now = new Date()): Date {
  const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return getNextManilaTriggerDate(14, 30, targetDate);
}

export function getNextWeekendTriggerDate(now = new Date()): Date {
  const manilaDate = getManilaNow(now);
  const currentDayOfWeek = manilaDate.getDay();
  let daysUntilWeekend = 0;
  if (currentDayOfWeek === 6) {
    daysUntilWeekend = 1;
  } else if (currentDayOfWeek === 0) {
    daysUntilWeekend = 6;
  } else {
    daysUntilWeekend = 6 - currentDayOfWeek;
  }
  const target = new Date(now.getTime() + daysUntilWeekend * 24 * 60 * 60 * 1000);
  return getNextManilaTriggerDate(14, 0, target);
}

const LAST_ACTIVE_STORAGE_KEY = "bawat-tala.lastActiveAt";

export async function recordLastActiveTimestamp(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_STORAGE_KEY, new Date().toISOString());
    try {
      await recordStudentMuniActivity();
    } catch {
      // Activity tracking is optional and must not interrupt Home when the API is unavailable.
    }
  } catch {}
}

export async function checkDaysSinceLastActive(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ACTIVE_STORAGE_KEY);
    const localDiff = raw ? Math.max(0, Math.floor((Date.now() - new Date(raw).getTime()) / (24 * 60 * 60 * 1000))) : 0;
    try {
      const serverRes = await fetchMuniRemindersPreference();
      if (serverRes.ok && typeof serverRes.daysInactive === "number") {
        if (serverRes.lastActiveAt) {
          await AsyncStorage.setItem(LAST_ACTIVE_STORAGE_KEY, serverRes.lastActiveAt);
        }
        return serverRes.daysInactive;
      }
    } catch {}
    return localDiff;
  } catch {
    return 0;
  }
}

const MUNI_REMINDER_STORAGE_PREFIX = "bawat-tala.muniReminders.";
const WEATHER_REMINDER_CONTEXT_KEY = "bawat-tala.weatherReminderContext";

export const DAILY_RHYTHM_TEMPLATES: ReminderTemplate[] = [
  {
    id: "morning-check-in",
    hour: 8,
    minute: 30,
    route: "/home",
    title: "A little light for your morning ☀️",
    body: (name) =>
      (name ? name + ", e" : "E") + "ven when the skies feel heavy, don’t forget to be a little ray of sunshine, Dearie.",
  },
  {
    id: "midday-transition",
    hour: 13,
    minute: 30,
    route: "/home",
    title: "A gentle weather note from Muni 🌱",
    body: (name) =>
      (name ? name + ", w" : "W") + "hatever the weather brings, you can take one gentle moment for yourself.",
  },
  {
    id: "evening-journal",
    hour: 20,
    minute: 30,
    route: "/home",
    title: "A cozy sky for your evening ✨",
    body: (name) =>
      (name ? name + ", l" : "L") + "et the quiet sky remind you: you deserve a soft place to land tonight.",
  },
];

const MUNI_REMINDER_IDS = new Set([
  ...DAILY_RHYTHM_TEMPLATES.map((template) => template.id),
  INACTIVITY_REMINDER_TEMPLATE.id,
  COZY_AMBIENT_REMINDER_TEMPLATE.id,
]);

export function getDailyRhythmInfo(date = new Date(), preferredKind?: string | null): DailyRhythmInfo {
  if (preferredKind === "morning" || preferredKind === "midday" || preferredKind === "evening") {
    return getDailyRhythmByKind(preferredKind);
  }

  const manilaDate = getManilaNow(date);
  const hour = manilaDate.getHours();

  if (hour >= 5 && hour < 12) {
    return getDailyRhythmByKind("morning");
  }
  if (hour >= 12 && hour < 18) {
    return getDailyRhythmByKind("midday");
  }
  return getDailyRhythmByKind("evening");
}

export function getDailyRhythmByKind(kind: DailyRhythmKind): DailyRhythmInfo {
  switch (kind) {
    case "morning":
      return {
        kind: "morning",
        label: "Morning Anchor",
        timeWindow: "8:00 AM – 9:00 AM",
        badge: "☀️ Morning Anchor",
        title: "Magandang umaga from Muni ☀️",
        muniMessage: "Before the day gets noisy, how’s your heart feeling this morning?",
      };
    case "midday":
      return {
        kind: "midday",
        label: "Midday Transition",
        timeWindow: "1:00 PM – 2:00 PM",
        badge: "🌱 Midday Transition",
        title: "Heavy morning classes? 🌱",
        muniMessage: "Drop your school bag for a second. Even a 30-second exhale counts.",
      };
    case "evening":
    default:
      return {
        kind: "evening",
        label: "Evening Wind-Down",
        timeWindow: "8:30 PM – 9:30 PM",
        badge: "✨ Evening Wind-Down",
        title: "Muni saved a quiet space for you ✨",
        muniMessage: "Done with homework or tasks? Let’s close the tabs in your head before bed.",
      };
  }
}

function getReminderStorageKey(studentNumber: string) {
  return MUNI_REMINDER_STORAGE_PREFIX + studentNumber;
}

function normalizeName(value?: string | null) {
  const name = String(value || "").trim().split(/\s+/)[0];
  return name || "friend";
}

// Compute the exact UTC instant of the next Manila wall-clock HH:MM.
// expo-notifications calendar triggers fire in the device timezone, which can differ
// from Asia/Manila, so reminders are scheduled as exact dates instead.
function getNextManilaTriggerDate(hour: number, minute: number, now = new Date()): Date {
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const todayParts = getManilaTodayParts(now);
  const [year, month, day] = todayParts.isoDate.split("-").map(Number);
  const todayTargetMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const nextMs =
    todayTargetMs > manilaNowMs
      ? todayTargetMs
      : todayTargetMs + 24 * 60 * 60 * 1000;
  return new Date(nextMs - 8 * 60 * 60 * 1000);
}

async function loadStoredPreference(studentNumber: string): Promise<MuniReminderPreference> {
  const storedValue = await AsyncStorage.getItem(getReminderStorageKey(studentNumber));
  if (!storedValue) {
    let systemGranted = false;
    const Notifications = await getNotificationsModule();
    if (Notifications) {
      try {
        const perms = await Notifications.getPermissionsAsync();
        systemGranted = Boolean(perms.granted);
      } catch {}
    }
    const initialPref: MuniReminderPreference = {
      enabled: systemGranted,
      notificationIds: [],
      updatedAt: new Date().toISOString(),
    };
    if (systemGranted) {
      await saveStoredPreference(studentNumber, initialPref);
    }
    return initialPref;
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<MuniReminderPreference>;
    return {
      enabled: Boolean(parsed.enabled),
      notificationIds: Array.isArray(parsed.notificationIds)
        ? parsed.notificationIds.filter((id): id is string => typeof id === "string")
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { enabled: false, notificationIds: [], updatedAt: new Date().toISOString() };
  }
}

async function saveStoredPreference(
  studentNumber: string,
  preference: Pick<MuniReminderPreference, "enabled" | "notificationIds">,
) {
  await AsyncStorage.setItem(
    getReminderStorageKey(studentNumber),
    JSON.stringify({ ...preference, updatedAt: new Date().toISOString() }),
  );
  void saveMuniRemindersPreference(preference);
}

async function getNotificationsModule() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
}

async function cancelReminderIds(notificationIds: string[]) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const ids = new Set(notificationIds);
  for (const item of pending) {
    const identifier =
      (item as { identifier?: string; id?: string }).identifier ||
      (item as { identifier?: string; id?: string }).id ||
      "";
    const reminderId = (item as { content?: { data?: { reminderId?: unknown } } }).content?.data?.reminderId;
    if (identifier && (ids.has(identifier) || (typeof reminderId === "string" && MUNI_REMINDER_IDS.has(reminderId)))) {
      ids.add(identifier);
    }
  }

  await Promise.all(
    Array.from(ids, (id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
}

export async function getMuniRemindersEnabled(studentNumber: string) {
  const preference = await loadStoredPreference(studentNumber);
  return preference.enabled;
}

export async function disableMuniReminders(studentNumber: string) {
  const preference = await loadStoredPreference(studentNumber);
  await cancelReminderIds(preference.notificationIds);
  await saveStoredPreference(studentNumber, { enabled: false, notificationIds: [] });
}

export async function scheduleMuniReminders(studentNumber: string, firstName?: string | null) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await saveStoredPreference(studentNumber, { enabled: false, notificationIds: [] });
    return { ok: false, message: "Phone reminders are only available in the mobile app." };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("muni-reminders", {
      name: "Muni reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    await disableMuniReminders(studentNumber);
    return { ok: false, message: "Notification permission was not granted." };
  }

  const existingPreference = await loadStoredPreference(studentNumber);
  await cancelReminderIds(existingPreference.notificationIds);

  const name = normalizeName(firstName);
  const now = new Date();
  const dailyIds = await Promise.all(
    DAILY_RHYTHM_TEMPLATES.map((template) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: template.title,
          body: template.body(name),
          data: { route: template.route, reminderId: template.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: Platform.OS === "android" ? "muni-reminders" : undefined,
          date: getNextManilaTriggerDate(template.hour, template.minute, now),
        },
      }),
    ),
  );

  const inactivityId = await Notifications.scheduleNotificationAsync({
    content: {
      title: INACTIVITY_REMINDER_TEMPLATE.title,
      body: INACTIVITY_REMINDER_TEMPLATE.body(name),
      data: {
        route: INACTIVITY_REMINDER_TEMPLATE.route,
        reminderId: INACTIVITY_REMINDER_TEMPLATE.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: Platform.OS === "android" ? "muni-reminders" : undefined,
      date: getInactivityTriggerDate(INACTIVITY_DAYS, now),
    },
  }).catch(() => null);

  const weatherReminder = await getWeatherReminderCopy(name);
  const cozyId = await Notifications.scheduleNotificationAsync({
    content: {
      title: weatherReminder.title,
      body: weatherReminder.body,
      data: {
        route: COZY_AMBIENT_REMINDER_TEMPLATE.route,
        reminderId: COZY_AMBIENT_REMINDER_TEMPLATE.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: Platform.OS === "android" ? "muni-reminders" : undefined,
      date: getNextWeekendTriggerDate(now),
    },
  }).catch(() => null);

  const notificationIds = [
    ...dailyIds,
    ...(inactivityId ? [inactivityId] : []),
    ...(cozyId ? [cozyId] : []),
  ];

  await saveStoredPreference(studentNumber, { enabled: true, notificationIds });
  return { ok: true, message: "Muni reminders are on." };
}

export async function syncMuniReminderSchedule(studentNumber: string, firstName?: string | null) {
  const preference = await loadStoredPreference(studentNumber);
  if (!preference.enabled) return;

  // Skip churn when the pending notifications already cover future Manila slots.
  const Notifications = await getNotificationsModule();
  if (Notifications) {
    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      const pendingById = new Set(pending.map((item) => (item as { identifier?: string; id?: string }).identifier || (item as { identifier?: string; id?: string }).id || ""));
      const stillCovered =
        preference.notificationIds.length > 0 &&
        preference.notificationIds.every((id) => pendingById.has(id));
      if (stillCovered) return;
    } catch {
      // Fall through to a full reschedule.
    }
  }

  await scheduleMuniReminders(studentNumber, firstName);
}

export async function configureMuniNotificationBehavior() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestInitialNotificationPermissions(): Promise<{ granted: boolean }> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return { granted: false };

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("muni-reminders", {
        name: "Muni reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return { granted: true };
    }

    if (current.canAskAgain !== false) {
      const requested = await Notifications.requestPermissionsAsync();
      return { granted: Boolean(requested.granted) };
    }

    return { granted: false };
  } catch (error) {
    console.warn("Failed to request initial notification permissions:", error);
    return { granted: false };
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type MuniReminderPreference = {
  enabled: boolean;
  notificationIds: string[];
  updatedAt: string;
};

type ReminderTemplate = {
  hour: number;
  id: string;
  minute: number;
  route: string;
  title: string;
  body: (name: string) => string;
};

const MUNI_REMINDER_STORAGE_PREFIX = "bawat-tala.muniReminders.";

const REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    id: "morning-check-in",
    hour: 8,
    minute: 30,
    route: "/home",
    title: "Muni is checking in",
    body: (name) => `Good morning, ${name}. How are you feeling as today begins?`,
  },
  {
    id: "late-afternoon-breathe",
    hour: 17,
    minute: 30,
    route: "/wellness-breathing",
    title: "A soft pause with Muni",
    body: (name) => `${name}, take one quiet minute with Muni before the day moves on.`,
  },
  {
    id: "evening-journal",
    hour: 20,
    minute: 30,
    route: "/journal",
    title: "Muni saved space for you",
    body: (name) => `Want to journal for a bit, ${name}? Muni is here to listen.`,
  },
];

function getReminderStorageKey(studentNumber: string) {
  return `${MUNI_REMINDER_STORAGE_PREFIX}${studentNumber}`;
}

function normalizeName(value?: string | null) {
  const name = String(value || "").trim().split(/\s+/)[0];
  return name || "friend";
}

async function loadStoredPreference(studentNumber: string): Promise<MuniReminderPreference> {
  const storedValue = await AsyncStorage.getItem(getReminderStorageKey(studentNumber));
  if (!storedValue) {
    return { enabled: false, notificationIds: [], updatedAt: new Date().toISOString() };
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
}

async function getNotificationsModule() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
}

async function cancelReminderIds(notificationIds: string[]) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Promise.all(
    notificationIds.map((id) =>
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
  const notificationIds = await Promise.all(
    REMINDER_TEMPLATES.map((template) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: template.title,
          body: template.body(name),
          data: { route: template.route, reminderId: template.id },
        },
        trigger: {
          channelId: Platform.OS === "android" ? "muni-reminders" : undefined,
          hour: template.hour,
          minute: template.minute,
          repeats: true,
        } as any,
      }),
    ),
  );

  await saveStoredPreference(studentNumber, { enabled: true, notificationIds });
  return { ok: true, message: "Muni reminders are on." };
}

export async function syncMuniReminderSchedule(studentNumber: string, firstName?: string | null) {
  const preference = await loadStoredPreference(studentNumber);
  if (!preference.enabled) return;

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

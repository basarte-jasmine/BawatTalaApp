import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchAdminSettings } from "./admin-api";

export const DEFAULT_ADMIN_PREFERENCES = {
  notifications: {
    appointmentUpdates: true,
    cancellationAlerts: true,
    dailyDigest: false,
    emailAlerts: true,
    mobilePush: true,
  },
  appearance: {
    compactCards: false,
    highlightUnread: true,
    reduceMotion: false,
    theme: "light",
  },
  privacy: {
    maskStudentNumbers: false,
    requireCancelReason: true,
  },
};

const AdminPreferencesContext = createContext({
  preferences: DEFAULT_ADMIN_PREFERENCES,
  setPreferences: () => {},
  loading: false,
});

function normalizePreferences(value) {
  const notifications = value?.notifications || {};
  const appearance = value?.appearance || {};
  const privacy = value?.privacy || {};

  return {
    notifications: {
      appointmentUpdates: notifications.appointmentUpdates !== false,
      cancellationAlerts: notifications.cancellationAlerts !== false,
      dailyDigest: Boolean(notifications.dailyDigest),
      emailAlerts: notifications.emailAlerts !== false,
      mobilePush: notifications.mobilePush !== false,
    },
    appearance: {
      compactCards: Boolean(appearance.compactCards),
      highlightUnread: appearance.highlightUnread !== false,
      reduceMotion: Boolean(appearance.reduceMotion),
      theme: "light",
    },
    privacy: {
      maskStudentNumbers: Boolean(privacy.maskStudentNumbers),
      requireCancelReason: privacy.requireCancelReason !== false,
    },
  };
}

export function maskStudentNumber(value, shouldMask = false) {
  const raw = String(value || "").trim();
  if (!shouldMask || !raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 2) return raw;
  return `${digits.slice(0, 2)}-****`;
}

export function useAdminPreferences() {
  return useContext(AdminPreferencesContext);
}

export function AdminPreferencesProvider({ children, session }) {
  const [preferences, setPreferencesState] = useState(DEFAULT_ADMIN_PREFERENCES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.email) {
      setPreferencesState(DEFAULT_ADMIN_PREFERENCES);
      return undefined;
    }

    let isMounted = true;
    async function loadPreferences() {
      try {
        setLoading(true);
        const data = await fetchAdminSettings();
        if (isMounted) {
          setPreferencesState(normalizePreferences(data?.preferences));
        }
      } catch (_error) {
        if (isMounted) {
          setPreferencesState(DEFAULT_ADMIN_PREFERENCES);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [session?.email]);

  const value = useMemo(
    () => ({
      preferences,
      loading,
      setPreferences(nextPreferences) {
        setPreferencesState(normalizePreferences(nextPreferences));
      },
    }),
    [loading, preferences],
  );

  return (
    <AdminPreferencesContext.Provider value={value}>
      {children}
    </AdminPreferencesContext.Provider>
  );
}

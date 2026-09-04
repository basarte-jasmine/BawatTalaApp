import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchAdminSettings } from "./admin-api";

const DEFAULT_MATRIX = {
  highRiskFlagged: { inApp: true, email: true },
  newAppointmentBookings: { inApp: true, email: true },
  cancellationsReschedules: { inApp: true, email: true },
  upcomingSessionReminder: { inApp: true, email: true },
  studentNoShow: { inApp: true, email: true },
  activityDigest: { inApp: false, email: false },
  systemMaintenance: { inApp: true, email: true },
};

export const DEFAULT_ADMIN_PREFERENCES = {
  notifications: {
    receiveEmail: true,
    receiveInApp: true,
    matrix: {
      highRiskFlagged: { ...DEFAULT_MATRIX.highRiskFlagged },
      newAppointmentBookings: { ...DEFAULT_MATRIX.newAppointmentBookings },
      cancellationsReschedules: { ...DEFAULT_MATRIX.cancellationsReschedules },
      upcomingSessionReminder: { ...DEFAULT_MATRIX.upcomingSessionReminder },
      studentNoShow: { ...DEFAULT_MATRIX.studentNoShow },
      activityDigest: { ...DEFAULT_MATRIX.activityDigest },
      systemMaintenance: { ...DEFAULT_MATRIX.systemMaintenance },
    },
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

function asBool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeChannel(raw, defaults) {
  const channel = raw && typeof raw === "object" ? raw : {};
  return {
    inApp: asBool(channel.inApp, defaults.inApp),
    email: asBool(channel.email, defaults.email),
  };
}

function normalizeNotifications(rawNotifications) {
  const notifications = rawNotifications && typeof rawNotifications === "object" ? rawNotifications : {};
  const matrixSrc = notifications.matrix && typeof notifications.matrix === "object" ? notifications.matrix : null;
  const hasMatrix = Boolean(matrixSrc);
  const matrix = matrixSrc || {};

  const legacyAppointment = notifications.appointmentUpdates !== false;
  const legacyCancellation = notifications.cancellationAlerts !== false;
  const legacyDigest = Boolean(notifications.dailyDigest);
  const legacyEmail = notifications.emailAlerts !== false;
  const legacyMobile = notifications.mobilePush !== false;

  const highRiskFlagged = normalizeChannel(matrix.highRiskFlagged, { inApp: true, email: true });
  highRiskFlagged.inApp = true;

  return {
    receiveEmail: asBool(notifications.receiveEmail, legacyEmail),
    receiveInApp: asBool(notifications.receiveInApp, hasMatrix ? true : legacyMobile),
    matrix: {
      highRiskFlagged,
      newAppointmentBookings:
        hasMatrix && matrix.newAppointmentBookings
          ? normalizeChannel(matrix.newAppointmentBookings, { inApp: true, email: true })
          : { inApp: legacyAppointment, email: legacyAppointment },
      cancellationsReschedules:
        hasMatrix && matrix.cancellationsReschedules
          ? normalizeChannel(matrix.cancellationsReschedules, { inApp: true, email: true })
          : { inApp: legacyCancellation, email: legacyCancellation },
      upcomingSessionReminder:
        hasMatrix && matrix.upcomingSessionReminder
          ? normalizeChannel(matrix.upcomingSessionReminder, { inApp: true, email: true })
          : { inApp: legacyAppointment, email: legacyAppointment },
      studentNoShow:
        hasMatrix && matrix.studentNoShow
          ? normalizeChannel(matrix.studentNoShow, { inApp: true, email: true })
          : { inApp: legacyAppointment, email: legacyAppointment },
      activityDigest:
        hasMatrix && matrix.activityDigest
          ? normalizeChannel(matrix.activityDigest, { inApp: false, email: false })
          : { inApp: legacyDigest, email: legacyDigest },
      systemMaintenance:
        hasMatrix && matrix.systemMaintenance
          ? normalizeChannel(matrix.systemMaintenance, { inApp: true, email: true })
          : { inApp: true, email: true },
    },
  };
}

function normalizePreferences(value) {
  const privacy = value?.privacy || {};

  return {
    notifications: normalizeNotifications(value?.notifications),
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
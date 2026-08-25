import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../lib/auth-session";
import { fetchStudentAppointments, type CounselorAppointment } from "../../lib/backend-api";
import { CounselorAvatar } from "./CounselorAvatar";

type AppointmentSnapshot = {
  appointmentDate: string;
  appointmentDateLabel: string;
  concern: string;
  counselorFullName: string;
  counselorPictureUrl: string;
  id: string;
  slotLabel: string;
  slotTime: string;
  status: CounselorAppointment["status"];
};

type AppointmentUpdateKind = "cancelled" | "confirmed" | "declined" | "rescheduled";

type AppointmentUpdate = {
  appointment: AppointmentSnapshot;
  kind: AppointmentUpdateKind;
};

const POLL_INTERVAL_MS = 20_000;
const SNAPSHOT_STORAGE_PREFIX = "bawat-tala.appointment-status.v1";

function getStorageKey(studentNumber: string) {
  return `${SNAPSHOT_STORAGE_PREFIX}:${studentNumber}`;
}

function toSnapshot(appointment: CounselorAppointment): AppointmentSnapshot {
  return {
    appointmentDate: appointment.appointmentDate || "",
    appointmentDateLabel: appointment.appointmentDateLabel || appointment.appointmentDate || "",
    concern: appointment.concern || "",
    counselorFullName: appointment.counselor?.fullName || "Guidance Counselor",
    counselorPictureUrl: appointment.counselor?.pictureUrl || "",
    id: appointment.id,
    slotLabel: appointment.slotLabel || appointment.slotTime || "",
    slotTime: appointment.slotTime || "",
    status: appointment.status,
  };
}

function parseStoredSnapshots(rawValue: string | null) {
  if (!rawValue) return {} as Record<string, AppointmentSnapshot>;

  try {
    const parsed = JSON.parse(rawValue) as Record<string, AppointmentSnapshot>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {} as Record<string, AppointmentSnapshot>;
  }
}

function detectAppointmentUpdate(
  previous: AppointmentSnapshot,
  current: AppointmentSnapshot,
): AppointmentUpdateKind | null {
  const currentStatus = String(current.status || "").toUpperCase();
  const previousStatus = String(previous.status || "").toUpperCase();

  if (currentStatus === "CANCELLED" && previousStatus !== "CANCELLED") return "cancelled";
  if (currentStatus === "DECLINED" && previousStatus !== "DECLINED") return "declined";

  const scheduleChanged =
    current.appointmentDate !== previous.appointmentDate ||
    current.slotTime !== previous.slotTime ||
    current.counselorFullName !== previous.counselorFullName;
  if (scheduleChanged && ["PENDING", "CONFIRMED"].includes(currentStatus)) return "rescheduled";

  if (currentStatus === "CONFIRMED" && previousStatus !== "CONFIRMED") return "confirmed";
  return null;
}

function getUpdateCopy(update: AppointmentUpdate) {
  switch (update.kind) {
    case "confirmed":
      return {
        icon: "checkmark-circle" as const,
        accent: "#68B93E",
        title: "Appointment Confirmed",
        subtitle: `${update.appointment.counselorFullName} confirmed your counseling session.`,
        footnote: "Please arrive around 5 minutes before your scheduled time.",
      };
    case "rescheduled":
      return {
        icon: "calendar" as const,
        accent: "#5F8FD1",
        title: "Appointment Rescheduled",
        subtitle: `${update.appointment.counselorFullName} updated your counseling schedule.`,
        footnote: "Please review the new date and time below.",
      };
    case "declined":
      return {
        icon: "close-circle" as const,
        accent: "#D69A3B",
        title: "Appointment Declined",
        subtitle: `${update.appointment.counselorFullName} could not confirm this appointment request.`,
        footnote: "You can return to Consult Support to request another schedule.",
      };
    default:
      return {
        icon: "close-circle" as const,
        accent: "#D96B73",
        title: "Appointment Cancelled",
        subtitle: `Your session with ${update.appointment.counselorFullName} was cancelled.`,
        footnote: "Check your notifications for any additional details from guidance.",
      };
  }
}

export function AppointmentStatusWatcher() {
  const { user } = useAuthSession();
  const [updates, setUpdates] = useState<AppointmentUpdate[]>([]);
  const snapshotsRef = useRef<Record<string, AppointmentSnapshot>>({});
  const checkingRef = useRef(false);
  const currentUpdate = updates[0] || null;

  useEffect(() => {
    const studentNumber = user?.studentNumber;
    if (!studentNumber) {
      snapshotsRef.current = {};
      setUpdates([]);
      return;
    }

    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkAppointments = async () => {
      if (!mounted || checkingRef.current || AppState.currentState !== "active") return;
      checkingRef.current = true;

      try {
        const result = await fetchStudentAppointments(studentNumber);
        if (!mounted || !result.ok) return;

        const appointments = Array.isArray(result.appointments) ? result.appointments : [];
        const nextSnapshots = Object.fromEntries(
          appointments.map((appointment) => [appointment.id, toSnapshot(appointment)]),
        );
        const detectedUpdates: AppointmentUpdate[] = [];

        for (const appointment of appointments) {
          const current = nextSnapshots[appointment.id];
          const previous = snapshotsRef.current[appointment.id];
          if (!previous) continue;

          const kind = detectAppointmentUpdate(previous, current);
          if (kind) detectedUpdates.push({ appointment: current, kind });
        }

        snapshotsRef.current = nextSnapshots;
        if (mounted && detectedUpdates.length) {
          setUpdates((current) => [...current, ...detectedUpdates]);
        }
        try {
          await AsyncStorage.setItem(getStorageKey(studentNumber), JSON.stringify(nextSnapshots));
        } catch {
          // The in-memory snapshot still prevents duplicate popups during this session.
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const startWatching = async () => {
      let storedValue: string | null = null;
      try {
        storedValue = await AsyncStorage.getItem(getStorageKey(studentNumber));
      } catch {
        storedValue = null;
      }
      if (!mounted) return;
      snapshotsRef.current = parseStoredSnapshots(storedValue);
      await checkAppointments();
      if (!mounted) return;
      interval = setInterval(() => void checkAppointments(), POLL_INTERVAL_MS);
    };

    void startWatching();
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void checkAppointments();
    });

    return () => {
      mounted = false;
      checkingRef.current = false;
      if (interval) clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [user?.studentNumber]);

  if (!currentUpdate) return null;
  const copy = getUpdateCopy(currentUpdate);

  const closeCurrentUpdate = () => {
    setUpdates((current) => current.slice(1));
  };

  const openSchedule = () => {
    closeCurrentUpdate();
    router.push({ pathname: "/profile-settings", params: { section: "schedule" } });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeCurrentUpdate}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.avatarStage}>
            <CounselorAvatar
              fullName={currentUpdate.appointment.counselorFullName}
              pictureUrl={currentUpdate.appointment.counselorPictureUrl}
              size={92}
              style={styles.avatar}
            />
            <View style={[styles.statusIcon, { backgroundColor: copy.accent }]}>
              <Ionicons name={copy.icon} size={23} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{currentUpdate.appointment.appointmentDateLabel || "Updated schedule"}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{currentUpdate.appointment.slotLabel || "See schedule"}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Counselor</Text>
              <Text style={styles.detailValue}>{currentUpdate.appointment.counselorFullName}</Text>
            </View>
          </View>

          <Text style={styles.footnote}>{copy.footnote}</Text>
          <Pressable style={styles.primaryButton} onPress={openSchedule}>
            <Text style={styles.primaryButtonText}>View My Schedule</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={closeCurrentUpdate}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 31, 28, 0.42)",
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: "#35443B",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  avatarStage: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  statusIcon: {
    position: "absolute",
    right: -1,
    bottom: 0,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatar: {
    borderWidth: 4,
    borderColor: "#EFF9EA",
  },
  title: {
    color: "#304558",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#586A79",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  detailsCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#F2F9EE",
    borderWidth: 1,
    borderColor: "#D7E9CC",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  detailRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  detailLabel: {
    color: "#66805F",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    flex: 1,
    color: "#344A3B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "right",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#DFECD7",
  },
  footnote: {
    color: "#718078",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 11,
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#70C943",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#6D7984",
    fontSize: 13,
    fontWeight: "700",
  },
});

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppPreferences } from "../lib/app-preferences";
import {
  AppNotification,
  CounselorAppointment,
  fetchRecentJournalEntries,
  fetchStudentAppointments,
  fetchStudentNotifications,
  fetchStudentProfile,
  submitStudentFeedback,
  StudentProfile,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { getManilaTodayParts } from "../lib/manila-date";

type SettingsSection =
  | "schedule"
  | "personal-details"
  | "privacy-security"
  | "recent-activity"
  | "help-support"
  | "feedback"
  | "app-lock";

type RecentEntryItem = {
  createdAt: string;
  id: string;
  preview: string;
  title: string;
};

const SCREEN_COPY: Record<SettingsSection, { subtitle: string; title: string }> = {
  schedule: {
    title: "My Schedule",
    subtitle: "See your counseling schedule and jump back into booking when needed.",
  },
  "app-lock": {
    title: "Journal Lock",
    subtitle: "Protect your journal with a simple 4-digit PIN. Once enabled, the journal locks right away.",
  },
  feedback: {
    title: "Feedback",
    subtitle: "Tell us what to improve and what already feels good.",
  },
  "help-support": {
    title: "Help & Support",
    subtitle: "Quick ways to get support and answers inside Bawat Tala.",
  },
  "personal-details": {
    title: "Personal Details",
    subtitle: "Your account information and who to contact if something needs updating.",
  },
  "privacy-security": {
    title: "Privacy & Security",
    subtitle: "Choose how private the app feels when you're using it around other people.",
  },
  "recent-activity": {
    title: "Recent Activity",
    subtitle: "A short summary of your latest entries, alerts, and support activity.",
  },
};

const FEEDBACK_CATEGORIES = ["Bug", "Suggestion", "Question", "Support"] as const;
const SUPPORT_EMAIL = "team@bawattalapro.online";
const STUDENT_ID_PATTERN = /^\d{2}-\d{4}$/;
const FEEDBACK_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

type FeedbackAttachment = {
  contentType: string;
  dataUrl: string;
  fileName: string;
  uri: string;
};
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && value in SCREEN_COPY);
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getMonthName(monthIndex: number, year: number) {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", { month: "long" });
}

function parseIsoDate(value?: string | null) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    day: Number(match[3]),
    isoDate: `${match[1]}-${match[2]}-${match[3]}`,
    monthIndex: Number(match[2]) - 1,
    year: Number(match[1]),
  };
}

export default function ProfileSettingsScreen() {
  const { resetPin, section } = useLocalSearchParams<{ resetPin?: string; section?: string }>();
  const activeSection: SettingsSection = isSection(section) ? section : "personal-details";
  const { title, subtitle } = SCREEN_COPY[activeSection];
  const { user } = useAuthSession();
  const {
    appLockAutoLock,
    appLockEnabled,
    disableAppLock,
    enableAppLock,
    enableExistingAppLock,
    hasAppLockPin,
    notificationPreviewsEnabled,
    privateJournalModeEnabled,
    resetAppLockWithStudentId,
    setAppLockAutoLock,
    setNotificationPreviewsEnabled,
    setPrivateJournalModeEnabled,
    updateAppLockPin,
  } = useAppPreferences();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntryItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appointments, setAppointments] = useState<CounselorAppointment[]>([]);
  const [appointment, setAppointment] = useState<CounselorAppointment | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<(typeof FEEDBACK_CATEGORIES)[number]>("Suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackAttachment, setFeedbackAttachment] = useState<FeedbackAttachment | null>(null);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinResetStudentId, setPinResetStudentId] = useState("");
  const [pinResetSaving, setPinResetSaving] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [draftAutoLock, setDraftAutoLock] = useState(appLockAutoLock);
  const todayParts = useMemo(() => getManilaTodayParts(), []);
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(todayParts.monthIndex);
  const [scheduleYear, setScheduleYear] = useState(todayParts.year);

  useEffect(() => {
    setDraftAutoLock(appLockAutoLock);
  }, [appLockAutoLock]);

  useEffect(() => {
    if (activeSection === "app-lock" && resetPin === "1" && hasAppLockPin) {
      setShowPinReset(true);
      setShowPinEditor(false);
      setCurrentPin("");
      setPin("");
      setPinConfirm("");
      setPinError("");
    }
  }, [activeSection, hasAppLockPin, resetPin]);

  useEffect(() => {
    if (activeSection !== "personal-details" || !user?.studentNumber) return;
    let mounted = true;
    setProfileLoading(true);
    void fetchStudentProfile(user.studentNumber)
      .then((result) => {
        if (!mounted) return;
        setProfile(result.ok ? result.profile ?? null : null);
      })
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeSection, user?.studentNumber]);

  useEffect(() => {
    if ((activeSection !== "recent-activity" && activeSection !== "schedule") || !user?.studentNumber) return;
    let mounted = true;
    setActivityLoading(true);
    void Promise.all([
      fetchRecentJournalEntries(user.studentNumber, 14),
      fetchStudentNotifications(user.studentNumber),
      fetchStudentAppointments(user.studentNumber),
    ])
      .then(([entriesResult, notificationsResult, appointmentsResult]) => {
        if (!mounted) return;
        setRecentEntries(
          (entriesResult.entries ?? []).slice(0, 3).map((entry) => ({
            createdAt: entry.createdAt,
            id: entry.id,
            preview: entry.preview || entry.summary || "Journal entry",
            title: entry.title || "Journal entry",
          })),
        );
        setNotifications((notificationsResult.notifications ?? []).slice(0, 3));
        setAppointments(appointmentsResult.appointments ?? []);
        setAppointment(appointmentsResult.upcomingAppointment ?? null);
      })
      .finally(() => {
        if (mounted) setActivityLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeSection, user?.studentNumber]);

  const address = useMemo(() => {
    if (!profile) return "Not available";
    return [profile.street, profile.barangay, profile.city, profile.province, profile.region].filter(Boolean).join(", ");
  }, [profile]);

  const scheduledAppointments = useMemo(
    () => appointments.filter((item) => !["CANCELLED", "DECLINED"].includes(item.status)),
    [appointments],
  );

  const appointmentsTodayCount = useMemo(
    () => scheduledAppointments.filter((item) => item.appointmentDate === todayParts.isoDate).length,
    [scheduledAppointments, todayParts.isoDate],
  );

  const appointmentsThisMonthCount = useMemo(
    () =>
      scheduledAppointments.filter((item) => {
        const parsed = parseIsoDate(item.appointmentDate);
        return parsed?.year === todayParts.year && parsed?.monthIndex === todayParts.monthIndex;
      }).length,
    [scheduledAppointments, todayParts.monthIndex, todayParts.year],
  );

  const scheduleCalendarDays = useMemo(() => {
    const firstDayIndex = new Date(scheduleYear, scheduleMonthIndex, 1).getDay();
    const totalDays = new Date(scheduleYear, scheduleMonthIndex + 1, 0).getDate();
    const appointmentDays = new Set(
      scheduledAppointments
        .map((item) => parseIsoDate(item.appointmentDate))
        .filter((item) => item && item.year === scheduleYear && item.monthIndex === scheduleMonthIndex)
        .map((item) => item!.day),
    );

    const cells: { day: number | null; hasAppointment: boolean; isToday: boolean }[] = [];

    for (let index = 0; index < firstDayIndex; index += 1) {
      cells.push({ day: null, hasAppointment: false, isToday: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push({
        day,
        hasAppointment: appointmentDays.has(day),
        isToday:
          scheduleYear === todayParts.year &&
          scheduleMonthIndex === todayParts.monthIndex &&
          day === todayParts.day,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, hasAppointment: false, isToday: false });
    }

    return cells;
  }, [scheduleMonthIndex, scheduleYear, scheduledAppointments, todayParts.day, todayParts.monthIndex, todayParts.year]);

  const goToPreviousScheduleMonth = () => {
    if (scheduleMonthIndex === 0) {
      setScheduleMonthIndex(11);
      setScheduleYear((prev) => prev - 1);
      return;
    }
    setScheduleMonthIndex((prev) => prev - 1);
  };

  const goToNextScheduleMonth = () => {
    if (scheduleMonthIndex === 11) {
      setScheduleMonthIndex(0);
      setScheduleYear((prev) => prev + 1);
      return;
    }
    setScheduleMonthIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile");
  };

  const openProfilePasswordReset = (returnSection: Extract<SettingsSection, "personal-details" | "privacy-security">) => {
    router.push(`/profile-reset-password?returnSection=${returnSection}` as never);
  };

  const openSupportEmail = useCallback(async (subject: string, body: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Mail App Needed", `Please email us at ${SUPPORT_EMAIL}.`);
      return;
    }
    await Linking.openURL(url);
  }, []);

  const handleFeedback = async () => {
    if (feedbackSending) return;
    if (!feedbackMessage.trim()) {
      Alert.alert("Add your feedback", "Write a short note first so we know what you want us to improve.");
      return;
    }
    if (!user?.studentNumber) {
      Alert.alert("Sign in needed", "Please sign in again before sending feedback.");
      return;
    }

    try {
      setFeedbackSending(true);
      const result = await submitStudentFeedback({
        attachment: feedbackAttachment
          ? {
              contentType: feedbackAttachment.contentType,
              dataUrl: feedbackAttachment.dataUrl,
              fileName: feedbackAttachment.fileName,
            }
          : null,
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        studentNumber: user.studentNumber,
      });

      if (!result.ok) {
        Alert.alert("Feedback not sent", result.message || "Please try again in a bit.");
        return;
      }

      setFeedbackMessage("");
      setFeedbackAttachment(null);
      Alert.alert("Feedback sent", result.message || "Thank you for helping improve Bawat Tala.");
    } catch {
      Alert.alert("Feedback not sent", "Please check your connection and try again.");
    } finally {
      setFeedbackSending(false);
    }
  };

  const pickFeedbackAttachment = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo permission needed", "Allow photo access to attach an image to your feedback.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.55,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Image not attached", "Could not read the selected image.");
        return;
      }

      const contentType = asset.mimeType || "image/jpeg";
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(contentType)) {
        Alert.alert("Unsupported image", "Please attach a JPG, PNG, or WEBP image.");
        return;
      }

      const estimatedBytes = Math.ceil((asset.base64.length * 3) / 4);
      if ((asset.fileSize || estimatedBytes) > FEEDBACK_ATTACHMENT_MAX_BYTES) {
        Alert.alert("Image too large", "Please choose an image that is 5 MB or smaller.");
        return;
      }

      setFeedbackAttachment({
        contentType,
        dataUrl: `data:${contentType};base64,${asset.base64}`,
        fileName: asset.fileName || "feedback-image.jpg",
        uri: asset.uri,
      });
    } catch {
      Alert.alert("Image not attached", "Please try choosing the image again.");
    }
  };

  const openPinEditor = () => {
    setShowPinEditor(true);
    setShowPinReset(false);
    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setPinError("");
  };

  const closePinEditor = () => {
    setShowPinEditor(false);
    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setPinError("");
  };

  const openPinReset = () => {
    setShowPinReset(true);
    setShowPinEditor(false);
    setPinResetStudentId("");
    setPinError("");
  };

  const closePinReset = () => {
    setShowPinReset(false);
    setPinResetStudentId("");
    setPinError("");
  };

  const handleSavePin = async () => {
    if (!user?.studentNumber) {
      setPinError("Student session is missing.");
      return;
    }
    if (appLockEnabled && currentPin.length !== 4) {
      setPinError("Enter your current PIN first.");
      return;
    }
    if (pin.length !== 4) {
      setPinError("Use exactly 4 digits for the PIN.");
      return;
    }
    if (appLockEnabled && pin === currentPin) {
      setPinError("Choose a new PIN that is different from your current PIN.");
      return;
    }
    if (pin !== pinConfirm) {
      setPinError("PIN entries do not match yet.");
      return;
    }
    setPinSaving(true);
    const result = appLockEnabled
      ? await updateAppLockPin(currentPin, pin)
      : await enableAppLock(pin, draftAutoLock);
    setPinSaving(false);

    if (!result.ok) {
      setPinError(result.message || "Unable to save Journal Lock.");
      return;
    }

    if (appLockEnabled) {
      setAppLockAutoLock(draftAutoLock);
    }
    closePinEditor();
    Alert.alert("Journal Lock Updated", "Your journal is now protected and will lock right away.");
  };

  const handleTurnOnExistingLock = async () => {
    setPinError("");
    setPinSaving(true);
    const result = await enableExistingAppLock(draftAutoLock);
    setPinSaving(false);

    if (!result.ok) {
      setPinError(result.message || "Unable to turn Journal Lock on.");
      return;
    }

    Alert.alert("Journal Lock On", "Your existing PIN is active again.");
  };

  const handleResetJournalLockPin = async () => {
    if (!STUDENT_ID_PATTERN.test(pinResetStudentId.trim())) {
      setPinError("Enter Student ID in 23-2903 format.");
      return;
    }

    setPinError("");
    setPinResetSaving(true);
    const result = await resetAppLockWithStudentId(pinResetStudentId);
    setPinResetSaving(false);

    if (!result.ok) {
      setPinError(result.message || "Student ID does not match this account.");
      return;
    }

    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setShowPinEditor(false);
    closePinReset();
    Alert.alert("Journal Lock Reset", "Your old PIN was removed. Create a new PIN when you're ready.");
  };

  const infoRows = [
    { label: "Full Name", value: profile?.fullName || user?.fullName || "User" },
    { label: "First Name", value: user?.firstName || "User" },
    { label: "Student ID", value: profile?.studentNumber || user?.studentNumber || "Not available" },
    { label: "Email", value: profile?.email || user?.email || "Not available" },
    { label: "Program", value: profile?.program || "Not available" },
    { label: "Birthdate", value: formatDate(profile?.birthdate) },
    { label: "Address", value: address },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={30} color="#3D3F43" />
        </Pressable>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeSection !== "schedule" ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {activeSection === "personal-details" ? (
          <>
            {profileLoading ? <ActivityIndicator color="#70C943" style={styles.loader} /> : null}
            <Card>
              {infoRows.map((item, index) => (
                <Row key={item.label} bordered={index > 0} label={item.label} value={item.value} />
              ))}
            </Card>
            <TipCard
              title="Need a correction?"
              body="If your student details changed, send a quick request and we'll help you update the account safely."
            />
            <PrimaryButton label="Reset Password" onPress={() => openProfilePasswordReset("personal-details")} />
            <SecondaryButton
              label="Contact Support"
              onPress={() =>
                void openSupportEmail(
                  "Account Details Update Request",
                  `Student ID: ${user?.studentNumber || ""}\n\nPlease help me update my account details.\n\nRequested change: `,
                )
              }
            />
          </>
        ) : null}

        {activeSection === "schedule" ? (
          <>
            {activityLoading ? <ActivityIndicator color="#70C943" style={styles.loader} /> : null}
            <View style={styles.scheduleOverviewBlock}>
              <Text style={styles.scheduleOverviewTitle}>Overview</Text>
              <Text style={styles.scheduleOverviewBody}>
                {appointmentsTodayCount === 1
                  ? "You have 1 scheduled consultation today."
                  : `You have ${appointmentsTodayCount} scheduled consultations today.`}
              </Text>
            </View>

            <View style={styles.scheduleStatsRow}>
              <ScheduleStatCard label="Today" value={appointmentsTodayCount} />
              <ScheduleStatCard label="This Month" value={appointmentsThisMonthCount} />
            </View>

            <View style={styles.scheduleCalendarCard}>
              <Text style={styles.scheduleCalendarYear}>{scheduleYear}</Text>
              <View style={styles.scheduleMonthBar}>
                <Pressable style={styles.scheduleMonthArrow} onPress={goToPreviousScheduleMonth}>
                  <Ionicons name="chevron-back" size={24} color="#384B5F" />
                </Pressable>

                <Text style={styles.scheduleMonthLabel}>{getMonthName(scheduleMonthIndex, scheduleYear)}</Text>

                <Pressable style={styles.scheduleMonthArrow} onPress={goToNextScheduleMonth}>
                  <Ionicons name="chevron-forward" size={24} color="#384B5F" />
                </Pressable>
              </View>

              <View style={styles.scheduleWeekRow}>
                {WEEKDAY_LABELS.map((day) => (
                  <Text key={day} style={styles.scheduleWeekText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.scheduleGrid}>
                {scheduleCalendarDays.map((cell, index) => (
                  <View key={`${cell.day ?? "blank"}-${index}`} style={styles.scheduleGridCell}>
                    {cell.day === null ? (
                      <View style={styles.scheduleDayBlank} />
                    ) : (
                      <View
                        style={[
                          styles.scheduleDayCircle,
                          cell.hasAppointment && styles.scheduleDayCircleBooked,
                          cell.isToday && styles.scheduleDayCircleToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scheduleDayText,
                            cell.hasAppointment && styles.scheduleDayTextBooked,
                            cell.isToday && styles.scheduleDayTextToday,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.scheduleLegendRow}>
                <View style={styles.scheduleLegendMarker} />
                <Text style={styles.scheduleLegendText}>Outlined dates are scheduled consultations.</Text>
              </View>
            </View>

            {appointment ? (
              <View style={styles.scheduleUpcomingShell}>
                <View style={styles.scheduleUpcomingIcon}>
                  <Ionicons name="calendar-outline" size={20} color="#5A8A36" />
                </View>
                <View style={styles.scheduleUpcomingContent}>
                  <View style={styles.scheduleUpcomingHeaderRow}>
                    <Text style={styles.scheduleUpcomingEyebrow}>Upcoming Appointment</Text>
                    <Text style={styles.scheduleUpcomingStatus}>{appointment.status}</Text>
                  </View>
                  <Text style={styles.scheduleUpcomingName}>{appointment.counselor.fullName}</Text>
                  <Text style={styles.scheduleUpcomingMeta}>
                    {appointment.appointmentDateLabel} - {appointment.slotLabel}
                  </Text>
                  {appointment.counselingType ? (
                    <Text style={styles.scheduleUpcomingMeta}>Counseling type: {appointment.counselingType}</Text>
                  ) : null}
                  <Text style={styles.scheduleUpcomingMeta}>{appointment.concern}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.scheduleEmptyCard}>
                <Text style={styles.scheduleEmptyTitle}>No consultation booked yet</Text>
                <Text style={styles.scheduleEmptyText}>
                  When you request or confirm a schedule, it will appear here and on the calendar above.
                </Text>
              </View>
            )}

            <PrimaryButton label={appointment ? "Manage Consultation" : "Book a Consultation"} onPress={() => router.push("/consult")} />
          </>
        ) : null}

        {activeSection === "privacy-security" ? (
          <>
            <Card title="Privacy Controls">
              <ToggleItem
                title="Notification Previews"
                description="Show preview text when alerts come in."
                value={notificationPreviewsEnabled}
                onValueChange={setNotificationPreviewsEnabled}
              />
              <ToggleItem
                title="Private Journal Mode"
                description="Hide detailed journal previews on profile-related screens."
                value={privateJournalModeEnabled}
                onValueChange={setPrivateJournalModeEnabled}
                bordered
              />
            </Card>
            <Card title="Journal Privacy">
              <ToggleItem
                title="Auto-lock journal in background"
                description={
                  appLockEnabled
                    ? "Lock your journal whenever Bawat Tala leaves the foreground."
                    : "Turn on Journal Lock first to use this."
                }
                value={draftAutoLock}
                onValueChange={(value) => {
                  setDraftAutoLock(value);
                  if (appLockEnabled) setAppLockAutoLock(value);
                }}
              />
            </Card>
            <TipCard
              title={
                appLockEnabled
                  ? "Journal Lock is on"
                  : hasAppLockPin
                    ? "Journal Lock is off"
                    : "Journal Lock is off"
              }
              body={
                appLockEnabled
                  ? "Your journal can stay protected with a 4-digit PIN whenever you leave the app or lock it manually."
                  : hasAppLockPin
                    ? "Your saved PIN is still kept. Turn Journal Lock on again to use the same PIN."
                    : "Turn it on if you want your journal kept behind a PIN without locking the rest of the app."
              }
            />
            <PrimaryButton label="Manage Journal Lock" onPress={() => router.push("/profile-settings?section=app-lock")} />
            <SecondaryButton label="Change Password" onPress={() => openProfilePasswordReset("privacy-security")} />
          </>
        ) : null}

        {activeSection === "recent-activity" ? (
          <>
            {activityLoading ? <ActivityIndicator color="#70C943" style={styles.loader} /> : null}
            <View style={styles.statsRow}>
              <StatBox label="Entries" value={String(recentEntries.length)} />
              <StatBox label="Unread" value={String(notifications.filter((item) => !item.isRead).length)} />
              <StatBox label="Support" value={appointment ? "1" : "0"} />
            </View>
            <Card title="Latest Journal Activity">
              {recentEntries.length ? (
                recentEntries.map((entry, index) => (
                  <ActionRow
                    key={entry.id}
                    bordered={index > 0}
                    title={entry.title}
                    meta={formatDateTime(entry.createdAt)}
                    body={privateJournalModeEnabled ? "Journal entry saved. Open it to read the full details." : entry.preview}
                    onPress={() => router.push(`/journal-entry-view?entryId=${entry.id}`)}
                  />
                ))
              ) : (
                <EmptyText text="No recent journal activity yet." />
              )}
            </Card>
            <Card title="Recent Notifications">
              {notifications.length ? (
                notifications.map((item, index) => (
                  <ActionRow
                    key={item.id}
                    bordered={index > 0}
                    title={item.title}
                    meta={item.timeLabel}
                    body={notificationPreviewsEnabled ? item.message : "Preview hidden. Open notifications to read it."}
                    onPress={() => router.push("/notifications")}
                  />
                ))
              ) : (
                <EmptyText text="No recent notifications yet." />
              )}
            </Card>
            <Card title="Upcoming Support">
              {appointment ? (
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryTitle}>{appointment.counselor.fullName}</Text>
                  <Text style={styles.summaryText}>{appointment.concern}</Text>
                  {appointment.counselingType ? (
                    <Text style={styles.summaryText}>Counseling type: {appointment.counselingType}</Text>
                  ) : null}
                  <Text style={styles.summaryText}>
                    {appointment.appointmentDateLabel} - {appointment.slotLabel}
                  </Text>
                </View>
              ) : (
                <EmptyText text="No upcoming consultation right now." />
              )}
            </Card>
          </>
        ) : null}

        {activeSection === "help-support" ? (
          <>
            <Card title="Quick Actions">
              <ActionRow
                title="Schedule Consultation"
                body="Set up a private session with a counselor or peer listener."
                onPress={() => router.push("/consult")}
              />
              <ActionRow
                title="Open Wellness Tools"
                body="Use guided exercises when you need a calmer reset."
                onPress={() => router.push("/wellness-tools")}
                bordered
              />
              <ActionRow
                title="View Notifications"
                body="Catch reminders, follow-ups, and updates in one place."
                onPress={() => router.push("/notifications")}
                bordered
              />
            </Card>
            <Card title="Common Questions">
              <Faq question="How do I continue a journal entry?" answer="Open Journal, tap View Entries, and choose the entry you want to read." />
              <Faq
                question="What if I need support right away?"
                answer="Use Consult for counseling support, or Talk to Peer when you want a lighter first step."
                bordered
              />
              <Faq
                question="Will Muni read my entries automatically?"
                answer="Muni is artificial intelligence. It responds inside journaling flows and summaries, but it is not a psychometrician or professional care. You stay in control of what you write and finish."
                bordered
              />
            </Card>
            <PrimaryButton
              label="Email Support"
              onPress={() =>
                void openSupportEmail(
                  "Bawat Tala Help Request",
                  `Student ID: ${user?.studentNumber || ""}\n\nHi team,\n\nI need help with: `,
                )
              }
            />
          </>
        ) : null}

        {activeSection === "feedback" ? (
          <>
            <Card title="Feedback Type">
              <View style={styles.chips}>
                {FEEDBACK_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.chip, feedbackCategory === category && styles.chipActive]}
                    onPress={() => setFeedbackCategory(category)}
                  >
                    <Text style={[styles.chipText, feedbackCategory === category && styles.chipTextActive]}>{category}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
            <Card title="Tell us more">
              <TextInput
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                placeholder="What happened, what you expected, or what you'd love to see improved."
                placeholderTextColor="#97A1AA"
                multiline
                textAlignVertical="top"
                style={styles.feedbackInput}
              />
            </Card>
            <Card title="Attach image">
              {feedbackAttachment ? (
                <View style={styles.feedbackAttachmentPreview}>
                  <Image source={{ uri: feedbackAttachment.uri }} style={styles.feedbackAttachmentImage} resizeMode="cover" />
                  <View style={styles.feedbackAttachmentInfo}>
                    <Text style={styles.feedbackAttachmentTitle} numberOfLines={1}>
                      {feedbackAttachment.fileName}
                    </Text>
                    <Text style={styles.feedbackAttachmentMeta}>Image attached</Text>
                  </View>
                  <Pressable style={styles.feedbackAttachmentRemove} onPress={() => setFeedbackAttachment(null)}>
                    <Ionicons name="close" size={18} color="#7C3D3D" />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.feedbackAttachmentButton} onPress={() => void pickFeedbackAttachment()}>
                  <Ionicons name="image-outline" size={20} color="#4D6C58" />
                  <View style={styles.feedbackAttachmentInfo}>
                    <Text style={styles.feedbackAttachmentTitle}>Add screenshot or photo</Text>
                    <Text style={styles.feedbackAttachmentMeta}>JPG, PNG, or WEBP up to 5 MB</Text>
                  </View>
                </Pressable>
              )}
            </Card>
            <PrimaryButton label={feedbackSending ? "Sending..." : "Send Feedback"} onPress={() => void handleFeedback()} />
            <SecondaryButton label="Open Help & Support" onPress={() => router.push("/profile-settings?section=help-support")} />
          </>
        ) : null}

        {activeSection === "app-lock" ? (
          <>
            <View style={styles.journalLockHero}>
              <View style={styles.journalLockHeroIcon}>
                <Ionicons name="lock-closed-outline" size={22} color="#5A9A35" />
              </View>
              <View style={styles.journalLockHeroCopy}>
                <Text style={styles.journalLockHeroTitle}>
                  {appLockEnabled
                    ? "Your journal is protected"
                    : hasAppLockPin
                      ? "Journal Lock is paused"
                      : "Keep your journal private"}
                </Text>
                <Text style={styles.journalLockHeroBody}>
                  {appLockEnabled
                    ? "Only the journal side of Bawat Tala will ask for your PIN. Everything else stays easy to reach."
                    : hasAppLockPin
                      ? "Your PIN is still saved. Turning Journal Lock on again will use the same PIN."
                      : "Add a 4-digit PIN so journal entries, archive pages, and writing screens stay private when you need them to."}
                </Text>
              </View>
            </View>
            <Card title="Lock Preferences">
              <ToggleItem
                title="Lock journal when app goes to background"
                description="Useful if you switch apps often or hand your phone to someone else."
                value={draftAutoLock}
                onValueChange={setDraftAutoLock}
              />
            </Card>
            {!appLockEnabled && !hasAppLockPin ? (
              <PrimaryButton label="Create Journal PIN" onPress={openPinEditor} />
            ) : null}
            {!appLockEnabled && hasAppLockPin ? (
              <>
                {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
                <PrimaryButton
                  label={pinSaving ? "Turning On..." : "Turn On Journal Lock"}
                  onPress={() => void handleTurnOnExistingLock()}
                />
                <SecondaryButton label="Forgot PIN?" onPress={openPinReset} />
              </>
            ) : null}
            {appLockEnabled ? (
              <>
                <SecondaryButton label="Change PIN" onPress={openPinEditor} />
                <SecondaryButton label="Forgot PIN?" onPress={openPinReset} />
                <Pressable
                  style={styles.dangerButton}
                  onPress={() => {
                    void disableAppLock();
                    setCurrentPin("");
                    setPin("");
                    setPinConfirm("");
                    setPinResetStudentId("");
                    setPinError("");
                    setShowPinEditor(false);
                    setShowPinReset(false);
                  }}
                >
                  <Text style={styles.dangerText}>Turn Off Journal Lock</Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}

        <Pressable
          style={styles.shareFooter}
          onPress={() => router.push("/referral" as never)}
        >
          <Ionicons name="share-social-outline" size={18} color="#4A5F72" />
          <Text style={styles.shareFooterText}>Refer a friend from here too</Text>
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closePinEditor}
        transparent
        visible={activeSection === "app-lock" && showPinEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{appLockEnabled ? "Change Journal PIN" : "Create Journal PIN"}</Text>
            <Text style={styles.modalBody}>
              {appLockEnabled
                ? "Enter your current PIN first, then choose different new 4 digits and confirm them."
                : "Use the same 4 digits both times. Your journal will lock as soon as you save it."}
            </Text>
            {appLockEnabled ? (
              <TextInput
                value={currentPin}
                onChangeText={(value) => {
                  setCurrentPin(value.replace(/[^0-9]/g, "").slice(0, 4));
                  if (pinError) setPinError("");
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="Current PIN"
                placeholderTextColor="#97A1AA"
                style={styles.textInput}
              />
            ) : null}
            <TextInput
              value={pin}
              onChangeText={(value) => {
                setPin(value.replace(/[^0-9]/g, "").slice(0, 4));
                if (pinError) setPinError("");
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder={appLockEnabled ? "New 4-digit PIN" : "Enter 4-digit PIN"}
              placeholderTextColor="#97A1AA"
              style={[styles.textInput, appLockEnabled && styles.inputGap]}
            />
            <TextInput
              value={pinConfirm}
              onChangeText={(value) => {
                setPinConfirm(value.replace(/[^0-9]/g, "").slice(0, 4));
                if (pinError) setPinError("");
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Confirm PIN"
              placeholderTextColor="#97A1AA"
              style={[styles.textInput, styles.inputGap]}
            />
            {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closePinEditor}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, pinSaving && styles.modalButtonDisabled]}
                onPress={() => void handleSavePin()}
                disabled={pinSaving}
              >
                <Text style={styles.modalPrimaryText}>
                  {pinSaving ? "Saving..." : appLockEnabled ? "Save PIN" : "Create PIN"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closePinReset}
        transparent
        visible={activeSection === "app-lock" && showPinReset}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Forgotten PIN</Text>
            <Text style={styles.modalBody}>
              Enter your dashed Student ID to remove the old Journal Lock PIN. This turns Journal Lock off until you create a new PIN.
            </Text>
            <TextInput
              value={pinResetStudentId}
              onChangeText={(value) => {
                setPinResetStudentId(value.replace(/[^0-9-]/g, "").slice(0, 7));
                if (pinError) setPinError("");
              }}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              maxLength={7}
              placeholder="23-2903"
              placeholderTextColor="#97A1AA"
              style={styles.textInput}
            />
            {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closePinReset}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, pinResetSaving && styles.modalButtonDisabled]}
                onPress={() => void handleResetJournalLockPin()}
                disabled={pinResetSaving}
              >
                <Text style={styles.modalPrimaryText}>{pinResetSaving ? "Resetting..." : "Reset PIN"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Row({ bordered = false, label, value }: { bordered?: boolean; label: string; value: string }) {
  return (
    <View style={[styles.row, bordered && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ToggleItem({
  bordered = false,
  description,
  onValueChange,
  title,
  value,
}: {
  bordered?: boolean;
  description: string;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  return (
    <View style={[styles.row, bordered && styles.rowBorder, styles.toggleRow]}>
      <View style={styles.toggleText}>
        <Text style={styles.rowValue}>{title}</Text>
        <Text style={styles.helperText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D3D8DE", true: "#AADD8D" }}
        thumbColor={value ? "#69BF3B" : "#F6F7F8"}
      />
    </View>
  );
}

function ActionRow({
  body,
  bordered = false,
  meta,
  onPress,
  title,
}: {
  body: string;
  bordered?: boolean;
  meta?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable style={[styles.row, bordered && styles.rowBorder, styles.actionRow]} onPress={onPress}>
      <View style={styles.actionText}>
        <Text style={styles.rowValue}>{title}</Text>
        {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
        <Text style={styles.helperText}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#7A8290" />
    </Pressable>
  );
}

function Faq({ answer, bordered = false, question }: { answer: string; bordered?: boolean; question: string }) {
  return (
    <View style={[styles.row, bordered && styles.rowBorder]}>
      <Text style={styles.rowValue}>{question}</Text>
      <Text style={styles.helperText}>{answer}</Text>
    </View>
  );
}

function TipCard({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.tipCard}>
      <Text style={styles.tipTitle}>{title}</Text>
      <Text style={styles.helperText}>{body}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ScheduleStatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scheduleStatCard}>
      <Text style={styles.scheduleStatValue}>{value}</Text>
      <View style={styles.scheduleStatFooter}>
        <Text style={styles.scheduleStatLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color="#5E7164" />
      </View>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return <Text style={styles.helperText}>{text}</Text>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#314258", fontSize: 17, lineHeight: 23, fontWeight: "700" },
  topBarSpacer: { width: 38, height: 38 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 28 },
  subtitle: { color: "#5A6B7A", fontSize: 14, lineHeight: 20, marginBottom: 14 },
  loader: { marginBottom: 14 },
  card: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { color: "#304558", fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: 8 },
  row: { paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#EEF2F5" },
  rowLabel: { color: "#68807C", fontSize: 12, lineHeight: 16, fontWeight: "600", marginBottom: 3 },
  rowValue: { color: "#2D4053", fontSize: 15, lineHeight: 20, fontWeight: "700" },
  helperText: { color: "#566878", fontSize: 13, lineHeight: 18, marginTop: 2 },
  tipCard: {
    borderRadius: 16,
    backgroundColor: "#F8FBF4",
    borderWidth: 1,
    borderColor: "#DDEAD2",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  tipTitle: { color: "#304558", fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  primaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "700" },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryText: { color: "#3D5569", fontSize: 16, lineHeight: 20, fontWeight: "700" },
  dangerButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFF2F3",
    borderWidth: 1,
    borderColor: "#F3C5CB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dangerText: { color: "#D54A5B", fontSize: 16, lineHeight: 20, fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12 },
  toggleText: { flex: 1, paddingRight: 8 },
  scheduleOverviewTitle: {
    color: "#324254",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    marginBottom: 4,
  },
  scheduleOverviewBody: {
    color: "#4C5F72",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  scheduleOverviewBlock: {
    marginBottom: 2,
  },
  scheduleStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  scheduleStatCard: {
    width: "48.3%",
    minHeight: 94,
    borderRadius: 18,
    backgroundColor: "#E4FBBC",
    borderWidth: 1,
    borderColor: "#D2F1B0",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: "space-between",
    shadowColor: "#6B7781",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  scheduleStatValue: {
    color: "#314258",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    textAlign: "center",
  },
  scheduleStatFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleStatLabel: {
    color: "#5B6A57",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  scheduleCalendarCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECF2",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  scheduleCalendarYear: {
    color: "#324254",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  scheduleMonthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  scheduleMonthArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleMonthLabel: {
    color: "#33475B",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  scheduleWeekRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  scheduleWeekText: {
    width: "14.2857%",
    textAlign: "center",
    color: "#3F5264",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  scheduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 10,
  },
  scheduleGridCell: {
    width: "14.2857%",
    alignItems: "center",
  },
  scheduleDayBlank: {
    width: 34,
    height: 34,
  },
  scheduleDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  scheduleDayCircleBooked: {
    borderColor: "#738B68",
    backgroundColor: "#FFFFFF",
  },
  scheduleDayCircleToday: {
    borderColor: "#6FCB43",
    borderWidth: 2,
    backgroundColor: "#F7FFE9",
  },
  scheduleDayText: {
    color: "#728469",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  scheduleDayTextBooked: {
    color: "#4D5F51",
    fontWeight: "700",
  },
  scheduleDayTextToday: {
    color: "#2E5232",
  },
  scheduleLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 14,
  },
  scheduleLegendMarker: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#738B68",
    backgroundColor: "#FFFFFF",
  },
  scheduleLegendText: {
    color: "#6B7B89",
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  scheduleUpcomingShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    borderRadius: 18,
    backgroundColor: "#F7FDEB",
    borderWidth: 1,
    borderColor: "#DBEDC6",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  scheduleUpcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E8C2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  scheduleUpcomingContent: {
    flex: 1,
  },
  scheduleUpcomingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 10,
    marginBottom: 4,
  },
  scheduleUpcomingEyebrow: {
    color: "#6D8648",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  scheduleUpcomingName: {
    color: "#31475B",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 3,
  },
  scheduleUpcomingMeta: {
    color: "#556676",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  scheduleUpcomingStatus: {
    color: "#5F8A42",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  scheduleEmptyCard: {
    borderRadius: 18,
    backgroundColor: "#FAFCFE",
    borderWidth: 1,
    borderColor: "#E3EAF0",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  scheduleEmptyTitle: {
    color: "#324254",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  scheduleEmptyText: {
    color: "#627484",
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statBox: {
    width: "31.5%",
    borderRadius: 16,
    backgroundColor: "#F8FBF4",
    borderWidth: 1,
    borderColor: "#DDEAD2",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statValue: { color: "#304558", fontSize: 24, lineHeight: 28, fontWeight: "700", marginBottom: 2 },
  statLabel: { color: "#60727B", fontSize: 12, lineHeight: 16, textAlign: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12 },
  actionText: { flex: 1 },
  metaText: { color: "#7C8792", fontSize: 12, lineHeight: 16, marginTop: 2 },
  summaryBlock: {
    borderRadius: 14,
    backgroundColor: "#F5FBEE",
    borderWidth: 1,
    borderColor: "#DDEACF",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryTitle: { color: "#31475B", fontSize: 15, lineHeight: 20, fontWeight: "700", marginBottom: 2 },
  summaryText: { color: "#556676", fontSize: 13, lineHeight: 18, marginBottom: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8E3D0",
    backgroundColor: "#FFFFFF",
  },
  chipActive: { borderColor: "#79C943", backgroundColor: "#EDF8E6" },
  chipText: { color: "#566879", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  chipTextActive: { color: "#2E6D25", fontWeight: "700" },
  feedbackInput: {
    minHeight: 156,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#2D4053",
  },
  feedbackAttachmentButton: {
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDEAD2",
    backgroundColor: "#F8FBF4",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackAttachmentPreview: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDEAD2",
    backgroundColor: "#F8FBF4",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feedbackAttachmentImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#E8EFE2",
  },
  feedbackAttachmentInfo: {
    flex: 1,
  },
  feedbackAttachmentTitle: {
    color: "#31475B",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  feedbackAttachmentMeta: {
    color: "#697989",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  feedbackAttachmentRemove: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#FCEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(33, 43, 52, 0.42)",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8EF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#26323C",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  modalTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalBody: {
    color: "#5A6B7A",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 14,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#3D5569",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonDisabled: {
    opacity: 0.65,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  textInput: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2D4053",
  },
  inputGap: { marginTop: 10 },
  journalPinHint: {
    color: "#5A6B7A",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  pinEditorActionWrap: {
    marginTop: 6,
  },
  errorText: { color: "#D24C59", fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 10 },
  journalLockHero: {
    borderRadius: 20,
    backgroundColor: "#F5FBEE",
    borderWidth: 1,
    borderColor: "#DCEACB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  journalLockHeroIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E7C5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  journalLockHeroCopy: {
    flex: 1,
  },
  journalLockHeroTitle: {
    color: "#31475B",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  journalLockHeroBody: {
    color: "#5A6B7A",
    fontSize: 13,
    lineHeight: 18,
  },
  shareFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, marginTop: 8 },
  shareFooterText: { color: "#4A5F72", fontSize: 13, lineHeight: 18, fontWeight: "600" },
});


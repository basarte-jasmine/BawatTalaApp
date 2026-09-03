import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OtpCodeInput } from "../components/forms/OtpCodeInput";
import { SelectField } from "../components/forms/SelectField";
import { useAppPreferences } from "../lib/app-preferences";
import {
  AppNotification,
  CounselorAppointment,
  fetchRecentJournalEntries,
  fetchStudentAppointments,
  fetchStudentNotifications,
  fetchStudentProfile,
  confirmProfileEmailChange,
  resendProfileEmailChangeCode,
  sendProfileEmailChangeCode,
  submitStudentFeedback,
  updateStudentProfile,
  verifyJournalLockPin,
  verifyProfileEmailChangeCode,
  StudentProfile,
} from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { getManilaDaysInMonth, getManilaMonthName, getManilaTodayParts, getManilaWeekdayIndex } from "../lib/manila-date";
import { getAppointmentNoticeStatus, getNotificationRoute } from "../lib/notification-utils";
import { BARANGAY_OPTIONS, GENDER_OPTIONS, PROGRAM_OPTIONS } from "../lib/register-data";
import { isValidName } from "../lib/register-validation";

type SettingsSection =
  | "schedule"
  | "personal-details"
  | "privacy-security"
  | "recent-activity"
  | "help-support"
  | "app-lock";

type HelpSubmissionType = "FEEDBACK" | "SUPPORT";

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
  "help-support": {
    title: "Help & Support",
    subtitle: "Quick ways to get support and answers inside Bawat Tala.",
  },
  "personal-details": {
    title: "Personal Details",
    subtitle: "Review and update your account information.",
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

const FEEDBACK_CATEGORIES = ["Suggestion", "App Experience", "Bug Report", "Other"] as const;
const SUPPORT_CATEGORIES = ["Account Issue", "Consultation/Booking Help", "Technical Issue", "Other"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 8;
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

function showAppAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === "web") {
    const browserAlert = (globalThis as { alert?: (value: string) => void }).alert;
    if (typeof browserAlert === "function") {
      browserAlert(`${title}\n\n${message}`);
      if (onOk) onOk();
      return;
    }
  }
  Alert.alert(title, message, onOk ? [{ text: "OK", onPress: onOk }] : undefined);
}

function resolveSettingsSection(value: string | undefined): SettingsSection {
  if (value === "feedback") return "help-support";
  return isSection(value) ? value : "personal-details";
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

function parseIsoDate(value?: string | null) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return {
      day: Number(iso[3]),
      isoDate: `${iso[1]}-${iso[2]}-${iso[3]}`,
      monthIndex: Number(iso[2]) - 1,
      year: Number(iso[1]),
    };
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  const monthIndex = Number(us[1]) - 1;
  const day = Number(us[2]);
  const year = Number(us[3]);
  return {
    day,
    isoDate: toIsoDate(year, monthIndex, day),
    monthIndex,
    year,
  };
}

const BIRTHDATE_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function BirthdateCalendarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const today = useMemo(() => getManilaTodayParts(), []);
  const selected = useMemo(() => parseIsoDate(value), [value]);

  const [viewYear, setViewYear] = useState(() => (selected ? selected.year : today.year - 18));
  const [viewMonthIndex, setViewMonthIndex] = useState(() => (selected ? selected.monthIndex : today.monthIndex));

  useEffect(() => {
    if (selected) {
      setViewYear(selected.year);
      setViewMonthIndex(selected.monthIndex);
    }
  }, [value]);

  const yearOptions = useMemo(
    () => Array.from({ length: 90 }, (_, index) => String(today.year - index)),
    [today.year],
  );

  const canGoNextMonth = useMemo(() => {
    if (viewYear > today.year) return false;
    if (viewYear === today.year && viewMonthIndex >= today.monthIndex) return false;
    return true;
  }, [today.monthIndex, today.year, viewMonthIndex, viewYear]);

  const goToPreviousMonth = () => {
    if (viewMonthIndex === 0) {
      setViewMonthIndex(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonthIndex((prev) => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonthIndex === 11) {
      setViewMonthIndex(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonthIndex((prev) => prev + 1);
    }
  };

  const handleMonthSelect = (monthName: string) => {
    const nextMonthIndex = BIRTHDATE_MONTHS.indexOf(monthName);
    if (nextMonthIndex === -1) return;
    if (viewYear === today.year && nextMonthIndex > today.monthIndex) {
      setViewMonthIndex(today.monthIndex);
    } else {
      setViewMonthIndex(nextMonthIndex);
    }
  };

  const handleYearSelect = (yearStr: string) => {
    const nextYear = Number(yearStr);
    if (Number.isNaN(nextYear)) return;
    setViewYear(nextYear);
    if (nextYear === today.year && viewMonthIndex > today.monthIndex) {
      setViewMonthIndex(today.monthIndex);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = getManilaWeekdayIndex(viewYear, viewMonthIndex, 1);
    const totalDays = getManilaDaysInMonth(viewYear, viewMonthIndex);
    const cells: { day: number | null; isDisabled: boolean; isSelected: boolean; isToday: boolean }[] = [];

    for (let index = 0; index < firstDayIndex; index += 1) {
      cells.push({ day: null, isDisabled: true, isSelected: false, isToday: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isFuture =
        viewYear > today.year ||
        (viewYear === today.year && viewMonthIndex > today.monthIndex) ||
        (viewYear === today.year && viewMonthIndex === today.monthIndex && day > today.day);

      const isSelected =
        Boolean(selected) &&
        selected?.year === viewYear &&
        selected?.monthIndex === viewMonthIndex &&
        selected?.day === day;

      const isToday =
        viewYear === today.year &&
        viewMonthIndex === today.monthIndex &&
        day === today.day;

      cells.push({
        day,
        isDisabled: isFuture,
        isSelected,
        isToday,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, isDisabled: true, isSelected: false, isToday: false });
    }

    return cells;
  }, [selected, today.day, today.monthIndex, today.year, viewMonthIndex, viewYear]);

  const handleSelectDay = (day: number) => {
    const nextIso = toIsoDate(viewYear, viewMonthIndex, day);
    onChange(nextIso);
  };

  const formattedSelectedText = useMemo(() => {
    if (!selected) return "No birthdate selected";
    return BIRTHDATE_MONTHS[selected.monthIndex] + " " + selected.day + ", " + selected.year;
  }, [selected]);

  return (
    <View style={styles.birthdateCalendarWrapper}>
      <View style={styles.birthdateControlsRow}>
        <Pressable
          onPress={goToPreviousMonth}
          style={styles.birthdateArrowBtn}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color="#33475B" />
        </Pressable>

        <View style={styles.birthdateSelectsRow}>
          <View style={styles.birthdateMonthSelectWrap}>
            <SelectField
              label=""
              options={[...BIRTHDATE_MONTHS]}
              value={BIRTHDATE_MONTHS[viewMonthIndex] || "January"}
              onSelect={handleMonthSelect}
              containerStyle={styles.birthdateSelectContainer}
              triggerStyle={styles.birthdateSelectTrigger}
              valueStyle={styles.birthdateSelectValue}
            />
          </View>

          <View style={styles.birthdateYearSelectWrap}>
            <SelectField
              label=""
              options={yearOptions}
              value={String(viewYear)}
              onSelect={handleYearSelect}
              containerStyle={styles.birthdateSelectContainer}
              triggerStyle={styles.birthdateSelectTrigger}
              valueStyle={styles.birthdateSelectValue}
            />
          </View>
        </View>

        <Pressable
          onPress={goToNextMonth}
          disabled={!canGoNextMonth}
          style={[styles.birthdateArrowBtn, !canGoNextMonth && styles.birthdateArrowBtnDisabled]}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={canGoNextMonth ? "#33475B" : "#B4BCC5"} />
        </Pressable>
      </View>

      <View style={styles.birthdateWeekdaysRow}>
        {WEEKDAY_LABELS.map((day) => (
          <Text key={day} style={styles.birthdateWeekdayText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.birthdateGrid}>
        {calendarDays.map((cell, index) => {
          if (cell.day === null) {
            return <View key={"blank-" + index} style={styles.birthdateGridCellBlank} />;
          }

          return (
            <View key={"day-" + cell.day + "-" + index} style={styles.birthdateGridCell}>
              <Pressable
                disabled={cell.isDisabled}
                onPress={() => cell.day !== null && handleSelectDay(cell.day)}
                style={[
                  styles.birthdateDayCircle,
                  cell.isSelected && styles.birthdateDayCircleSelected,
                  cell.isToday && !cell.isSelected && styles.birthdateDayCircleToday,
                  cell.isDisabled && styles.birthdateDayCircleDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.birthdateDayText,
                    cell.isSelected && styles.birthdateDayTextSelected,
                    cell.isToday && !cell.isSelected && styles.birthdateDayTextToday,
                    cell.isDisabled && styles.birthdateDayTextDisabled,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.birthdateSelectionBadge}>
        <Ionicons name="calendar-outline" size={16} color="#356525" />
        <Text style={styles.birthdateSelectionText}>{formattedSelectedText}</Text>
      </View>
    </View>
  );
}
function openNotificationFromActivity(item: AppNotification) {
  const route = String(item.route || "").trim().toLowerCase();
  const status = getAppointmentNoticeStatus(item);
  const openNotificationView = () => {
    router.push({
      pathname: "/notification-view",
      params: {
        createdAt: item.createdAt,
        kind: item.kind,
        message: item.message,
        timeLabel: item.timeLabel,
        title: item.title,
      },
    } as never);
  };

  if (status === "DISAPPROVED") {
    openNotificationView();
    return;
  }
  if (status === "CONFIRMED" || status === "RESCHEDULED") {
    router.push("/profile-settings?section=schedule");
    return;
  }
  if (route === "schedule" || route.includes("schedule")) {
    router.push("/profile-settings?section=schedule");
    return;
  }
  if (route === "home" || route === "/home") {
    router.push("/home");
    return;
  }

  const targetRoute = getNotificationRoute(item);
  if (targetRoute) {
    router.push(targetRoute as never);
    return;
  }
  openNotificationView();
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ADDRESS_PATTERN = /^(?=.{2,80}$)[\p{L}][\p{L}\p{M} .'-]*$/u;
const STREET_PATTERN = /^(?=.{2,120}$)[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'#-]*$/u;

type ProfileDraftSnapshot = {
  barangay: string;
  birthdate: string;
  city: string;
  email: string;
  fullName: string;
  gender: string;
  program: string;
  province: string;
  region: string;
  street: string;
};

function toDisplayCaps(value?: string | null) {
  const text = String(value || "").trim();
  return text ? text.toUpperCase() : "Not available";
}

function findOption(options: string[], value: string) {
  const needle = value.trim().toUpperCase();
  if (!needle) return "";
  return options.find((option) => option.toUpperCase() === needle) ?? "";
}

function withCurrentOption(options: string[], value: string) {
  const current = value.trim();
  if (current && !findOption(options, current)) {
    return [current.toUpperCase(), ...options.map((option) => option.toUpperCase())];
  }
  return options.map((option) => option.toUpperCase());
}

function formatBirthdateDisplay(value?: string | null) {
  const parsed = parseIsoDate(value);
  if (!parsed) return value ? String(value) : "Not available";
  const month = String(parsed.monthIndex + 1).padStart(2, "0");
  const day = String(parsed.day).padStart(2, "0");
  return month + "/" + day + "/" + parsed.year;
}

function birthdateToPickerDate(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    const today = getManilaTodayParts();
    return new Date(today.year - 18, today.monthIndex, today.day);
  }
  return new Date(parsed.year, parsed.monthIndex, parsed.day);
}

export default function ProfileSettingsScreen() {
  const { resetPin, section, view } = useLocalSearchParams<{ resetPin?: string; section?: string; view?: string }>();
  const activeSection: SettingsSection = resolveSettingsSection(section);
  const [showContactForm, setShowContactForm] = useState(view === "contact" || view === "form");
  const { title, subtitle } = SCREEN_COPY[activeSection];
  const { setUser, user } = useAuthSession();
  const {
    appLockAutoLock,
    appLockEnabled,
    disableAppLock,
    enableAppLock,
    enableExistingAppLock,
    hasAppLockPin,
    muniRemindersEnabled,
    notificationPreviewsEnabled,
    privateJournalModeEnabled,
    resendAppLockResetCode,
    resetAppLockWithEmailCode,
    sendAppLockResetCode,
    setAppLockAutoLock,
    verifyAppLockResetCode,
    setMuniRemindersEnabled,
    setNotificationPreviewsEnabled,
    setPrivateJournalModeEnabled,
    updateAppLockPin,
  } = useAppPreferences();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntryItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsTotalCount, setNotificationsTotalCount] = useState(0);
  const [appointments, setAppointments] = useState<CounselorAppointment[]>([]);
  const [appointment, setAppointment] = useState<CounselorAppointment | null>(null);
  const [submissionType, setSubmissionType] = useState<HelpSubmissionType>("FEEDBACK");
  const [feedbackCategory, setFeedbackCategory] = useState<string>("Suggestion");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackAttachment, setFeedbackAttachment] = useState<FeedbackAttachment | null>(null);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSuccessMessage, setFeedbackSuccessMessage] = useState("");
  const [feedbackErrors, setFeedbackErrors] = useState<{
    category?: string;
    message?: string;
    subject?: string;
    type?: string;
  }>({});
  const [feedbackErrorBanner, setFeedbackErrorBanner] = useState("");

  useEffect(() => {
    if (view === "contact" || view === "form") {
      setShowContactForm(true);
    }
  }, [view]);

  useEffect(() => {
    if (activeSection !== "help-support") {
      setShowContactForm(false);
    }
  }, [activeSection]);

  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinResetOtp, setPinResetOtp] = useState("");
  const [pinResetResendSeconds, setPinResetResendSeconds] = useState(0);
  const [pinResetSaving, setPinResetSaving] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [recentEntriesTotalCount, setRecentEntriesTotalCount] = useState(0);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [draftFullName, setDraftFullName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftProgram, setDraftProgram] = useState("");
  const [draftBirthdate, setDraftBirthdate] = useState("");
  const [draftStreet, setDraftStreet] = useState("");
  const [draftBarangay, setDraftBarangay] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftProvince, setDraftProvince] = useState("");
  const [draftRegion, setDraftRegion] = useState("");
  const [draftGender, setDraftGender] = useState("");
  const [emailChangeStage, setEmailChangeStage] = useState<"idle" | "current-email" | "new-email">("idle");
  const [pinResetVerified, setPinResetVerified] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileOtpCode, setProfileOtpCode] = useState("");
  const [profileOtpSeconds, setProfileOtpSeconds] = useState(0);
  const [profileAwaitingEmailOtp, setProfileAwaitingEmailOtp] = useState(false);
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [pinConfirmAction, setPinConfirmAction] = useState<"turn-off" | "turn-on" | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const isEditingProfile = editingField !== null;
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileDraftSnapshot | null>(null);
  const [draftAutoLock, setDraftAutoLock] = useState(appLockAutoLock);
  const todayParts = useMemo(() => getManilaTodayParts(), []);
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(todayParts.monthIndex);
  const [scheduleYear, setScheduleYear] = useState(todayParts.year);

  useEffect(() => {
    setDraftAutoLock(appLockAutoLock);
  }, [appLockAutoLock]);

  useEffect(() => {
    if (pinResetResendSeconds <= 0) return;
    const timer = setInterval(() => {
      setPinResetResendSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [pinResetResendSeconds]);

  useEffect(() => {
    if (profileOtpSeconds <= 0) return;
    const timer = setInterval(() => {
      setProfileOtpSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [profileOtpSeconds]);

  const sendPinResetOtp = useCallback(async (mode: "send" | "resend" = "send") => {
    setPinError("");
    setPinResetSaving(true);
    const result = mode === "resend" ? await resendAppLockResetCode() : await sendAppLockResetCode();
    setPinResetSaving(false);
    if (!result.ok) {
      setPinError(result.message || "Unable to send verification code.");
      return false;
    }
    setPinResetOtp("");
    setPinResetResendSeconds(result.resendAfterSeconds ?? 60);
    return true;
  }, [resendAppLockResetCode, sendAppLockResetCode]);

  useEffect(() => {
    if (activeSection === "app-lock" && resetPin === "1" && hasAppLockPin) {
      setShowPinReset(true);
      setShowPinEditor(false);
      setCurrentPin("");
      setPin("");
      setPinConfirm("");
      setPinError("");
      setPinResetOtp("");
      setPinResetVerified(false);
      void sendPinResetOtp();
    }
  }, [activeSection, hasAppLockPin, resetPin, sendPinResetOtp]);

  useEffect(() => {
    if (activeSection === "app-lock") return;
    setPinConfirmAction(null);
    setShowPinEditor(false);
    setCurrentPin("");
    setPinError("");
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "personal-details" || !user?.studentNumber) return;
    let mounted = true;
    setProfileLoading(true);
    void fetchStudentProfile()
      .then((result) => {
        if (!mounted) return;
        const nextProfile = result.ok ? result.profile ?? null : null;
        setProfile(nextProfile);
        setDraftFullName(nextProfile?.fullName || user?.fullName || "");
        setDraftEmail(nextProfile?.email || user?.email || "");
        setDraftProgram(nextProfile?.program || "");
        setDraftBirthdate(nextProfile?.birthdate ? String(nextProfile.birthdate).slice(0, 10) : "");
        setDraftStreet(nextProfile?.street || "");
        setDraftBarangay(nextProfile?.barangay || "");
        setDraftCity(nextProfile?.city || "");
        setDraftProvince(nextProfile?.province || "");
        setDraftRegion(nextProfile?.region || "");
        setDraftGender(nextProfile?.gender || "");
        setEmailChangeStage("idle");
        setProfileAwaitingEmailOtp(false);
        setProfileOtpCode("");
        setProfileError("");
        setEditingField(null);
        setIsChangingEmail(false);
        setProfileFieldErrors({});
        setProfileSnapshot(null);
        setShowBirthdatePicker(false);
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
      fetchRecentJournalEntries(user.studentNumber, 20),
      fetchStudentNotifications(user.studentNumber),
      fetchStudentAppointments(),
    ])
      .then(([entriesResult, notificationsResult, appointmentsResult]) => {
        if (!mounted) return;
        const entries = entriesResult.entries ?? [];
        setRecentEntries(
          entries.map((entry) => ({
            createdAt: entry.createdAt,
            id: entry.id,
            preview: entry.preview || entry.summary || "Journal entry",
            title: entry.title || "Journal entry",
          })),
        );
        setRecentEntriesTotalCount(entriesResult.progress?.totalCount ?? entries.length);
        const inboxItems = notificationsResult.notifications ?? [];
        setNotifications(inboxItems);
        setNotificationsTotalCount(notificationsResult.totalCount ?? inboxItems.length);
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
    const firstDayIndex = getManilaWeekdayIndex(scheduleYear, scheduleMonthIndex, 1);
    const totalDays = getManilaDaysInMonth(scheduleYear, scheduleMonthIndex);
    const appointmentDays = new Set(
      scheduledAppointments
        .map((item) => parseIsoDate(item.appointmentDate))
        .filter((item) => item && item.year === scheduleYear && item.monthIndex === scheduleMonthIndex)
        .map((item) => item!.day),
    );

    const cells: { day: number | null; hasAppointment: boolean; isoDate: string | null; isToday: boolean }[] = [];

    for (let index = 0; index < firstDayIndex; index += 1) {
      cells.push({ day: null, hasAppointment: false, isoDate: null, isToday: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push({
        day,
        hasAppointment: appointmentDays.has(day),
        isoDate: toIsoDate(scheduleYear, scheduleMonthIndex, day),
        isToday:
          scheduleYear === todayParts.year &&
          scheduleMonthIndex === todayParts.monthIndex &&
          day === todayParts.day,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, hasAppointment: false, isoDate: null, isToday: false });
    }

    return cells;
  }, [scheduleMonthIndex, scheduleYear, scheduledAppointments, todayParts.day, todayParts.monthIndex, todayParts.year]);

  const selectedDayAppointments = useMemo(
    () =>
      selectedScheduleDate
        ? scheduledAppointments.filter((item) => item.appointmentDate === selectedScheduleDate)
        : [],
    [scheduledAppointments, selectedScheduleDate],
  );

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
    if (activeSection === "help-support" && showContactForm) {
      setShowContactForm(false);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile");
  };

  const openProfilePasswordReset = (returnSection: Extract<SettingsSection, "personal-details" | "privacy-security">) => {
    router.push(`/profile-reset-password?returnSection=${returnSection}` as never);
  };

  const helpCategories = submissionType === "SUPPORT" ? SUPPORT_CATEGORIES : FEEDBACK_CATEGORIES;

  const handleFeedback = async () => {
    if (feedbackSending) return;
    const isSupport = submissionType === "SUPPORT";
    const errors: { category?: string; message?: string; subject?: string; type?: string } = {};

    if (!submissionType) {
      errors.type = "Please choose a submission type.";
    }
    if (!feedbackCategory) {
      errors.category = "Please choose a category.";
    }
    if (!feedbackSubject.trim()) {
      errors.subject = "Please enter a subject.";
    }
    if (!feedbackMessage.trim()) {
      errors.message = isSupport
        ? "Please describe what you need help with."
        : "Please enter your feedback.";
    }

    if (Object.keys(errors).length > 0) {
      setFeedbackErrors(errors);
      const firstErrorMessage = errors.subject || errors.message || errors.category || errors.type || "Please fill in all required fields.";
      setFeedbackErrorBanner(firstErrorMessage);
      showAppAlert("Incomplete Information", firstErrorMessage);
      return;
    }

    setFeedbackErrors({});
    setFeedbackErrorBanner("");

    if (!user?.studentNumber) {
      showAppAlert("Sign in needed", isSupport ? "Please sign in again before submitting a request." : "Please sign in again before sending feedback.");
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
        submissionType,
        subject: feedbackSubject.trim() || undefined,
      });

      if (!result.ok) {
        setFeedbackErrorBanner(result.message || "Unable to send request.");
        showAppAlert(isSupport ? "Request not sent" : "Feedback not sent", result.message || "Please try again in a bit.");
        return;
      }

      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackAttachment(null);
      setFeedbackErrors({});
      setFeedbackErrorBanner("");
      setFeedbackSuccessMessage(
        result.message || (isSupport ? "Success! Your support request was sent." : "Success! Your feedback was sent."),
      );
      showAppAlert(
        isSupport ? "Request submitted" : "Feedback sent",
        result.message || (isSupport ? "Thank you. We'll look into your request." : "Thank you for helping improve Bawat Tala."),
        () => {
          setShowContactForm(false);
        },
      );
    } catch {
      setFeedbackErrorBanner("Please check your connection and try again.");
      showAppAlert(isSupport ? "Request not sent" : "Feedback not sent", "Please check your connection and try again.");
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
    setPinConfirmAction(null);
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

  const openPinConfirm = (action: "turn-off" | "turn-on") => {
    setPinConfirmAction(action);
    setShowPinEditor(false);
    setShowPinReset(false);
    setCurrentPin("");
    setPinError("");
  };

  const closePinConfirm = () => {
    setPinConfirmAction(null);
    setCurrentPin("");
    setPinError("");
  };

  const openPinReset = () => {
    setShowPinReset(true);
    setShowPinEditor(false);
    setPinConfirmAction(null);
    setPinResetOtp("");
    setPinError("");
    setPinResetVerified(false);
    setPin("");
    setPinConfirm("");
    void sendPinResetOtp();
  };

  const closePinReset = () => {
    setShowPinReset(false);
    setPinResetOtp("");
    setPinResetVerified(false);
    setPin("");
    setPinConfirm("");
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
    if (!user?.studentNumber) {
      setPinError("Student session is missing.");
      return;
    }
    if (currentPin.length !== 4) {
      setPinError("Enter your current PIN first.");
      return;
    }

    setPinError("");
    setPinSaving(true);
   const verified = await verifyJournalLockPin(user.studentNumber, currentPin);
   if (!verified.ok || !verified.unlocked) {
     setPinSaving(false);
     setPinError(verified.message || "That PIN doesn't match. Journal Lock is still off.");
     return;
   }

   const result = await enableExistingAppLock(draftAutoLock, currentPin);
   setPinSaving(false);

   if (!result.ok) {
      setPinError(result.message || "Unable to turn Journal Lock on.");
      return;
    }

    setCurrentPin("");
    setPinConfirmAction(null);
    Alert.alert("Journal Lock On", "Your existing PIN is active again.");
  };

  const handleMuniRemindersToggle = async (nextValue: boolean) => {
    const result = await setMuniRemindersEnabled(nextValue);
    if (!result.ok) {
      Alert.alert("Muni reminders", result.message || "Unable to update reminders right now.");
      return;
    }

    if (nextValue) {
      Alert.alert("Muni reminders are on", "Muni will gently check in with you during the day.");
    }
  };

  const handleResetJournalLockPin = async () => {
    if (!user?.studentNumber) {
      setPinError("Student session is missing.");
      return;
    }
    if (!pinResetVerified) {
      if (pinResetOtp.length !== OTP_LENGTH) {
        setPinError("Enter the 8-digit verification code.");
        return;
      }
      setPinError("");
      setPinResetSaving(true);
      const verified = await verifyAppLockResetCode(pinResetOtp);
      setPinResetSaving(false);
      if (!verified.ok) {
        setPinError(verified.message || "The code is invalid. Please check the latest email code and try again.");
        return;
      }
      setPinResetVerified(true);
      setPin("");
      setPinConfirm("");
      return;
    }
    if (pin.length !== 4 || pinConfirm.length !== 4) {
      setPinError("Enter a new 4-digit PIN twice.");
      return;
    }
    if (pin !== pinConfirm) {
      setPinError("The new PIN entries do not match.");
      return;
    }
    if (currentPin.length === 4 && pin === currentPin) {
      setPinError("Choose a new PIN that is different from your current PIN.");
      return;
    }

    setPinError("");
    setPinResetSaving(true);
    const result = await resetAppLockWithEmailCode(pin);
    setPinResetSaving(false);

    if (!result.ok) {
      setPinError(result.message || "Unable to reset Journal Lock.");
      return;
    }

    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setShowPinEditor(false);
    closePinReset();
    Alert.alert("Journal Lock Updated", "Your Journal Lock PIN was reset. Use the new PIN from now on.");
  };

  const handleTurnOffJournalLock = async () => {
    if (!user?.studentNumber) {
      setPinError("Student session is missing.");
      return;
    }
    if (currentPin.length !== 4) {
      setPinError("Enter your current PIN first.");
      return;
    }

    setPinError("");
    setPinSaving(true);
    const result = await disableAppLock(currentPin);
    setPinSaving(false);
    if (!result.ok) {
      setPinError(result.message || "Unable to turn Journal Lock off.");
      return;
    }

    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setPinResetOtp("");
    setShowPinEditor(false);
    setShowPinReset(false);
    setPinConfirmAction(null);
  };

  const captureProfileSnapshot = (): ProfileDraftSnapshot => ({
    barangay: draftBarangay,
    birthdate: draftBirthdate,
    city: draftCity,
    email: draftEmail,
    fullName: draftFullName,
    gender: draftGender,
    program: draftProgram,
    province: draftProvince,
    region: draftRegion,
    street: draftStreet,
  });

  const applyProfileSnapshot = (snapshot: ProfileDraftSnapshot) => {
    setDraftBarangay(snapshot.barangay);
    setDraftBirthdate(snapshot.birthdate);
    setDraftCity(snapshot.city);
    setDraftEmail(snapshot.email);
    setDraftFullName(snapshot.fullName);
    setDraftGender(snapshot.gender);
    setDraftProgram(snapshot.program);
    setDraftProvince(snapshot.province);
    setDraftRegion(snapshot.region);
    setDraftStreet(snapshot.street);
  };

  const startEditingField = (field: string) => {
    setProfileSnapshot(captureProfileSnapshot());
    setDraftFullName(draftFullName.toUpperCase());
    setDraftProgram(draftProgram.toUpperCase());
    setDraftGender(draftGender.toUpperCase());
    setDraftStreet(draftStreet.toUpperCase());
    setDraftBarangay(draftBarangay.toUpperCase());
    setDraftCity(draftCity.toUpperCase());
    setDraftProvince(draftProvince.toUpperCase());
    setDraftRegion(draftRegion.toUpperCase());
    setEditingField(field);
    setIsChangingEmail(field === "email");
    setEmailChangeStage("idle");
    setProfileAwaitingEmailOtp(false);
    setProfileOtpCode("");
    setProfileFieldErrors({});
    setProfileError("");
    setProfileSuccess("");
  };

  const startEditingProfile = () => {
    startEditingField("all");
  };

  const cancelEditingProfile = () => {
    if (profileSnapshot) {
      applyProfileSnapshot(profileSnapshot);
    }
    setEditingField(null);
    setIsChangingEmail(false);
    setEmailChangeStage("idle");
    setProfileAwaitingEmailOtp(false);
    setProfileOtpCode("");
    setProfileFieldErrors({});
    setProfileError("");
    setProfileSuccess("");
    setShowBirthdatePicker(false);
  };

  const clearProfileFieldError = (field: string) => {
    setProfileFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setProfileError("");
    setProfileSuccess("");
  };

  const setUpperDraft = (field: string, setter: (value: string) => void) => (value: string) => {
    setter(value.toUpperCase());
    clearProfileFieldError(field);
  };

  const openBirthdatePicker = () => {
    startEditingField("birthdate");
    setShowBirthdatePicker(true);
  };

  const startEditingEmail = () => {
    startEditingField("email");
  };

  const sendProfileEmailOtp = async (nextEmail: string) => {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");
    const result = await sendProfileEmailChangeCode(nextEmail);
    setProfileSaving(false);
    if (!result.ok) {
      setProfileError(result.message || "Failed to send verification code. Please try again.");
      return false;
    }
    setEmailChangeStage((result.stage as "current-email" | "new-email") || "current-email");
    setProfileAwaitingEmailOtp(true);
    setProfileOtpCode("");
    setProfileOtpSeconds(result.resendAfterSeconds ?? 60);
    setProfileSuccess(result.message || "Verification code sent to your current email address.");
    return true;
  };

  const validateSingleField = (field: string): string | null => {
    switch (field) {
      case "fullName": {
        const val = draftFullName.trim();
        if (!val) return "Full name is required.";
        if (val.length < 2 || val.length > 80) return "Full name must be 2 to 80 characters.";
        if (!isValidName(val)) return "Full name can only include letters, spaces, hyphens, and apostrophes.";
        return null;
      }
      case "email": {
        const originalEmail = (profile?.email || user?.email || "").trim().toLowerCase();
        const val = draftEmail.trim().toLowerCase();
        if (!val) return "Email is required.";
        if (!EMAIL_PATTERN.test(val)) return "Enter a valid email address.";
        if (val === originalEmail) return "This is already your current email address.";
        return null;
      }
      case "program": {
        const val = draftProgram.trim().toUpperCase();
        if (!val) return "Program is required.";
        if (!findOption(PROGRAM_OPTIONS, val) && !findOption(withCurrentOption(PROGRAM_OPTIONS, profileSnapshot?.program || profile?.program || ""), val)) {
          return "Choose a program from the list.";
        }
        return null;
      }
      case "gender": {
        const val = draftGender.trim().toUpperCase();
        if (!val) return "Gender is required.";
        if (!findOption(GENDER_OPTIONS, val) && !findOption(withCurrentOption(GENDER_OPTIONS, profileSnapshot?.gender || profile?.gender || ""), val)) {
          return "Choose a gender from the list.";
        }
        return null;
      }
      case "birthdate": {
        const parsed = parseIsoDate(draftBirthdate);
        if (!parsed) return "Birthdate is required.";
        const today = getManilaTodayParts();
        if (new Date(parsed.year, parsed.monthIndex, parsed.day) > new Date(today.year, today.monthIndex, today.day)) {
          return "Birthdate cannot be in the future.";
        }
        return null;
      }
      case "street": {
        const val = draftStreet.trim().toUpperCase();
        if (!val) return "Street is required.";
        if (val.length < 2 || val.length > 120) return "Street must be 2 to 120 characters.";
        if (!STREET_PATTERN.test(val)) return "Street can include letters, numbers, spaces, hyphens, and periods.";
        return null;
      }
      case "barangay": {
        const val = draftBarangay.trim().toUpperCase();
        if (!val) return "Barangay is required.";
        if (!findOption(BARANGAY_OPTIONS, val) && !ADDRESS_PATTERN.test(val)) return "Barangay can only include letters, spaces, hyphens, and periods.";
        return null;
      }
      case "city": {
        const val = draftCity.trim().toUpperCase();
        if (!val) return "City is required.";
        if (!ADDRESS_PATTERN.test(val)) return "City can only include letters, spaces, hyphens, and periods.";
        return null;
      }
      case "province": {
        const val = draftProvince.trim().toUpperCase();
        if (!val) return "Province is required.";
        if (!ADDRESS_PATTERN.test(val)) return "Province can only include letters, spaces, hyphens, and periods.";
        return null;
      }
      case "region": {
        const val = draftRegion.trim().toUpperCase();
        if (!val) return "Region is required.";
        if (!ADDRESS_PATTERN.test(val)) return "Region can only include letters, spaces, hyphens, and periods.";
        return null;
      }
      default:
        return null;
    }
  };

  const handleSaveField = async (field: string) => {
    if (!user) {
      setProfileError("Student session is missing.");
      return;
    }

    setProfileError("");
    setProfileSuccess("");

    if (field === "email") {
      const originalEmail = (profile?.email || user.email || "").trim().toLowerCase();
      const nextEmail = draftEmail.trim().toLowerCase();

      const err = validateSingleField("email");
      if (err) {
        setProfileFieldErrors({ email: err });
        return;
      }

      setProfileFieldErrors({});
      if (emailChangeStage === "idle") {
        const sent = await sendProfileEmailOtp(nextEmail);
        if (!sent) return;
        return;
      }

      if (profileOtpCode.length !== OTP_LENGTH) {
        setProfileError("Enter the 8-digit verification code.");
        return;
      }

      setProfileSaving(true);
      if (emailChangeStage === "current-email") {
        const verifyResult = await verifyProfileEmailChangeCode(profileOtpCode);
        setProfileSaving(false);
        if (!verifyResult.ok) {
          setProfileError(verifyResult.message || "The code is invalid. Please check the latest email code and try again.");
          return;
        }
        setEmailChangeStage("new-email");
        setProfileOtpCode("");
        setProfileOtpSeconds(verifyResult.resendAfterSeconds ?? 60);
        setProfileSuccess("Code verified. Enter the code sent to your new email.");
        return;
      }

      const confirmResult = await confirmProfileEmailChange(profileOtpCode);
      setProfileSaving(false);
      if (!confirmResult.ok) {
        setProfileError(confirmResult.message || "The code is invalid. Please check the latest email code and try again.");
        return;
      }
      if (confirmResult.profile) {
        setProfile(confirmResult.profile);
        setDraftEmail(confirmResult.profile.email || nextEmail);
        setUser({
          ...user,
          email: confirmResult.profile.email || nextEmail,
          firstName: (confirmResult.profile.fullName || profile?.fullName || user.fullName || "").split(/\s+/)[0] || user.firstName,
          fullName: confirmResult.profile.fullName || profile?.fullName || user.fullName || "",
        });
      }
      setEmailChangeStage("idle");
      setProfileAwaitingEmailOtp(false);
      setProfileOtpCode("");
      setIsChangingEmail(false);
      setEditingField(null);
      setProfileFieldErrors({});
      setProfileSnapshot(null);
      setProfileSuccess("Email updated successfully.");
      return;
    }

    const fieldError = validateSingleField(field);
    if (fieldError) {
      setProfileFieldErrors({ [field]: fieldError });
      return;
    }

    setProfileFieldErrors({});
    setProfileSaving(true);

    const payload: Record<string, string> = {};
    if (field === "fullName") payload.fullName = draftFullName.trim().toUpperCase();
    if (field === "program") payload.program = draftProgram.trim().toUpperCase();
    if (field === "gender") payload.gender = draftGender.trim().toUpperCase();
    if (field === "birthdate") {
      const parsed = parseIsoDate(draftBirthdate);
      payload.birthdate = parsed ? toIsoDate(parsed.year, parsed.monthIndex, parsed.day) : draftBirthdate.trim();
    }
    if (field === "street") payload.street = draftStreet.trim().toUpperCase();
    if (field === "barangay") payload.barangay = draftBarangay.trim().toUpperCase();
    if (field === "city") payload.city = draftCity.trim().toUpperCase();
    if (field === "province") payload.province = draftProvince.trim().toUpperCase();
    if (field === "region") payload.region = draftRegion.trim().toUpperCase();

    const result = await updateStudentProfile(payload);
    setProfileSaving(false);

    if (!result.ok) {
      setProfileFieldErrors({ [field]: result.message || "Unable to update." });
      return;
    }

    const updatedProfile = result.profile ?? {
      ...(profile ?? {
        barangay: "",
        birthdate: "",
        city: "",
        email: user?.email || "",
        fullName: user?.fullName || "",
        gender: "",
        program: "",
        profilePictureUrl: user?.profilePictureUrl || "",
        province: "",
        region: "",
        street: "",
        studentNumber: user?.studentNumber || "",
      }),
      ...payload,
    };
    setProfile(updatedProfile);

    if (field === "fullName" && user && payload.fullName) {
      const nextName = payload.fullName;
      setUser({
        ...user,
        firstName: nextName.split(/\s+/)[0] || user.firstName,
        fullName: nextName,
      });
    }

    setEditingField(null);
    setProfileFieldErrors({});
    setProfileSnapshot(null);
    setProfileSuccess("Updated successfully.");
  };
return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={30} color="#3D3F43" />
        </Pressable>
        <Text style={styles.topTitle}>
          {activeSection === "help-support" && showContactForm ? "Contact Support" : title}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeSection !== "schedule" ? (
          <Text style={styles.subtitle}>
            {activeSection === "help-support" && showContactForm
              ? "Submit a support request or feedback and we'll get back to you."
              : subtitle}
          </Text>
        ) : null}

        {activeSection === "personal-details" ? (
          <>
            {profileLoading ? <ActivityIndicator color="#70C943" style={styles.loader} /> : null}
            <Card>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Full Name</Text>
                {editingField !== "fullName" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("fullName")}
                    accessibilityLabel="Edit Full Name"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "fullName" ? (
                <>
                  <TextInput
                    autoFocus={true}
                    autoCapitalize="characters"
                    value={draftFullName}
                    onChangeText={setUpperDraft("fullName", setDraftFullName)}
                    placeholder="Full name"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.fullName && <Text style={styles.fieldError}>{profileFieldErrors.fullName}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("fullName")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftFullName)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Student ID</Text>
              </View>
              <Text style={[styles.rowValue, styles.profileReadOnly]}>{profile?.studentNumber || user?.studentNumber || "Not available"}</Text>

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Email</Text>
                {editingField !== "email" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={startEditingEmail}
                    accessibilityLabel="Edit Email"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "email" && isChangingEmail ? (
                <>
                  <TextInput
                    autoFocus={true}
                    value={draftEmail}
                    onChangeText={(value) => {
                      setDraftEmail(value);
                      setEmailChangeStage("idle");
                      setProfileAwaitingEmailOtp(false);
                      setProfileOtpCode("");
                      clearProfileFieldError("email");
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="name@example.com"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.email && <Text style={styles.fieldError}>{profileFieldErrors.email}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("email")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Sending code..." : "Change Email"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{draftEmail || "Not available"}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Program</Text>
                {editingField !== "program" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("program")}
                    accessibilityLabel="Edit Program"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "program" ? (
                <>
                  <SelectField
                    label=""
                    value={draftProgram ? draftProgram.toUpperCase() : ""}
                    options={withCurrentOption(PROGRAM_OPTIONS, draftProgram)}
                    onSelect={(value) => {
                      setDraftProgram(value.toUpperCase());
                      clearProfileFieldError("program");
                    }}
                    placeholder="Select program"
                    labelStyle={styles.rowLabel}
                    containerStyle={styles.profileInput}
                  />
                  {!!profileFieldErrors.program && <Text style={styles.fieldError}>{profileFieldErrors.program}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("program")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftProgram)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Gender</Text>
                {editingField !== "gender" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("gender")}
                    accessibilityLabel="Edit Gender"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "gender" ? (
                <>
                  <SelectField
                    label=""
                    value={draftGender ? draftGender.toUpperCase() : ""}
                    options={withCurrentOption(GENDER_OPTIONS, draftGender)}
                    onSelect={(value) => {
                      setDraftGender(value.toUpperCase());
                      clearProfileFieldError("gender");
                    }}
                    placeholder="Select gender"
                    labelStyle={styles.rowLabel}
                    containerStyle={styles.profileInput}
                  />
                  {!!profileFieldErrors.gender && <Text style={styles.fieldError}>{profileFieldErrors.gender}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("gender")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftGender)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Birthdate</Text>
                <Pressable
                  style={styles.fieldEditButton}
                  onPress={openBirthdatePicker}
                  accessibilityLabel="Edit Birthdate"
                >
                  <Ionicons name="pencil" size={13} color="#4A5D6E" />
                </Pressable>
              </View>
              {editingField === "birthdate" ? (
                <>
                  <Pressable onPress={openBirthdatePicker} style={[styles.datePickerField, styles.profileInput]}>
                    <Text style={draftBirthdate ? styles.datePickerValue : styles.datePickerPlaceholder}>
                      {draftBirthdate ? formatBirthdateDisplay(draftBirthdate) : "Select birthdate"}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#3D5569" />
                  </Pressable>
                  {!!profileFieldErrors.birthdate && <Text style={styles.fieldError}>{profileFieldErrors.birthdate}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("birthdate")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable onPress={openBirthdatePicker} style={styles.readOnlyDatePickerRow}>
                  <Text style={[styles.rowValue, styles.profileReadOnlyText]}>{formatBirthdateDisplay(draftBirthdate)}</Text>
                </Pressable>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Street</Text>
                {editingField !== "street" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("street")}
                    accessibilityLabel="Edit Street"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "street" ? (
                <>
                  <TextInput
                    autoFocus={true}
                    autoCapitalize="characters"
                    value={draftStreet}
                    onChangeText={setUpperDraft("street", setDraftStreet)}
                    placeholder="Street"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.street && <Text style={styles.fieldError}>{profileFieldErrors.street}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("street")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftStreet)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Barangay</Text>
                {editingField !== "barangay" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("barangay")}
                    accessibilityLabel="Edit Barangay"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "barangay" ? (
                <>
                  <SelectField
                    label=""
                    value={draftBarangay ? draftBarangay.toUpperCase() : ""}
                    options={withCurrentOption(BARANGAY_OPTIONS, draftBarangay)}
                    onSelect={(value) => {
                      setDraftBarangay(value.toUpperCase());
                      clearProfileFieldError("barangay");
                    }}
                    placeholder="Select barangay"
                    labelStyle={styles.rowLabel}
                    containerStyle={styles.profileInput}
                  />
                  {!!profileFieldErrors.barangay && <Text style={styles.fieldError}>{profileFieldErrors.barangay}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("barangay")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftBarangay)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>City</Text>
                {editingField !== "city" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("city")}
                    accessibilityLabel="Edit City"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "city" ? (
                <>
                  <TextInput
                    autoFocus={true}
                    autoCapitalize="characters"
                    value={draftCity}
                    onChangeText={setUpperDraft("city", setDraftCity)}
                    placeholder="City"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.city && <Text style={styles.fieldError}>{profileFieldErrors.city}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("city")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftCity)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Province</Text>
                {editingField !== "province" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("province")}
                    accessibilityLabel="Edit Province"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "province" ? (
                <>
                  <TextInput
                    autoFocus={true}
                    autoCapitalize="characters"
                    value={draftProvince}
                    onChangeText={setUpperDraft("province", setDraftProvince)}
                    placeholder="Province"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.province && <Text style={styles.fieldError}>{profileFieldErrors.province}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("province")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftProvince)}</Text>
              )}

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.rowLabel}>Region</Text>
                {editingField !== "region" && (
                  <Pressable
                    style={styles.fieldEditButton}
                    onPress={() => startEditingField("region")}
                    accessibilityLabel="Edit Region"
                  >
                    <Ionicons name="pencil" size={13} color="#4A5D6E" />
                  </Pressable>
                )}
              </View>
              {editingField === "region" ? (
                <>
                  <TextInput
                    autoFocus={true}
                    autoCapitalize="characters"
                    value={draftRegion}
                    onChangeText={setUpperDraft("region", setDraftRegion)}
                    placeholder="Region"
                    placeholderTextColor="#97A1AA"
                    style={[styles.textInput, styles.profileInput]}
                  />
                  {!!profileFieldErrors.region && <Text style={styles.fieldError}>{profileFieldErrors.region}</Text>}
                  <View style={styles.fieldActionsRow}>
                    <Pressable style={[styles.fieldSaveButton, profileSaving && styles.disabledButton]} onPress={() => void handleSaveField("region")} disabled={profileSaving}>
                      <Text style={styles.fieldSaveText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                    <Pressable style={styles.fieldCancelButton} onPress={cancelEditingProfile} disabled={profileSaving}>
                      <Text style={styles.fieldCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.profileReadOnly]}>{toDisplayCaps(draftRegion)}</Text>
              )}
            </Card>

            {!!profileSuccess && <Text style={styles.feedbackSuccessText}>{profileSuccess}</Text>} 
            <PrimaryButton label="Reset Password" onPress={() => openProfilePasswordReset("personal-details")} />
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

                <Text style={styles.scheduleMonthLabel}>{getManilaMonthName(scheduleMonthIndex, scheduleYear)}</Text>

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
                      <Pressable
                        onPress={() => {
                          if (cell.isoDate) setSelectedScheduleDate(cell.isoDate);
                        }}
                        style={[
                          styles.scheduleDayCircle,
                          cell.hasAppointment && styles.scheduleDayCircleBooked,
                          cell.isToday && styles.scheduleDayCircleToday,
                          selectedScheduleDate === cell.isoDate && styles.scheduleDayCircleSelected,
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
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.scheduleLegendRow}>
                <View style={styles.scheduleLegendMarker} />
                <Text style={styles.scheduleLegendText}>Outlined dates are scheduled consultations.</Text>
              </View>
            </View>

            {selectedScheduleDate ? (
              selectedDayAppointments.length ? (
              selectedDayAppointments.map((item) => (
                <View key={item.id} style={styles.scheduleUpcomingShell}>
                  <View style={styles.scheduleUpcomingIcon}>
                    <Ionicons name="calendar-outline" size={20} color="#5A8A36" />
                  </View>
                  <View style={styles.scheduleUpcomingContent}>
                    <View style={styles.scheduleUpcomingHeaderRow}>
                      <Text style={styles.scheduleUpcomingEyebrow}>Selected Day</Text>
                      <Text style={styles.scheduleUpcomingStatus}>{item.status}</Text>
                    </View>
                    <Text style={styles.scheduleUpcomingName}>{item.counselor.fullName}</Text>
                    <Text style={styles.scheduleUpcomingMeta}>
                      {item.appointmentDateLabel} - {item.slotLabel}
                    </Text>
                    {item.counselingType ? (
                      <Text style={styles.scheduleUpcomingMeta}>Counseling type: {item.counselingType}</Text>
                    ) : null}
                    <Text style={styles.scheduleUpcomingMeta}>{item.concern}</Text>
                  </View>
                </View>
              ))
              ) : (
              <View style={styles.scheduleEmptyCard}>
                <Text style={styles.scheduleEmptyTitle}>No consultation on this day</Text>
                <Text style={styles.scheduleEmptyText}>
                  This date does not have a booked consultation.
                </Text>
              </View>
              )
            ) : appointment ? (
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
                <Text style={styles.scheduleEmptyTitle}>
                  {appointments.length === 0 ? "No consultation booked yet" : "No upcoming consultation"}
                </Text>
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
                title="Muni Reminders"
                description="Let Muni remind you to check in, pause, and journal."
                value={muniRemindersEnabled}
                onValueChange={(value) => void handleMuniRemindersToggle(value)}
                bordered
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
              <StatBox label="Entries" value={String(recentEntriesTotalCount || recentEntries.length)} />
              <StatBox label="Unread" value={String(notifications.filter((item) => !item.isRead).length)} />
              <StatBox label="Support" value={appointment ? "1" : "0"} />
            </View>
            <Card title={`Journal Activity · ${(recentEntriesTotalCount || recentEntries.length)} ${(recentEntriesTotalCount || recentEntries.length) === 1 ? "entry" : "entries"}`}>
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
            <Card title={`Recent Notifications (${notificationsTotalCount || notifications.length})`}>
              {notifications.length ? (
                notifications.map((item, index) => (
                  <ActionRow
                    key={item.id}
                    bordered={index > 0}
                    title={item.title}
                    meta={item.timeLabel}
                    body={notificationPreviewsEnabled ? item.message : "Preview hidden. Open notifications to read it."}
                    onPress={() => openNotificationFromActivity(item)}
                  />
                ))
              ) : (
                <EmptyText text="No recent notifications yet." />
              )}
            </Card>
            {notificationsTotalCount > notifications.length ? (
              <SecondaryButton label="View all notifications" onPress={() => router.push("/notifications")} />
            ) : null}
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
          !showContactForm ? (
            <>
              <Card title="Need support right away?">
                <ActionRow
                  title="Call NCMH Crisis Hotline 1553"
                  body="If you or someone nearby needs immediate mental health support, call 1553 now."
                  onPress={() => void Linking.openURL("tel:1553")}
                />
              </Card>

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
                <Faq
                  question="How do I continue a journal entry?"
                  answer="Open Journal, tap View Entries, and choose the entry you want to read."
                />
                <Faq
                  question="What if I need support right away?"
                  answer="Call NCMH Crisis Hotline 1553 if you need immediate help. Use Consult for counseling support, or Talk to Peer when you want a lighter first step."
                  bordered
                />
                <Faq
                  question="Will Muni read my entries automatically?"
                  answer="Muni is artificial intelligence. It responds inside journaling flows and summaries, but it is not a psychometrician or professional care. You stay in control of what you write and finish."
                  bordered
                />
              </Card>

              <PrimaryButton
                label="Contact Support"
                onPress={() => {
                  setShowContactForm(true);
                  setSubmissionType("SUPPORT");
                  setFeedbackCategory(SUPPORT_CATEGORIES[0]);
                  setFeedbackSuccessMessage("");
                  setFeedbackErrors({});
                  setFeedbackErrorBanner("");
                }}
              />
            </>
          ) : (
            <>
              <Card title="Type">
                <View style={styles.chips}>
                  {([
                    { id: "SUPPORT" as const, label: "Support Request" },
                    { id: "FEEDBACK" as const, label: "Feedback" },
                  ]).map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, submissionType === item.id && styles.chipActive]}
                      onPress={() => {
                        setSubmissionType(item.id);
                        setFeedbackCategory(item.id === "SUPPORT" ? SUPPORT_CATEGORIES[0] : FEEDBACK_CATEGORIES[0]);
                        setFeedbackSuccessMessage("");
                        setFeedbackErrorBanner("");
                        if (feedbackErrors.type) {
                          setFeedbackErrors((prev) => ({ ...prev, type: undefined }));
                        }
                      }}
                    >
                      <Text style={[styles.chipText, submissionType === item.id && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {feedbackErrors.type ? (
                  <Text style={styles.fieldError}>{feedbackErrors.type}</Text>
                ) : null}
              </Card>

              <Card title="Category">
                <View style={styles.chips}>
                  {helpCategories.map((category) => (
                    <Pressable
                      key={category}
                      style={[styles.chip, feedbackCategory === category && styles.chipActive]}
                      onPress={() => {
                        setFeedbackCategory(category);
                        setFeedbackSuccessMessage("");
                        setFeedbackErrorBanner("");
                        if (feedbackErrors.category) {
                          setFeedbackErrors((prev) => ({ ...prev, category: undefined }));
                        }
                      }}
                    >
                      <Text style={[styles.chipText, feedbackCategory === category && styles.chipTextActive]}>{category}</Text>
                    </Pressable>
                  ))}
                </View>
                {feedbackErrors.category ? (
                  <Text style={styles.fieldError}>{feedbackErrors.category}</Text>
                ) : null}
              </Card>

              <Card title="Subject">
                <TextInput
                  value={feedbackSubject}
                  onChangeText={(value) => {
                    setFeedbackSubject(value);
                    setFeedbackSuccessMessage("");
                    setFeedbackErrorBanner("");
                    if (feedbackErrors.subject) {
                      setFeedbackErrors((prev) => ({ ...prev, subject: undefined }));
                    }
                  }}
                  placeholder="What is this regarding?"
                  placeholderTextColor="#97A1AA"
                  style={[styles.textInput, feedbackErrors.subject && styles.inputError]}
                />
                {feedbackErrors.subject ? (
                  <Text style={styles.fieldError}>{feedbackErrors.subject}</Text>
                ) : null}
              </Card>

              <Card title="Message">
                <TextInput
                  value={feedbackMessage}
                  onChangeText={(value) => {
                    setFeedbackMessage(value);
                    setFeedbackSuccessMessage("");
                    setFeedbackErrorBanner("");
                    if (feedbackErrors.message) {
                      setFeedbackErrors((prev) => ({ ...prev, message: undefined }));
                    }
                  }}
                  placeholder={
                    submissionType === "SUPPORT"
                      ? "What do you need help with?"
                      : "What happened, what you expected, or what you'd love to see improved."
                  }
                  placeholderTextColor="#97A1AA"
                  multiline
                  textAlignVertical="top"
                  style={[styles.feedbackInput, feedbackErrors.message && styles.inputError]}
                />
                {feedbackErrors.message ? (
                  <Text style={styles.fieldError}>{feedbackErrors.message}</Text>
                ) : null}
              </Card>

              <Card title="Attach image (Optional)">
                {feedbackAttachment ? (
                  <View style={styles.feedbackAttachmentPreview}>
                    <Image source={{ uri: feedbackAttachment.uri }} style={styles.feedbackAttachmentImage} resizeMode="cover" />
                    <View style={styles.feedbackAttachmentInfo}>
                      <Text style={styles.feedbackAttachmentTitle} numberOfLines={1}>
                        {feedbackAttachment.fileName}
                      </Text>
                      <Text style={styles.feedbackAttachmentMeta}>Image attached</Text>
                    </View>
                    <Pressable
                      style={styles.feedbackAttachmentRemove}
                      onPress={() => {
                        setFeedbackAttachment(null);
                        setFeedbackSuccessMessage("");
                      }}
                    >
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

              {feedbackErrorBanner ? (
                <View style={styles.feedbackErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#C93B3B" />
                  <Text style={styles.feedbackErrorBannerText}>{feedbackErrorBanner}</Text>
                </View>
              ) : null}

              {feedbackSuccessMessage ? <Text style={styles.feedbackSuccessText}>{feedbackSuccessMessage}</Text> : null}

              <PrimaryButton
                disabled={feedbackSending}
                label={feedbackSending ? "Submitting..." : "Submit Request"}
                onPress={() => void handleFeedback()}
              />
            </>
          )
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
                <PrimaryButton
                  label="Turn On Journal Lock"
                  onPress={() => openPinConfirm("turn-on")}
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
                  onPress={() => openPinConfirm("turn-off")}
                >
                  <Text style={styles.dangerText}>Turn Off Journal Lock</Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}

        {(!showContactForm || activeSection !== "help-support") && (
        <Pressable
          style={styles.shareFooter}
          onPress={() => router.push("/referral" as never)}
        >
          <Ionicons name="share-social-outline" size={18} color="#4A5F72" />
          <Text style={styles.shareFooterText}>Refer a friend from here too</Text>
        </Pressable>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closePinConfirm}
        transparent
        visible={activeSection === "app-lock" && pinConfirmAction !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinConfirmAction === "turn-off" ? "Turn Off Journal Lock" : "Turn On Journal Lock"}
            </Text>
            <Text style={styles.modalBody}>
              {pinConfirmAction === "turn-off"
                ? "Enter your current PIN to turn Journal Lock off."
                : "Enter your current PIN to turn Journal Lock on again."}
            </Text>
            <TextInput
              autoFocus={false}
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
            {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closePinConfirm}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, pinSaving && styles.modalButtonDisabled]}
                onPress={() => void (pinConfirmAction === "turn-off" ? handleTurnOffJournalLock() : handleTurnOnExistingLock())}
                disabled={pinSaving}
              >
                <Text style={styles.modalPrimaryText}>
                  {pinSaving ? "Checking..." : pinConfirmAction === "turn-off" ? "Turn Off" : "Turn On"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowBirthdatePicker(false)}
        transparent
        visible={isEditingProfile && showBirthdatePicker}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Birthdate</Text>
            <Text style={styles.modalBody}>Select your birthdate from the calendar.</Text>
            <BirthdateCalendarPicker
              value={draftBirthdate}
              onChange={(next) => {
                setDraftBirthdate(next);
                clearProfileFieldError("birthdate");
              }}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setShowBirthdatePicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={() => setShowBirthdatePicker(false)}>
                <Text style={styles.modalPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
              {pinResetVerified
                ? "Choose a new 4-digit PIN. This replaces your old Journal Lock PIN."
                : "We sent an 8-digit code to your current account email. Enter it, then set a new PIN."}
            </Text>
            {!pinResetVerified ? (
              <OtpCodeInput
                length={OTP_LENGTH}
                value={pinResetOtp}
                onChangeCode={(value) => {
                  setPinResetOtp(value);
                  if (pinError) setPinError("");
                }}
                boxStyle={{ width: 28, height: 36 }}
              />
            ) : (
              <>
                <TextInput
                  value={pin}
                  onChangeText={(value) => {
                    setPin(value.replace(/[^0-9]/g, "").slice(0, 4));
                    if (pinError) setPinError("");
                  }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="New 4-digit PIN"
                  placeholderTextColor="#97A1AA"
                  style={styles.textInput}
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
                  placeholder="Confirm new PIN"
                  placeholderTextColor="#97A1AA"
                  style={[styles.textInput, styles.inputGap]}
                />
              </>
            )}
            {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
            {!pinResetVerified ? (
              <Pressable
                style={[styles.secondaryButton, (pinResetResendSeconds > 0 || pinResetSaving) && styles.disabledButton]}
                disabled={pinResetResendSeconds > 0 || pinResetSaving}
                onPress={() => void sendPinResetOtp("resend")}
              >
                <Text style={styles.secondaryText}>
                  {pinResetResendSeconds > 0 ? `Send new code in ${pinResetResendSeconds}s` : pinResetSaving ? "Sending..." : "Send New Code"}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closePinReset}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, pinResetSaving && styles.modalButtonDisabled]}
                onPress={() => void handleResetJournalLockPin()}
                disabled={pinResetSaving}
              >
                <Text style={styles.modalPrimaryText}>
                  {pinResetSaving ? "Saving..." : pinResetVerified ? "Set New PIN" : "Verify Code"}
                </Text>
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

function PrimaryButton({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} onPress={onPress} disabled={disabled}>
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
  primaryButtonDisabled: {
    opacity: 0.58,
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
  feedbackSuccessText: {
    color: "#2E6D25",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  inputError: {
    borderColor: "#D24C59",
    backgroundColor: "#FFF8F8",
  },
  feedbackErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    backgroundColor: "#FDEAEA",
    borderWidth: 1,
    borderColor: "#F7C6C6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  feedbackErrorBannerText: {
    color: "#C93B3B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    flex: 1,
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
  profileInput: { marginBottom: 12 },
  profileReadOnly: { marginBottom: 12, color: "#5A6B7A" },
  detailsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 2,
  },
  detailsHeaderCopy: {
    flex: 1,
    marginBottom: 14,
  },
  editIconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FA",
    borderWidth: 1,
    borderColor: "#DDE4EB",
  },
  fieldActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 2,
    marginBottom: 12,
  },
  fieldSaveButton: {
    flex: 1,
    minHeight: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  fieldSaveText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  fieldCancelButton: {
    minHeight: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  fieldCancelText: {
    color: "#5A6B7A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  fieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  fieldEditButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F4F7FA",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  readOnlyDatePickerRow: {
    marginBottom: 12,
  },
  profileReadOnlyText: {
    color: "#5A6B7A",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  fieldError: {
    color: "#D24C59",
    fontSize: 12,
    lineHeight: 16,
    marginTop: -6,
    marginBottom: 10,
  },
  changeEmailButton: {
    alignSelf: "flex-start",
    marginTop: -6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  changeEmailText: {
    color: "#3D5569",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  birthdateCalendarWrapper: {
    width: "100%",
    marginTop: 4,
    marginBottom: 4,
  },
  birthdateControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    columnGap: 6,
  },
  birthdateArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F4F7FA",
    borderWidth: 1,
    borderColor: "#DDE4EB",
    alignItems: "center",
    justifyContent: "center",
  },
  birthdateArrowBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "#F8FAFC",
  },
  birthdateSelectsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  birthdateMonthSelectWrap: {
    flex: 1.35,
  },
  birthdateYearSelectWrap: {
    flex: 1,
  },
  birthdateSelectContainer: {
    marginBottom: 0,
  },
  birthdateSelectTrigger: {
    minHeight: 36,
    height: 36,
    marginBottom: 0,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    justifyContent: "center",
  },
  birthdateSelectValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2D4053",
  },
  birthdateWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    marginBottom: 6,
  },
  birthdateWeekdayText: {
    width: "14.2857%",
    textAlign: "center",
    color: "#5E7182",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  birthdateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 6,
  },
  birthdateGridCell: {
    width: "14.2857%",
    alignItems: "center",
    justifyContent: "center",
  },
  birthdateGridCellBlank: {
    width: "14.2857%",
    height: 34,
  },
  birthdateDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  birthdateDayCircleSelected: {
    backgroundColor: "#79C943",
    borderColor: "#79C943",
  },
  birthdateDayCircleToday: {
    borderColor: "#79C943",
    backgroundColor: "#F7FFE9",
  },
  birthdateDayCircleDisabled: {
    opacity: 0.3,
  },
  birthdateDayText: {
    color: "#2D4053",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  birthdateDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  birthdateDayTextToday: {
    color: "#356525",
    fontWeight: "800",
  },
  birthdateDayTextDisabled: {
    color: "#9AA6B2",
  },
  birthdateSelectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    backgroundColor: "#F4F8F0",
    borderWidth: 1,
    borderColor: "#DCE9D5",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  birthdateSelectionText: {
    color: "#356525",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  datePickerField: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE4EB",
    backgroundColor: "#FAFCFD",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerValue: {
    color: "#2D4053",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  datePickerPlaceholder: {
    color: "#97A1AA",
    fontSize: 15,
    lineHeight: 20,
  },
  disabledButton: { opacity: 0.62 },
  scheduleDayCircleSelected: {
    borderColor: "#5A8A36",
    borderWidth: 2,
    backgroundColor: "#F3FBE8",
  },
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


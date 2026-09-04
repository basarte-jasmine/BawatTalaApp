import Toast from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, KeyRound, Shield, Trash2, User, X } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { changeAdminPassword, fetchAdminSettings, scheduleAdminAccountDeletion, sendAdminChangePasswordCode, updateAdminSettings } from "../lib/admin-api";
import { validateResetPassword } from "../lib/admin-validation";
import { useAdminPreferences } from "../lib/admin-preferences";

const PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;

const DEFAULT_FORM_STATE = {
  fullName: "",
  email: "",
  roleLabel: "",
  gender: "Prefer not to say",
  profilePictureUrl: "",
  profilePictureSource: "NONE",
  googleProfilePictureUrl: "",
  specialtiesInput: "",
  notifications: {
    receiveEmail: true,
    receiveInApp: true,
    matrix: {
      highRiskFlagged: { inApp: true, email: true },
      newAppointmentBookings: { inApp: true, email: true },
      cancellationsReschedules: { inApp: true, email: true },
      upcomingSessionReminder: { inApp: true, email: true },
      studentNoShow: { inApp: true, email: true },
      activityDigest: { inApp: false, email: false },
      systemMaintenance: { inApp: true, email: true },
    },
  },
  privacy: {
    maskStudentNumbers: false,
    requireCancelReason: true,
  },
  isActive: true,
  createdAt: "",
  updatedAt: "",
};

function formatDateTime(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}


const DEFAULT_NOTIFICATION_MATRIX = {
  highRiskFlagged: { inApp: true, email: true },
  newAppointmentBookings: { inApp: true, email: true },
  cancellationsReschedules: { inApp: true, email: true },
  upcomingSessionReminder: { inApp: true, email: true },
  studentNoShow: { inApp: true, email: true },
  activityDigest: { inApp: false, email: false },
  systemMaintenance: { inApp: true, email: true },
};

const NOTIFICATION_MATRIX_SECTIONS = [
  {
    id: "safety",
    title: "Safety & Crisis",
    rows: [
      {
        key: "highRiskFlagged",
        label: "High-Risk / Flagged Entries",
        description: "Student journal triggers high-risk keyword (Self-harm, crisis).",
        lockInApp: true,
      },
    ],
  },
  {
    id: "appointments",
    title: "Appointments & Scheduling",
    rows: [
      {
        key: "newAppointmentBookings",
        label: "New Appointment Bookings",
        description: "Alerts when a student successfully books a counseling session.",
      },
      {
        key: "cancellationsReschedules",
        label: "Cancellations & Reschedules",
        description: "Instant notices if a session is cancelled or moved.",
      },
      {
        key: "upcomingSessionReminder",
        label: "Upcoming Session Reminder",
        description: "Reminder before a scheduled counseling session.",
      },
      {
        key: "studentNoShow",
        label: "Student No-Show / Missed Session",
        description: "Alerts when a student misses a scheduled counseling session.",
      },
    ],
  },
  {
    id: "summaries",
    title: "Summaries & System",
    rows: [
      {
        key: "activityDigest",
        label: "Weekly / Daily Activity Digest",
        description: "Periodic digest of counseling activity across your caseload.",
      },
      {
        key: "systemMaintenance",
        label: "System & Maintenance Updates",
        description: "Platform maintenance windows and system notices as needed.",
      },
    ],
  },
];

function channelPair(inApp, email) {
  return {
    inApp: Boolean(inApp),
    email: Boolean(email),
  };
}

function normalizeNotifications(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const hasMatrix = source.matrix && typeof source.matrix === "object";
  const legacyAppointments = source.appointmentUpdates !== false;
  const legacyCancellations = source.cancellationAlerts !== false;
  const legacyDigest = Boolean(source.dailyDigest);
  const legacyEmail = source.emailAlerts !== false;
  const legacyInApp = source.mobilePush !== false;

  const matrixSource = hasMatrix ? source.matrix : {};

  const matrix = {
    highRiskFlagged: channelPair(
      true,
      hasMatrix
        ? matrixSource.highRiskFlagged?.email !== false
        : true,
    ),
    newAppointmentBookings: channelPair(
      hasMatrix ? matrixSource.newAppointmentBookings?.inApp !== false : legacyAppointments,
      hasMatrix ? matrixSource.newAppointmentBookings?.email !== false : legacyAppointments && legacyEmail,
    ),
    cancellationsReschedules: channelPair(
      hasMatrix ? matrixSource.cancellationsReschedules?.inApp !== false : legacyCancellations,
      hasMatrix ? matrixSource.cancellationsReschedules?.email !== false : legacyCancellations && legacyEmail,
    ),
    upcomingSessionReminder: channelPair(
      hasMatrix ? matrixSource.upcomingSessionReminder?.inApp !== false : legacyAppointments,
      hasMatrix ? matrixSource.upcomingSessionReminder?.email !== false : legacyAppointments && legacyEmail,
    ),
    studentNoShow: channelPair(
      hasMatrix ? matrixSource.studentNoShow?.inApp !== false : legacyAppointments,
      hasMatrix ? matrixSource.studentNoShow?.email !== false : legacyAppointments && legacyEmail,
    ),
    activityDigest: channelPair(
      hasMatrix ? Boolean(matrixSource.activityDigest?.inApp) : legacyDigest,
      hasMatrix ? Boolean(matrixSource.activityDigest?.email) : legacyDigest && legacyEmail,
    ),
    systemMaintenance: channelPair(
      hasMatrix ? matrixSource.systemMaintenance?.inApp !== false : true,
      hasMatrix ? matrixSource.systemMaintenance?.email !== false : true,
    ),
  };

  matrix.highRiskFlagged.inApp = true;

  return {
    receiveEmail: source.receiveEmail !== undefined ? Boolean(source.receiveEmail) : legacyEmail,
    receiveInApp: source.receiveInApp !== undefined ? Boolean(source.receiveInApp) : legacyInApp,
    matrix,
  };
}

function sanitizeNotificationsForSave(notifications) {
  const normalized = normalizeNotifications(notifications);
  normalized.matrix.highRiskFlagged.inApp = true;
  return normalized;
}

function SwitchToggle({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        disabled
          ? "cursor-not-allowed bg-emerald-600/70 opacity-80"
          : checked
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-slate-300 hover:bg-slate-400"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}


function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 ${disabled ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      <SwitchToggle
        checked={checked}
        disabled={disabled}
        ariaLabel={label}
        onChange={(next) => onChange({ target: { checked: next } })}
      />
    </div>
  );
}

export default function Settings({ onLogout, session }) {
  const { setPreferences } = useAdminPreferences();
  const [pageSession, setPageSession] = useState(session);
  const [activeTab, setActiveTab] = useState("profile");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [pendingProfilePictureUpload, setPendingProfilePictureUpload] = useState(null);
  // Change password state
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordOtpCountdown, setPasswordOtpCountdown] = useState(0);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Delete account state
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (passwordOtpCountdown <= 0) return undefined;
    const timer = setInterval(() => {
      setPasswordOtpCountdown((curr) => Math.max(0, curr - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [passwordOtpCountdown]);

  const tabs = [
    { id: "profile", label: "Account Profile", icon: User },
    { id: "security", label: "Privacy & Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  useEffect(() => {
    async function loadSettings() {
      if (!session?.email) {
        setErrorMessage("Missing admin session. Please sign in again.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchAdminSettings();
        setFormState({
          fullName: data?.profile?.fullName || session?.name || "",
          email: data?.profile?.email || session?.email || "",
          roleLabel: data?.profile?.roleLabel || "Counselor",
          gender: data?.profile?.gender || "Prefer not to say",
          profilePictureUrl: data?.profile?.profilePictureUrl || session?.pictureUrl || "",
          profilePictureSource: data?.profile?.profilePictureSource || (data?.profile?.profilePictureUrl ? "UPLOAD" : "NONE"),
          googleProfilePictureUrl: data?.profile?.googleProfilePictureUrl || session?.pictureUrl || "",
          specialtiesInput: Array.isArray(data?.profile?.specialties) ? data.profile.specialties.join(", ") : "",
          notifications: normalizeNotifications(data?.preferences?.notifications),

          privacy: {
            maskStudentNumbers: Boolean(data?.preferences?.privacy?.maskStudentNumbers),
            requireCancelReason: data?.preferences?.privacy?.requireCancelReason !== false,
          },
          isActive: Boolean(data?.profile?.isActive),
          createdAt: data?.profile?.createdAt || "",
          updatedAt: data?.profile?.updatedAt || "",
        });
        setSavedSnapshot(
          JSON.stringify({
            fullName: data?.profile?.fullName || session?.name || "",
            gender: data?.profile?.gender || "Prefer not to say",
            profilePictureUrl: data?.profile?.profilePictureUrl || session?.pictureUrl || "",
            profilePictureSource: data?.profile?.profilePictureSource || (data?.profile?.profilePictureUrl ? "UPLOAD" : "NONE"),
            specialtiesInput: Array.isArray(data?.profile?.specialties) ? data.profile.specialties.join(", ") : "",
            notifications: normalizeNotifications(data?.preferences?.notifications),

            privacy: {
              maskStudentNumbers: Boolean(data?.preferences?.privacy?.maskStudentNumbers),
              requireCancelReason: data?.preferences?.privacy?.requireCancelReason !== false,
            },
          }),
        );
        setPageSession((current) => ({
          ...(current || {}),
          email: data?.profile?.email || current?.email || "",
          name: data?.profile?.fullName || current?.name || "",
          pictureUrl: data?.profile?.profilePictureUrl || current?.pictureUrl || "",
          role: data?.profile?.role || current?.role || "",
          roleLabel: data?.profile?.roleLabel || current?.roleLabel || "",
        }));
        setPendingProfilePictureUpload(null);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, [session]);

  const profileStats = useMemo(
    () => [
      { label: "Account Role", value: formState.roleLabel || "Not available" },
      { label: "Status", value: formState.isActive ? "Active" : "Inactive" },
      { label: "Joined", value: formatDateTime(formState.createdAt) },
      { label: "Last Updated", value: formatDateTime(formState.updatedAt) },
    ],
    [formState.createdAt, formState.isActive, formState.roleLabel, formState.updatedAt],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (isLoading || !savedSnapshot) return false;
    return (
      JSON.stringify({
        fullName: formState.fullName,
        gender: formState.gender,
        profilePictureUrl: formState.profilePictureUrl,
        profilePictureSource: formState.profilePictureSource,
        specialtiesInput: formState.specialtiesInput,
        notifications: formState.notifications,
        privacy: formState.privacy,
      }) !== savedSnapshot
    );
  }, [formState, isLoading, savedSnapshot]);

  async function handleProfilePictureFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (file.size > PROFILE_PICTURE_LIMIT_BYTES) {
      setErrorMessage("Profile picture must be 5 MB or smaller.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingProfilePictureUpload({
        contentType: file.type,
        dataUrl,
        fileName: file.name,
      });
      setFormState((current) => ({
        ...current,
        profilePictureUrl: dataUrl,
        profilePictureSource: "UPLOAD",
      }));
      setErrorMessage("");
      setSuccessMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the selected image.");
    }
  }

  function handleUseGooglePhoto() {
    setPendingProfilePictureUpload(null);
    setFormState((current) => ({
      ...current,
      profilePictureUrl: current.googleProfilePictureUrl || "",
      profilePictureSource: current.googleProfilePictureUrl ? "GOOGLE" : "NONE",
    }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleRemoveProfilePhoto() {
    setPendingProfilePictureUpload(null);
    setFormState((current) => ({
      ...current,
      profilePictureUrl: "",
      profilePictureSource: "NONE",
    }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  function updateNestedState(section, key, value) {
    setFormState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  }

  async function handleSendPasswordCode() {
    setPasswordErrors({});
    const nextErrors = {};
    if (!currentPassword) {
      nextErrors.currentPassword = "Current password is required.";
    }
    if (!newPassword) {
      nextErrors.newPassword = "New password is required.";
    } else {
      const msg = validateResetPassword({ newPassword, confirmPassword: confirmNewPassword });
      if (msg) {
        nextErrors[msg.toLowerCase().includes("confirm") || msg.toLowerCase().includes("match") ? "confirmNewPassword" : "newPassword"] = msg;
      }
    }
    if (newPassword && currentPassword && newPassword === currentPassword) {
      nextErrors.newPassword = "New password must be different from current password.";
    }
    if (Object.keys(nextErrors).length) {
      setPasswordErrors(nextErrors);
      return;
    }

    try {
      setIsPasswordSubmitting(true);
      const data = await sendAdminChangePasswordCode();
      setPasswordOtpSent(true);
      setPasswordOtpCountdown(data?.resendAfterSeconds || 60);
      setSuccessMessage(data?.message || "Verification code sent to your email.");
    } catch (error) {
      setPasswordErrors({ form: error instanceof Error ? error.message : "Failed to send verification code." });
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  async function handleSubmitChangePassword() {
    setPasswordErrors({});
    if (!passwordOtp.trim()) {
      setPasswordErrors({ otp: "Please enter the verification code from your email." });
      return;
    }

    try {
      setIsPasswordSubmitting(true);
      const data = await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword,
        otp: passwordOtp.trim(),
      });
      setSuccessMessage(data?.message || "Password changed successfully.");
      setIsChangePasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordOtp("");
      setPasswordOtpSent(false);
      setPasswordOtpCountdown(0);
    } catch (error) {
      setPasswordErrors({ form: error instanceof Error ? error.message : "Failed to update password." });
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  async function handleConfirmDeleteAccount() {
    setDeleteAccountError("");
    if (!deletePassword) {
      setDeleteAccountError("Please enter your password to confirm.");
      return;
    }

    try {
      setIsDeletingAccount(true);
      await scheduleAdminAccountDeletion({ password: deletePassword });
      if (onLogout) {
        onLogout();
      }
      window.location.href = "/login?notice=account-scheduled-for-deletion";
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : "Failed to delete account.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      const payload = {
        fullName: formState.fullName,
        gender: formState.gender,
        profilePictureUrl: formState.profilePictureUrl,
        profilePictureSource: formState.profilePictureSource,
        uploadedProfilePicture: pendingProfilePictureUpload,
        specialties: formState.specialtiesInput
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        preferences: {
          notifications: sanitizeNotificationsForSave(formState.notifications),
          privacy: formState.privacy,
        },
      };

      const data = await updateAdminSettings(payload);
      const nextSession = {
        ...(pageSession || {}),
        email: data?.profile?.email || formState.email,
        name: data?.profile?.fullName || formState.fullName,
        pictureUrl: data?.profile?.profilePictureUrl || formState.profilePictureUrl,
        role: data?.profile?.role || pageSession?.role || "",
        roleLabel: data?.profile?.roleLabel || pageSession?.roleLabel || "",
      };
      setPageSession(nextSession);
      const savedNotifications = sanitizeNotificationsForSave(
        data?.preferences?.notifications || formState.notifications,
      );
      setFormState((current) => ({
        ...current,
        roleLabel: data?.profile?.roleLabel || current.roleLabel,
        profilePictureUrl: data?.profile?.profilePictureUrl || current.profilePictureUrl,
        profilePictureSource: data?.profile?.profilePictureSource || current.profilePictureSource,
        googleProfilePictureUrl: data?.profile?.googleProfilePictureUrl || current.googleProfilePictureUrl,
        updatedAt: data?.profile?.updatedAt || current.updatedAt,
        createdAt: data?.profile?.createdAt || current.createdAt,
        isActive: Boolean(data?.profile?.isActive),
        specialtiesInput: Array.isArray(data?.profile?.specialties) ? data.profile.specialties.join(", ") : current.specialtiesInput,
        notifications: savedNotifications,
      }));
      setPendingProfilePictureUpload(null);
      setSavedSnapshot(
        JSON.stringify({
          fullName: data?.profile?.fullName || formState.fullName,
          gender: data?.profile?.gender || formState.gender,
          profilePictureUrl: data?.profile?.profilePictureUrl || formState.profilePictureUrl,
          profilePictureSource: data?.profile?.profilePictureSource || formState.profilePictureSource,
          specialtiesInput: Array.isArray(data?.profile?.specialties) ? data.profile.specialties.join(", ") : formState.specialtiesInput,
          notifications: savedNotifications,
          privacy: formState.privacy,
        }),
      );
      setSuccessMessage(data?.message || "Settings saved successfully.");
      setPreferences(data?.preferences || payload.preferences);
      setErrorMessage("");
      setIsConfirmOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Layout title="System Settings" subtitle="Configure your personal preferences and system defaults." onLogout={onLogout} session={pageSession}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="bt-card-lg rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                {formState.profilePictureUrl ? (
                  <img
                    src={formState.profilePictureUrl}
                    alt={formState.fullName || "Admin"}
                    className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                    {String(formState.fullName || "A")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-slate-900">{formState.fullName || "Admin Account"}</div>
                  <div className="truncate text-sm text-slate-500">{formState.email || "No email available"}</div>
                  <div className="mt-1 text-sm font-medium text-emerald-700">{formState.roleLabel || "Counselor"}</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {profileStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                    <div className="mt-1 text-sm text-slate-800">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bt-card rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                        activeTab === tab.id
                          ? "bg-emerald-50 text-emerald-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${activeTab === tab.id ? "text-emerald-700" : "text-slate-400"}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bt-card-lg rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="text-lg font-semibold text-slate-900">
                {tabs.find((tab) => tab.id === activeTab)?.label || "Settings"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {activeTab === "profile" ? "Keep your admin profile details and counselor specialties up to date." : null}
                {activeTab === "security" ? "Manage account password, privacy preferences, and account deletion settings." : null}
                {activeTab === "notifications" ? "Configure in-app dashboard and email alerts by event. High-risk in-app alerts stay required." : null}
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {isLoading ? <div className="text-sm text-slate-500">Loading settings...</div> : null}

              {!isLoading && activeTab === "profile" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input
                        type="text"
                        value={formState.fullName}
                        onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <input
                        type="email"
                        value={formState.email}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Role</label>
                      <input
                        type="text"
                        value={formState.roleLabel}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Gender</label>
                      <select
                        value={formState.gender}
                        onChange={(event) => setFormState((current) => ({ ...current, gender: event.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Profile Picture</label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleProfilePictureFileChange}
                            className="hidden"
                          />
                        </label>
                        {formState.googleProfilePictureUrl ? (
                          <button
                            type="button"
                            onClick={handleUseGooglePhoto}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                          >
                            Use Google Photo
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleRemoveProfilePhoto}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
                        >
                          Remove Photo
                        </button>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        Upload JPG, PNG, or WEBP images up to 5 MB. Uploaded photos override the Google account picture.
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-600">
                        Current source: {formState.profilePictureSource === "UPLOAD"
                          ? "Uploaded photo"
                          : formState.profilePictureSource === "GOOGLE"
                            ? "Google profile photo"
                            : "No profile photo"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Specialties</label>
                    <textarea
                      value={formState.specialtiesInput}
                      onChange={(event) => setFormState((current) => ({ ...current, specialtiesInput: event.target.value }))}
                      rows={4}
                      placeholder="Anxiety, Family relationship, Academic problems"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <div className="text-xs text-slate-500">Use commas to separate counselor specialties shown across admin scheduling and assignment views.</div>
                  </div>


                </div>
              ) : null}

              {!isLoading && activeTab === "security" ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                          <KeyRound className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-bold text-slate-800">Change Password</div>
                          <div className="text-xs text-slate-500">Update your account password with email verification.</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordErrors({});
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setPasswordOtp("");
                          setPasswordOtpSent(false);
                          setIsChangePasswordModalOpen(true);
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700"
                      >
                        Change Password
                      </button>
                    </div>
                  </div>

                  <ToggleRow
                    label="Mask student numbers in summaries"
                    description="Hide full student numbers in overview-style panels when a quick identifier is enough."
                    checked={Boolean(formState.privacy.maskStudentNumbers)}
                    onChange={(event) => updateNestedState("privacy", "maskStudentNumbers", event.target.checked)}
                  />

                  <ToggleRow
                    label="Require cancellation reason"
                    description="Keep an internal reason field required for admin-initiated appointment cancellations."
                    checked={Boolean(formState.privacy.requireCancelReason)}
                    onChange={(event) => updateNestedState("privacy", "requireCancelReason", event.target.checked)}
                  />

                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                          <Trash2 className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-bold text-rose-900">Delete Account</div>
                          <div className="text-xs text-rose-700/80">
                            Deactivate and schedule your account for permanent deletion after 30 days. You can restore your account anytime within 30 days by signing in.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePassword("");
                          setDeleteAccountError("");
                          setIsDeleteAccountModalOpen(true);
                        }}
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isLoading && activeTab === "notifications" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Receive Email Notifications</div>
                        <div className="mt-1 text-sm text-slate-500">Master switch for email delivery of counseling and system alerts.</div>
                      </div>
                      <SwitchToggle
                        checked={Boolean(formState.notifications.receiveEmail)}
                        onChange={(next) => updateNestedState("notifications", "receiveEmail", next)}
                        ariaLabel="Receive Email Notifications"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Receive In-App Dashboard Alerts</div>
                        <div className="mt-1 text-sm text-slate-500">Master switch for in-app Notifications on the admin dashboard.</div>
                      </div>
                      <SwitchToggle
                        checked={Boolean(formState.notifications.receiveInApp)}
                        onChange={(next) => updateNestedState("notifications", "receiveInApp", next)}
                        ariaLabel="Receive In-App Dashboard Alerts"
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="grid grid-cols-[minmax(0,1.6fr)_88px_88px] items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <div>Event</div>
                        <div className="text-center">In-App</div>
                        <div className="text-center">Email</div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {NOTIFICATION_MATRIX_SECTIONS.map((section) => (
                        <div key={section.id}>
                          <div className="bg-emerald-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
                            {section.title}
                          </div>
                          {section.rows.map((row) => {
                            const channels = formState.notifications.matrix?.[row.key] || DEFAULT_NOTIFICATION_MATRIX[row.key];
                            const lockInApp = Boolean(row.lockInApp);
                            return (
                              <div
                                key={row.key}
                                className="grid grid-cols-[minmax(0,1.6fr)_88px_88px] items-center gap-3 px-4 py-4"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                                  <div className="mt-1 text-sm text-slate-500">{row.description}</div>
                                  {lockInApp ? (
                                    <div className="mt-2 text-xs font-medium text-emerald-700">In-App stays on for safety-critical alerts.</div>
                                  ) : null}
                                </div>
                                <div className="flex justify-center">
                                  <SwitchToggle
                                    checked={lockInApp ? true : Boolean(channels?.inApp)}
                                    disabled={lockInApp}
                                    ariaLabel={`${row.label} in-app`}
                                    onChange={(next) => {
                                      setFormState((current) => ({
                                        ...current,
                                        notifications: {
                                          ...current.notifications,
                                          matrix: {
                                            ...current.notifications.matrix,
                                            [row.key]: {
                                              ...current.notifications.matrix[row.key],
                                              inApp: lockInApp ? true : next,
                                            },
                                          },
                                        },
                                      }));
                                    }}
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <SwitchToggle
                                    checked={Boolean(channels?.email)}
                                    ariaLabel={`${row.label} email`}
                                    onChange={(next) => {
                                      setFormState((current) => ({
                                        ...current,
                                        notifications: {
                                          ...current.notifications,
                                          matrix: {
                                            ...current.notifications.matrix,
                                            [row.key]: {
                                              ...current.notifications.matrix[row.key],
                                              ...(row.key === "highRiskFlagged" ? { inApp: true } : {}),
                                              email: next,
                                            },
                                          },
                                        },
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}


            </div>

            <div className="border-t border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  {hasUnsavedChanges ? "Review the current tab and save when you are ready." : "No changes to save."}
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isLoading || isSaving || !hasUnsavedChanges}
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Save Settings">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Save your updated admin profile details and panel preferences?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Confirm Save"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
      {/* Change Password Modal */}
      {isChangePasswordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Change Password</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {passwordOtpSent
                      ? `Enter the 8-digit verification code sent to ${session?.email || formState.email}`
                      : "Enter your current and new password to request a verification code."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {passwordErrors.form ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {passwordErrors.form}
              </div>
            ) : null}

            {!passwordOtpSent ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {passwordErrors.currentPassword ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.currentPassword}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 chars, uppercase, number, symbol)"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {passwordErrors.newPassword ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.newPassword}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {passwordErrors.confirmNewPassword ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.confirmNewPassword}</p>
                  ) : null}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordModalOpen(false)}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPasswordSubmitting}
                    onClick={handleSendPasswordCode}
                    className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isPasswordSubmitting ? "Sending Code..." : "Send Verification Code"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Email Verification Code (OTP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={passwordOtp}
                    onChange={(e) => setPasswordOtp(e.target.value.trim())}
                    placeholder="Enter 8-digit code"
                    className="w-full rounded-xl border border-slate-200 p-3 text-center text-lg font-mono tracking-widest outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {passwordErrors.otp ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{passwordErrors.otp}</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Didn't receive the code?</span>
                  <button
                    type="button"
                    disabled={passwordOtpCountdown > 0 || isPasswordSubmitting}
                    onClick={handleSendPasswordCode}
                    className="font-bold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {passwordOtpCountdown > 0 ? `Resend code in ${passwordOtpCountdown}s` : "Resend Code"}
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordOtpSent(false)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isPasswordSubmitting || passwordOtp.length < 6}
                    onClick={handleSubmitChangePassword}
                    className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isPasswordSubmitting ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Delete Account Modal */}
      {isDeleteAccountModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Delete Account</h3>
                  <p className="mt-1 text-xs text-rose-700">
                    30-Day Grace Period Before Permanent Deletion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deleteAccountError ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {deleteAccountError}
              </div>
            ) : null}

            <p className="text-sm leading-relaxed text-slate-600">
              Are you sure you want to delete your account? Your account will be deactivated immediately, and all records will be permanently purged after <span className="font-bold text-slate-800">30 days</span>.
            </p>
            <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
              💡 <span className="font-semibold">Need to change your mind?</span> You can restore and reactivate your account at any time within 30 days simply by signing in again.
            </p>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Confirm your password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your current password"
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Keep Account
              </button>
              <button
                type="button"
                disabled={isDeletingAccount || !deletePassword}
                onClick={handleConfirmDeleteAccount}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeletingAccount ? "Scheduling Deletion..." : "Schedule Deletion (30 Days)"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}

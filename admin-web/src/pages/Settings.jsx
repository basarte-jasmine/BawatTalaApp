import Toast from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import { Bell, Palette, Shield, User } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { fetchAdminSettings, updateAdminSettings } from "../lib/admin-api";
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

function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 ${disabled ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
      />
    </label>
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

  const tabs = [
    { id: "profile", label: "Account Profile", icon: User },
    { id: "security", label: "Security & Privacy", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
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
          notifications: {
            appointmentUpdates: data?.preferences?.notifications?.appointmentUpdates !== false,
            cancellationAlerts: data?.preferences?.notifications?.cancellationAlerts !== false,
            dailyDigest: Boolean(data?.preferences?.notifications?.dailyDigest),
            emailAlerts: data?.preferences?.notifications?.emailAlerts !== false,
            mobilePush: data?.preferences?.notifications?.mobilePush !== false,
          },
          appearance: {
            compactCards: Boolean(data?.preferences?.appearance?.compactCards),
            highlightUnread: data?.preferences?.appearance?.highlightUnread !== false,
            reduceMotion: Boolean(data?.preferences?.appearance?.reduceMotion),
            theme: data?.preferences?.appearance?.theme || "light",
          },
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
            notifications: {
              appointmentUpdates: data?.preferences?.notifications?.appointmentUpdates !== false,
              cancellationAlerts: data?.preferences?.notifications?.cancellationAlerts !== false,
              dailyDigest: Boolean(data?.preferences?.notifications?.dailyDigest),
              emailAlerts: data?.preferences?.notifications?.emailAlerts !== false,
              mobilePush: data?.preferences?.notifications?.mobilePush !== false,
            },
            appearance: {
              compactCards: Boolean(data?.preferences?.appearance?.compactCards),
              highlightUnread: data?.preferences?.appearance?.highlightUnread !== false,
              reduceMotion: Boolean(data?.preferences?.appearance?.reduceMotion),
            },
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
        appearance: {
          compactCards: formState.appearance.compactCards,
          highlightUnread: formState.appearance.highlightUnread,
          reduceMotion: formState.appearance.reduceMotion,
        },
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
          notifications: formState.notifications,
          appearance: formState.appearance,
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
      }));
      setPendingProfilePictureUpload(null);
      setSavedSnapshot(
        JSON.stringify({
          fullName: data?.profile?.fullName || formState.fullName,
          gender: data?.profile?.gender || formState.gender,
          profilePictureUrl: data?.profile?.profilePictureUrl || formState.profilePictureUrl,
          profilePictureSource: data?.profile?.profilePictureSource || formState.profilePictureSource,
          specialtiesInput: Array.isArray(data?.profile?.specialties) ? data.profile.specialties.join(", ") : formState.specialtiesInput,
          notifications: formState.notifications,
          appearance: {
            compactCards: formState.appearance.compactCards,
            highlightUnread: formState.appearance.highlightUnread,
            reduceMotion: formState.appearance.reduceMotion,
          },
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
                {activeTab === "security" ? "Review account access details and privacy handling for admin workflows." : null}
                {activeTab === "notifications" ? "Choose which admin alerts should stay visible across web and mobile-related workflows." : null}
                {activeTab === "appearance" ? "Adjust panel display preferences without changing the existing system theme." : null}
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account Access</div>
                      <div className="mt-2 text-sm text-slate-800">{formState.isActive ? "Active admin account" : "Inactive admin account"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sign-in Options</div>
                      <div className="mt-2 text-sm text-slate-800">Password login and Google sign-in remain available based on your current setup.</div>
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
                </div>
              ) : null}

              {!isLoading && activeTab === "notifications" ? (
                <div className="space-y-4">
                  <ToggleRow
                    label="Appointment updates"
                    description="Show alerts when appointments are created, edited, or reassigned."
                    checked={Boolean(formState.notifications.appointmentUpdates)}
                    onChange={(event) => updateNestedState("notifications", "appointmentUpdates", event.target.checked)}
                  />
                  <ToggleRow
                    label="Cancellation alerts"
                    description="Keep cancellation notices enabled for admin and counselor scheduling changes."
                    checked={Boolean(formState.notifications.cancellationAlerts)}
                    onChange={(event) => updateNestedState("notifications", "cancellationAlerts", event.target.checked)}
                  />
                  <ToggleRow
                    label="Daily digest"
                    description="Enable a daily admin summary preference for future reporting views."
                    checked={Boolean(formState.notifications.dailyDigest)}
                    onChange={(event) => updateNestedState("notifications", "dailyDigest", event.target.checked)}
                  />
                  <ToggleRow
                    label="Email alerts"
                    description="Keep email-based notices enabled for important scheduling and admin events."
                    checked={Boolean(formState.notifications.emailAlerts)}
                    onChange={(event) => updateNestedState("notifications", "emailAlerts", event.target.checked)}
                  />
                  <ToggleRow
                    label="Mobile push alignment"
                    description="Keep this preference synced with mobile-related notification handling for appointment updates."
                    checked={Boolean(formState.notifications.mobilePush)}
                    onChange={(event) => updateNestedState("notifications", "mobilePush", event.target.checked)}
                  />
                </div>
              ) : null}

              {!isLoading && activeTab === "appearance" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Theme</div>
                    <div className="mt-2 text-sm text-slate-800">Current admin theme stays on Light Mode to match the rest of the panel.</div>
                  </div>

                  <ToggleRow
                    label="Compact cards"
                    description="Tighten spacing on settings and dashboard cards for denser information display."
                    checked={Boolean(formState.appearance.compactCards)}
                    onChange={(event) => updateNestedState("appearance", "compactCards", event.target.checked)}
                  />
                  <ToggleRow
                    label="Highlight unread items"
                    description="Keep stronger visual emphasis on unread updates and notifications in admin views."
                    checked={Boolean(formState.appearance.highlightUnread)}
                    onChange={(event) => updateNestedState("appearance", "highlightUnread", event.target.checked)}
                  />
                  <ToggleRow
                    label="Reduce motion"
                    description="Prefer simpler transitions in the admin panel where supported."
                    checked={Boolean(formState.appearance.reduceMotion)}
                    onChange={(event) => updateNestedState("appearance", "reduceMotion", event.target.checked)}
                  />
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
    </Layout>
  );
}

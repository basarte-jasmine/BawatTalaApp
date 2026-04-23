import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Clock3,
  Mail,
  MapPin,
  MessageSquare,
  PenSquare,
  Search,
  ShieldAlert,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { fetchAdminStudentProfile, fetchAdminStudents } from "../lib/admin-api";

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatRelativeTime(value) {
  if (!value) return "No entries yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No entries yet";
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  if (status === "Flagged") return "border-rose-100 bg-rose-50 text-rose-700";
  if (status === "Inactive") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-emerald-100 bg-emerald-50 text-emerald-700";
}

function getRiskBadgeClasses(riskLevel) {
  const normalized = String(riskLevel || "NONE").toUpperCase();
  if (normalized === "CRITICAL") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
  if (normalized === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getSupportResponseClasses(response) {
  const normalized = String(response || "").toUpperCase();
  if (normalized === "DECLINED") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "CONTACTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatSupportResponseLabel(response) {
  if (!response) return "No response";
  return String(response)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEntryMode(entry) {
  const messages = Array.isArray(entry?.messages) ? entry.messages : [];
  return messages.some((message) => message.role === "assistant") ? "ai" : "manual";
}

function canViewEntryConversation(entry) {
  return Boolean(entry?.canViewConversation);
}

function ProfileStatCard({ label, tone = "slate", value }) {
  const toneClasses = {
    emerald: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
    rose: "border-rose-100 bg-rose-50/80 text-rose-700",
    slate: "border-slate-200 bg-white text-slate-700",
    violet: "border-violet-100 bg-violet-50/80 text-violet-700",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClasses[tone] || toneClasses.slate}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function ProfileInfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

function DirectoryRow({ student, onViewProfile }) {
  const avatarTone =
    student.status === "Flagged"
      ? "bg-rose-100 text-rose-700"
      : student.status === "Inactive"
        ? "bg-slate-100 text-slate-700"
        : "bg-blue-100 text-blue-700";

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:shadow-md sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${avatarTone}`}>
            {getInitials(student.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-xl font-semibold text-slate-900">{student.fullName}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{student.studentNumber}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {student.program || "Unspecified"}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(student.status)}`}>
                  {student.status}
                </span>
                {student.flaggedEntries > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Flagged
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Course</div>
                <div className="mt-1 font-medium text-slate-800">{student.program || "Unspecified"}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Last Entry</div>
                <div className="mt-1 font-medium text-slate-800">{formatRelativeTime(student.lastEntryAt)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Entries</div>
                <div className="mt-1 font-medium text-slate-800">{student.totalEntries} total</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 xl:pl-4">
          <button
            type="button"
            disabled
            className="min-w-[120px] rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => void onViewProfile(student.studentNumber)}
            className="min-w-[120px] rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryConversation({ entry, studentName }) {
  const messages = Array.isArray(entry.messages) ? entry.messages : [];
  const canViewConversation = canViewEntryConversation(entry);

  if (!canViewConversation) {
    return (
      <div className="rounded-[18px] border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-800">
        Journal content is hidden for privacy. Admins can only view the full conversation for high-risk or flagged entries.
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        No messages recorded for this entry.
      </div>
    );
  }

  if (getEntryMode(entry) !== "ai") {
    return (
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span>{message.role === "assistant" ? "Assistant" : "Student note"}</span>
              <span className="normal-case tracking-normal text-slate-400">{formatDateTime(message.createdAt)}</span>
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-700">{message.text}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isAssistant = message.role === "assistant";
        return (
          <div key={message.id} className={`flex ${isAssistant ? "justify-end" : "justify-start"}`}>
            <div className={`flex max-w-[85%] flex-col gap-1 ${isAssistant ? "items-end" : "items-start"}`}>
              <div className="px-1 text-[11px] font-medium text-slate-400">
                {isAssistant ? "Muni" : studentName} · {formatDateTime(message.createdAt)}
              </div>
              <div
                className={`rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
                  isAssistant
                    ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {message.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentDirectory({ onLogout, session }) {
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function loadStudents(nextSearch = searchTerm, nextProgram = selectedProgram) {
    try {
      setLoading(true);
      const data = await fetchAdminStudents({
        search: nextSearch.trim(),
        program: nextProgram,
      });
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setPrograms(Array.isArray(data?.programs) ? data.programs : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStudents(searchTerm, selectedProgram);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, selectedProgram]);

  async function handleViewProfile(studentNumber) {
    try {
      setSelectedStudentNumber(studentNumber);
      setProfileLoading(true);
      const data = await fetchAdminStudentProfile(studentNumber);
      setStudentProfile(data);
      setProfileError("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to load student profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  const profileEntries = useMemo(
    () => (Array.isArray(studentProfile?.entries) ? studentProfile.entries : []),
    [studentProfile],
  );
  const latestEntry = profileEntries[0] || null;
  const aiEntryCount = profileEntries.filter((entry) => getEntryMode(entry) === "ai").length;
  const addressLine = studentProfile?.profile
    ? [
        studentProfile.profile.street,
        studentProfile.profile.barangay,
        studentProfile.profile.city,
        studentProfile.profile.province,
        studentProfile.profile.region,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Layout title="Student Directory" subtitle="Manage and view enrolled student profiles and journal history." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search students by name, ID, or course..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full lg:w-auto">
            <select
              value={selectedProgram}
              onChange={(event) => setSelectedProgram(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 lg:min-w-[280px]"
            >
              <option value="">All Courses</option>
              {programs.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500 shadow-sm">Loading students...</div> : null}

        {!loading ? (
          <div className="space-y-4">
            {students.length ? (
              students.map((student) => (
                <DirectoryRow key={student.studentNumber} student={student} onViewProfile={handleViewProfile} />
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
                No students matched the current search.
              </div>
            )}
          </div>
        ) : null}

        <Modal
          isOpen={Boolean(selectedStudentNumber)}
          onClose={() => {
            setSelectedStudentNumber("");
            setStudentProfile(null);
            setProfileError("");
          }}
          title={studentProfile?.profile?.fullName || "Student Profile"}
          maxWidth="max-w-6xl"
        >
          {profileLoading ? <div className="py-10 text-sm text-slate-500">Loading student profile...</div> : null}
          {profileError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</div> : null}

          {!profileLoading && studentProfile?.profile ? (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)]">
                <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.38),_transparent_34%),linear-gradient(135deg,#f8f7ff_0%,#ffffff_44%,#f3fbf4_100%)] px-6 py-6 sm:px-8">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-100/60 blur-3xl" />
                  <div className="absolute left-10 top-4 h-24 w-24 rounded-full bg-fuchsia-100/70 blur-2xl" />

                  <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-white text-2xl font-bold text-indigo-600 shadow-[0_16px_36px_-24px_rgba(79,70,229,0.7)] ring-1 ring-indigo-100">
                        {getInitials(studentProfile.profile.fullName)}
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900">{studentProfile.profile.fullName}</h2>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(studentProfile.profile.status)}`}>
                              {studentProfile.profile.status}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCircle2 className="h-4 w-4" />
                              {studentProfile.profile.studentNumber}
                            </span>
                            <span>{studentProfile.profile.program || "Unspecified"}</span>
                            <span>{studentProfile.profile.email || "No email provided"}</span>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              <MapPin className="h-4 w-4" />
                              Address
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{addressLine || "Not provided"}</div>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              <Calendar className="h-4 w-4" />
                              Student Details
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-slate-700">
                              <div>Birthdate: {formatDate(studentProfile.profile.birthdate)}</div>
                              <div>Joined: {formatDate(studentProfile.profile.createdAt)}</div>
                              <div>Last entry: {latestEntry ? formatDate(latestEntry.entryDate) : "No entries yet"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[360px]">
                      <ProfileStatCard label="Entries" value={studentProfile.profile.totalEntries} />
                      <ProfileStatCard label="Flagged" value={studentProfile.profile.flaggedEntries} tone="rose" />
                      <ProfileStatCard label="AI Chats" value={aiEntryCount} tone="violet" />
                      <ProfileStatCard
                        label="Last Active"
                        value={latestEntry ? formatRelativeTime(latestEntry.updatedAt || latestEntry.createdAt) : "N/A"}
                        tone="emerald"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 bg-slate-50/70 px-6 py-5 sm:px-8 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      Profile Summary
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ProfileInfoTile label="Program" value={studentProfile.profile.program || "Unspecified"} />
                      <ProfileInfoTile label="Email" value={studentProfile.profile.email || "Not provided"} />
                      <ProfileInfoTile label="Student Number" value={studentProfile.profile.studentNumber} />
                      <ProfileInfoTile label="Birthdate" value={formatDate(studentProfile.profile.birthdate)} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,#fff7fb_0%,#ffffff_40%,#f9fdf9_100%)] p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ShieldAlert className="h-4 w-4 text-rose-500" />
                        Monitoring Notes
                      </div>
                      {studentProfile.profile.flaggedEntries > 0 ? (
                        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Needs Review</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Stable</span>
                      )}
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-600">
                      {latestEntry?.summary ? latestEntry.summary : "No journal summary is available yet for this student."}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(latestEntry?.concernTags || []).length ? (
                        latestEntry.concernTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">{tag}</span>
                        ))
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">No concern tags yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#f5fff6_100%)] px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Journal Entries</div>
                      <div className="mt-1 text-sm text-slate-500">Complete journal history with summaries, tags, insights, and risk flags.</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                      <PenSquare className="h-3.5 w-3.5" />
                      {profileEntries.length} saved {profileEntries.length === 1 ? "entry" : "entries"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  {profileEntries.length ? (
                    profileEntries.map((entry) => (
                      <div key={entry.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfd_100%)] shadow-[0_18px_48px_-38px_rgba(15,23,42,0.45)]">
                        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(187,247,208,0.32),_transparent_25%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-semibold text-slate-900">{entry.title || "Untitled journal entry"}</div>
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  {getEntryMode(entry) === "ai" ? "Muni-assisted" : "Manual"}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                <span>{formatDate(entry.entryDate)}</span>
                                <span>Updated {formatDateTime(entry.updatedAt)}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRiskBadgeClasses(entry.riskLevel)}`}>
                                {entry.riskLevel}
                              </span>
                              {entry.primaryConcern ? (
                                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{entry.primaryConcern}</span>
                              ) : null}
                              {entry.supportResponse ? (
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportResponseClasses(entry.supportResponse)}`}>
                                  {formatSupportResponseLabel(entry.supportResponse)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[1.35fr,0.95fr]">
                          <div className="space-y-4">
                            <section className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                <BookOpen className="h-4 w-4" />
                                Summary
                              </div>
                              <div className="rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                                {entry.summary || "No generated summary for this entry."}
                              </div>
                            </section>

                            <section className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                                  {canViewEntryConversation(entry)
                                    ? getEntryMode(entry) === "ai"
                                      ? "Conversation Thread"
                                      : "Journal Content"
                                    : "Journal Content Protected"}
                                </div>
                                <div className="text-xs font-medium text-slate-400">
                                  {typeof entry.messageCount === "number"
                                    ? entry.messageCount
                                    : Array.isArray(entry.messages)
                                      ? entry.messages.length
                                      : 0} messages
                                </div>
                              </div>
                              <EntryConversation entry={entry} studentName={studentProfile.profile.fullName} />
                            </section>
                          </div>

                          <div className="space-y-4">
                            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concern Tags</div>
                              <div className="flex flex-wrap gap-2">
                                {entry.concernTags.length ? (
                                  entry.concernTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{tag}</span>
                                  ))
                                ) : (
                                  <span className="text-sm text-slate-500">No tags saved.</span>
                                )}
                              </div>
                            </section>

                            <section className="rounded-[22px] border border-violet-100 bg-[linear-gradient(180deg,#f8f6ff_0%,#ffffff_100%)] p-4 shadow-sm">
                              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-700">
                                <Sparkles className="h-4 w-4" />
                                Muni Analysis
                              </div>
                              {entry.insights.length ? (
                                <ul className="space-y-2 text-sm leading-6 text-slate-700">
                                  {entry.insights.map((insight, index) => (
                                    <li key={`${entry.id}-insight-${index}`} className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm">{insight}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm">No insights generated.</div>
                              )}
                            </section>

                            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                <Clock3 className="h-4 w-4" />
                                Flag Details
                              </div>
                              <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                                {entry.adminFlagReason || "No admin flag reason recorded."}
                              </div>
                              {entry.supportResponseAt ? (
                                <div className="mt-3 text-xs text-slate-500">Last support update: {formatDateTime(entry.supportResponseAt)}</div>
                              ) : null}
                            </section>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      This student does not have journal entries yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </Layout>
  );
}


import Toast from "../components/Toast";
﻿import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Clock3,
  Filter,
  Lock,
  MapPin,
  MessageSquare,
  PenSquare,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import StudentAvatar from "../components/StudentAvatar";
import {
  openAdminStudentJournalEntry,
  fetchAdminStudentDirectoryEntries,
  fetchAdminStudentProfile,
  fetchAdminStudents,
  sendAdminStudentNotification,
} from "../lib/admin-api";
import { maskStudentNumber, useAdminPreferences } from "../lib/admin-preferences";
import { getRiskBadgeClasses, getRiskLevelLabel, normalizeRiskLevel } from "../lib/risk-labels";

const STATUS_FILTERS = [
  { label: "Status: All", value: "" },
  { label: "Active", value: "active" },
  { label: "Flagged", value: "flagged" },
  { label: "Inactive", value: "inactive" },
];

const ENTRY_SCOPE_FILTERS = [
  { label: "All Entries", value: "all" },
  { label: "Flagged", value: "flagged" },
  { label: "Balanced", value: "balanced" },
];

const ENTRY_DATE_FILTERS = [
  { label: "Date", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
];

const PROFILE_ENTRY_FILTERS = [
  { label: "Entries: All", value: "all" },
  { label: "Normal", value: "normal" },
  { label: "Needs Support", value: "support" },
  { label: "Critical Case", value: "critical" },
];
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;

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

function getProfileEntryStatus(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const supportResponse = String(entry?.supportResponse || "").toUpperCase();
  if (["HIGH", "CRITICAL"].includes(riskLevel)) return "critical";
  if (["LOW", "MEDIUM", "MODERATE"].includes(riskLevel) || supportResponse === "DECLINED") return "support";
  return "normal";
}

function profileEntryMatchesFilter(entry, filter) {
  if (!filter || filter === "all") return true;
  return getProfileEntryStatus(entry) === filter;
}

function isDirectoryEntryFlagged(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const supportResponse = String(entry?.supportResponse || "").toUpperCase();
  return ["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"].includes(riskLevel) || supportResponse === "DECLINED";
}

function formatEntryTimestamp(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();
  const time = parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getEntryPreview(entry) {
  return entry?.summary || entry?.adminFlagReason || entry?.title || "No summary is available for this entry.";
}

function SelectShell({ value, onChange, options, className = "" }) {
  return (
    <label className={`relative block ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-transparent bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </label>
  );
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

function DirectoryRow({ student, onMessage, onViewProfile, maskStudentNumbers = false }) {
  const isFlagged = student.status === "Flagged" || student.flaggedEntries > 0;
  const statusLabel = isFlagged ? "Flagged" : student.status;
  const avatarTone =
    isFlagged
      ? "bg-rose-100 text-rose-700"
      : student.status === "Inactive"
        ? "bg-slate-100 text-slate-700"
        : "bg-blue-100 text-blue-700";

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <StudentAvatar
            className="h-14 w-14 rounded-full text-lg font-semibold"
            fallbackClassName={avatarTone}
            fullName={student.fullName}
            profilePictureUrl={student.profilePictureUrl}
          />

          <div className="grid min-w-0 flex-1 gap-x-10 gap-y-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.35fr)_minmax(11rem,0.85fr)_minmax(8rem,0.6fr)_minmax(6rem,0.45fr)] lg:items-start">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight text-slate-950">{student.fullName}</h3>
              <p className="mt-1 text-sm text-slate-500">{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(statusLabel)}`}>
                  {statusLabel}
                </span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Course</div>
              <div className="mt-2 text-sm font-medium text-slate-800">{student.program || "Unspecified"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last Entry</div>
              <div className="mt-2 text-sm font-medium text-slate-800">{formatRelativeTime(student.lastEntryAt)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Entries</div>
              <div className="mt-2 text-sm font-medium text-slate-800">{student.totalEntries} total</div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 xl:pl-4">
          <button
            type="button"
            onClick={() => onMessage(student)}
            className="min-w-[104px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-700"
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => void onViewProfile(student.studentNumber)}
            className="min-w-[104px] rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageModal({ student, title, body, sending, maskStudentNumbers = false, onTitleChange, onBodyChange, onClose, onSend }) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <StudentAvatar
              className="h-10 w-10 rounded-full text-sm"
              fullName={student.fullName}
              profilePictureUrl={student.profilePictureUrl}
            />
            <div>
              <h2 className="font-bold text-slate-900">Message {student.fullName?.split(" ")[0] || "Student"}</h2>
              <div className="text-xs text-slate-500">{maskStudentNumber(student.studentNumber, maskStudentNumbers)} - {student.program || "Unspecified"}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close message modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block text-xs font-semibold text-slate-500">
            Title
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#229365] focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Message
            <textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              rows={6}
              placeholder={`Write a message to ${student.fullName?.split(" ")[0] || "the student"}...`}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[#229365] focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5" />
            Encrypted and logged in the student's confidential record.
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Send message"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentEntriesModal({
  isOpen,
  entries,
  concerns,
  loading,
  error,
  searchTerm,
  entryScope,
  dateRange,
  concern,
  onSearchChange,
  maskStudentNumbers = false,
  onEntryScopeChange,
  onDateRangeChange,
  onConcernChange,
  onClose,
}) {
  if (!isOpen) return null;

  const concernOptions = [
    { label: "Concern", value: "" },
    ...concerns.map((item) => ({ label: item, value: item })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-5 w-5 text-slate-400" />
              <SelectShell value={entryScope} onChange={onEntryScopeChange} options={ENTRY_SCOPE_FILTERS} className="w-40" />
              <SelectShell value={dateRange} onChange={onDateRangeChange} options={ENTRY_DATE_FILTERS} className="w-36" />
              <SelectShell value={concern} onChange={onConcernChange} options={concernOptions} className="w-44" />
            </div>
            <div className="relative w-full xl:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search student or concern..."
                className="h-12 w-full rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Entries</h2>
            <div className="text-sm text-slate-500">Showing <span className="font-semibold text-slate-700">{entries.length}</span> entries</div>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">Loading recent entries...</div> : null}

          {!loading ? (
            <div className="space-y-4">
              {entries.length ? (
                entries.map((entry) => {
                  const flagged = isDirectoryEntryFlagged(entry);
                  const tags = [entry.primaryConcern, ...(Array.isArray(entry.concernTags) ? entry.concernTags : [])]
                    .filter(Boolean)
                    .filter((item, index, list) => list.indexOf(item) === index);
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-[16px] border px-5 py-5 ${
                        flagged ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{entry.fullName || "Unnamed Student"}</div>
                          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-slate-500">
                            <span>{entry.program || "Unspecified"}</span>
                            <span>{maskStudentNumber(entry.studentNumber, maskStudentNumbers)}</span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-400">{formatEntryTimestamp(entry.createdAt || entry.entryDate)}</div>
                      </div>

                      <div className={`mt-4 border-l-2 ${flagged ? "border-violet-300 bg-white/45" : "border-violet-200 bg-violet-50/50"} px-4 py-3`}>
                        <div className="text-sm leading-6 text-slate-700">{getEntryPreview(entry)}</div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {tags.length ? (
                            tags.slice(0, 5).map((tag) => (
                              <span key={`${entry.id}-${tag}`} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">No concern tags</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No entries matched the current filters.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EntryConversation({ entry, studentName, onOpenJournal }) {
  const messages = Array.isArray(entry.messages) ? entry.messages : [];
  const canViewConversation = canViewEntryConversation(entry);

  if (!canViewConversation) {
    const lockedFlaggedEntry = Boolean(entry?.canOpenJournal);
    return (
      <div className="rounded-[18px] border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-800">
        <div>
          {lockedFlaggedEntry
            ? "Journal Lock is on for this student. Only the summary is available until the student's Journal Lock PIN is entered."
            : "Journal content is hidden for privacy. Only entries flagged for counseling review, such as high-risk or trigger-word detections, allow the full conversation to be viewed by authorized staff."}
        </div>
        {lockedFlaggedEntry ? (
          <button
            type="button"
            onClick={() => onOpenJournal?.(entry)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54]"
          >
            <Lock className="h-4 w-4" />
            Open Journal
          </button>
        ) : null}
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
  const [searchParams] = useSearchParams();
  const { preferences } = useAdminPreferences();
  const shouldMaskStudentNumbers = Boolean(preferences.privacy.maskStudentNumbers);
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileEntryFilter, setProfileEntryFilter] = useState("all");
  const [journalUnlockTarget, setJournalUnlockTarget] = useState(null);
  const [journalUnlockPin, setJournalUnlockPin] = useState("");
  const [journalUnlockError, setJournalUnlockError] = useState("");
  const [journalUnlockSaving, setJournalUnlockSaving] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageTitle, setMessageTitle] = useState("Counselor Follow-up");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEntriesModalOpen, setIsEntriesModalOpen] = useState(false);
  const [directoryEntries, setDirectoryEntries] = useState([]);
  const [entryConcerns, setEntryConcerns] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState("");
  const [entrySearchTerm, setEntrySearchTerm] = useState("");
  const [entryScope, setEntryScope] = useState("all");
  const [entryDateRange, setEntryDateRange] = useState("all");
  const [entryConcern, setEntryConcern] = useState("");

  async function loadStudents(nextSearch = searchTerm, nextProgram = selectedProgram, nextStatus = selectedStatus) {
    try {
      setLoading(true);
      const data = await fetchAdminStudents({
        search: nextSearch.trim(),
        program: nextProgram,
        status: nextStatus,
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
    const nextSearch = searchParams.get("search") || "";
    setSearchTerm((current) => (current === nextSearch ? current : nextSearch));
  }, [searchParams]);

  useEffect(() => {
    const studentNumber = searchParams.get("student") || "";
    if (STUDENT_NUMBER_PATTERN.test(studentNumber)) {
      void handleViewProfile(studentNumber);
    }
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStudents(searchTerm, selectedProgram, selectedStatus);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, selectedProgram, selectedStatus]);

  useEffect(() => {
    if (!isEntriesModalOpen) return undefined;

    const timeoutId = window.setTimeout(async () => {
      try {
        setEntriesLoading(true);
        const data = await fetchAdminStudentDirectoryEntries({
          search: entrySearchTerm.trim(),
          entryScope,
          dateRange: entryDateRange,
          concern: entryConcern,
        });
        setDirectoryEntries(Array.isArray(data?.entries) ? data.entries : []);
        setEntryConcerns(Array.isArray(data?.concerns) ? data.concerns : []);
        setEntriesError("");
      } catch (error) {
        setEntriesError(error instanceof Error ? error.message : "Failed to load recent entries.");
      } finally {
        setEntriesLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isEntriesModalOpen, entrySearchTerm, entryScope, entryDateRange, entryConcern]);

  async function handleViewProfile(studentNumber) {
    try {
      setSelectedStudentNumber(studentNumber);
      setProfileEntryFilter("all");
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

  async function handleOpenJournal() {
    if (!journalUnlockTarget?.id || !studentProfile?.profile?.studentNumber) return;
    if (String(journalUnlockPin || "").length < 4) {
      setJournalUnlockError("Enter the 4-digit Journal Lock PIN.");
      return;
    }

    try {
      setJournalUnlockSaving(true);
      const data = await openAdminStudentJournalEntry(
        studentProfile.profile.studentNumber,
        journalUnlockTarget.id,
        journalUnlockPin,
      );
      if (data?.entry) {
        setStudentProfile((current) => {
          if (!current?.entries) return current;
          return {
            ...current,
            entries: current.entries.map((entry) => (entry.id === data.entry.id ? { ...entry, ...data.entry } : entry)),
          };
        });
      }
      setJournalUnlockTarget(null);
      setJournalUnlockError("");
      setSuccessMessage("Journal opened for this flagged entry.");
    } catch (error) {
      setJournalUnlockError(error instanceof Error ? error.message : "Failed to open journal.");
    } finally {
      setJournalUnlockSaving(false);
    }
  }

  async function handleSendMessage() {
    if (!messageTarget?.studentNumber) return;
    try {
      setIsSending(true);
      await sendAdminStudentNotification(messageTarget.studentNumber, {
        title: messageTitle,
        message: messageBody,
      });
      setSuccessMessage(`Message sent to ${messageTarget.fullName || messageTarget.studentNumber}.`);
      setMessageTarget(null);
      setMessageBody("");
      setMessageTitle("Counselor Follow-up");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send student notification.");
    } finally {
      setIsSending(false);
    }
  }

  const profileEntries = useMemo(
    () => (Array.isArray(studentProfile?.entries) ? studentProfile.entries : []),
    [studentProfile],
  );
  const filteredProfileEntries = useMemo(
    () => profileEntries.filter((entry) => profileEntryMatchesFilter(entry, profileEntryFilter)),
    [profileEntries, profileEntryFilter],
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
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:flex-row">
          <div className="relative w-full lg:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, ID, or barangay..."
              className="h-11 w-full rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <SelectShell
            value={selectedProgram}
            onChange={setSelectedProgram}
            options={[
              { label: "Course: All", value: "" },
              ...programs.map((program) => ({ label: program, value: program })),
            ]}
            className="w-full lg:w-56"
          />

          <SelectShell
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={STATUS_FILTERS}
            className="w-full lg:w-44"
          />

          <button
            type="button"
            onClick={() => setIsEntriesModalOpen(true)}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-50 text-slate-700 transition hover:bg-slate-100 lg:w-14"
            aria-label="Open recent entry filters"
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500 shadow-sm">Loading students...</div> : null}

        {!loading ? (
          <div className="space-y-4">
            {students.length ? (
              students.map((student) => (
                <DirectoryRow
                  key={student.studentNumber}
                  student={student}
                  maskStudentNumbers={shouldMaskStudentNumbers}
                  onMessage={(target) => {
                    setMessageTarget(target);
                    setMessageTitle("Counselor Follow-up");
                    setMessageBody("");
                  }}
                  onViewProfile={handleViewProfile}
                />
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
            setProfileEntryFilter("all");
            setJournalUnlockTarget(null);
            setJournalUnlockError("");
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
                      <StudentAvatar
                        className="h-20 w-20 rounded-[28px] text-2xl shadow-[0_16px_36px_-24px_rgba(79,70,229,0.7)] ring-1 ring-indigo-100"
                        fallbackClassName="bg-white text-indigo-600"
                        fullName={studentProfile.profile.fullName}
                        profilePictureUrl={studentProfile.profile.profilePictureUrl}
                      />

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
                              {maskStudentNumber(studentProfile.profile.studentNumber, shouldMaskStudentNumbers)}
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
                      <ProfileInfoTile label="Student Number" value={maskStudentNumber(studentProfile.profile.studentNumber, shouldMaskStudentNumbers)} />
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
                      <div className="mt-1 text-sm text-slate-500">Complete journal history with summaries, summary notes, tags, and risk flags.</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <SelectShell
                        value={profileEntryFilter}
                        onChange={setProfileEntryFilter}
                        options={PROFILE_ENTRY_FILTERS}
                        className="w-full sm:w-44"
                      />
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                        <PenSquare className="h-3.5 w-3.5" />
                        {filteredProfileEntries.length} of {profileEntries.length} saved {profileEntries.length === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  {filteredProfileEntries.length ? (
                    filteredProfileEntries.map((entry) => (
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
                                {getRiskLevelLabel(entry.riskLevel)}
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
                              <EntryConversation
                                entry={entry}
                                studentName={studentProfile.profile.fullName}
                                onOpenJournal={(targetEntry) => {
                                  setJournalUnlockTarget(targetEntry);
                                                        setJournalUnlockError("");
                                }}
                              />
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
                                Muni Summary Notes
                              </div>
                              {entry.insights.length ? (
                                <ul className="space-y-2 text-sm leading-6 text-slate-700">
                                  {entry.insights.map((insight, index) => (
                                    <li key={`${entry.id}-insight-${index}`} className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm">{insight}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm">No summary notes generated.</div>
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
                      {profileEntries.length ? "No journal entries matched this filter." : "This student does not have journal entries yet."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

        <RecentEntriesModal
          isOpen={isEntriesModalOpen}
          entries={directoryEntries}
          concerns={entryConcerns}
          loading={entriesLoading}
          error={entriesError}
          searchTerm={entrySearchTerm}
          entryScope={entryScope}
          dateRange={entryDateRange}
          concern={entryConcern}
          maskStudentNumbers={shouldMaskStudentNumbers}
          onSearchChange={setEntrySearchTerm}
          onEntryScopeChange={setEntryScope}
          onDateRangeChange={setEntryDateRange}
          onConcernChange={setEntryConcern}
          onClose={() => setIsEntriesModalOpen(false)}
        />

        <ConfirmActionModal
          isOpen={Boolean(journalUnlockTarget)}
          onClose={() => {
            if (journalUnlockSaving) return;
            setJournalUnlockTarget(null);
            setJournalUnlockPin("");
            setJournalUnlockError("");
          }}
          onConfirm={() => void handleOpenJournal()}
          title="Open Journal"
          description={journalUnlockError || "Enter the student's 4-digit Journal Lock PIN to view this flagged journal conversation."}
          confirmLabel={journalUnlockSaving ? "Opening..." : "Open Journal"}
          inputLabel="Journal PIN"
          inputPlaceholder="4-digit PIN"
          inputRequired
          inputValue={journalUnlockPin}
          onInputChange={(value) => setJournalUnlockPin(String(value || "").replace(/[^0-9]/g, "").slice(0, 4))}
        />

        <MessageModal
          student={messageTarget}
          title={messageTitle}
          body={messageBody}
          sending={isSending}
          maskStudentNumbers={shouldMaskStudentNumbers}
          onTitleChange={setMessageTitle}
          onBodyChange={setMessageBody}
          onClose={() => setMessageTarget(null)}
          onSend={() => void handleSendMessage()}
        />
      </div>
    </Layout>
  );
}


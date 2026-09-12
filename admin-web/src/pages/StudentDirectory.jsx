import Toast from "../components/Toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
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
  Users,
  X,
  Eye,
  Trash2,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import StudentAvatar from "../components/StudentAvatar";
import {
  deleteAdminStudent,
  openAdminStudentJournalEntry,
  fetchAdminStudentDirectoryEntries,
  fetchAdminStudentProfile,
  fetchAdminStudents,
  fetchAdminStudentFollowUps,
  sendAdminStudentNotification,
} from "../lib/admin-api";
import { isHeadCounselor } from "../lib/admin-roles";
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
  { label: "Muni-Assisted (AI)", value: "ai" },
  { label: "Manual", value: "manual" },
];
const ENTRY_DATE_FILTERS = [
  { label: "Date", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
];
const PROFILE_ENTRY_FLAG_FILTERS = [
  { label: "Flag: All", value: "all" },
  { label: "Critical Case", value: "critical" },
  { label: "Needs Support", value: "support" },
  { label: "Normal", value: "normal" },
];

const PROFILE_ENTRY_TYPE_FILTERS = [
  { label: "Journal Type: All", value: "all" },
  { label: "Muni-Assisted", value: "ai" },
  { label: "Manual Entry", value: "manual" },
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
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}-${match[3]}-${match[1]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const mm = parts.find((p) => p.type === "month")?.value || "01";
  const dd = parts.find((p) => p.type === "day")?.value || "01";
  const yyyy = parts.find((p) => p.type === "year")?.value || "1970";
  return `${mm}-${dd}-${yyyy}`;
}
function formatDateTime(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(parsed);
  const mm = parts.find((p) => p.type === "month")?.value || "01";
  const dd = parts.find((p) => p.type === "day")?.value || "01";
  const yyyy = parts.find((p) => p.type === "year")?.value || "1970";
  const hour = parts.find((p) => p.type === "hour")?.value || "12";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value || "AM";
  return `${mm}-${dd}-${yyyy}, ${hour}:${minute} ${dayPeriod}`;
}
function getStatusClasses(status) {
  if (status === "Flagged") return "border-rose-200 bg-rose-50 text-rose-700 font-bold";
  if (status === "Inactive") return "border-slate-300 bg-slate-100 text-slate-700 font-bold";
  return "border-emerald-200 bg-emerald-50 text-emerald-800 font-bold";
}
function getStudentAction(entry) {
  const raw = entry?.studentAction ?? entry?.supportResponse;
  return String(raw || "").trim().toUpperCase();
}
function getSupportResponseClasses(response) {
  const normalized = String(response || "").toUpperCase();
  if (normalized === "DECLINED" || normalized === "DISMISSED") return "border-rose-200 bg-rose-50 text-rose-700";
  if (
    normalized === "CONTACTED" ||
    normalized === "CLICKED_HOTLINE" ||
    normalized === "SCHEDULED_COUNSELING" ||
    normalized === "VIEWED_WELLNESS"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
function formatStudentActionLabel(action) {
  const normalized = String(action || "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "CLICKED_HOTLINE" || normalized === "CONTACTED") return "Called Hotline";
  if (normalized === "SCHEDULED_COUNSELING") return "Opened Counseling";
  if (normalized === "VIEWED_WELLNESS") return "Opened Wellness Tools";
  if (normalized === "DISMISSED" || normalized === "DECLINED") return "Declined Support";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function getEntryMode(entry) {
  if (entry?.mode === "ai" || entry?.isAiAssisted === true) return "ai";
  if (entry?.mode === "manual" || entry?.isAiAssisted === false) return "manual";
  const messages = Array.isArray(entry?.messages) ? entry.messages : [];
  if (messages.some((message) => String(message?.role || "").toLowerCase() === "assistant")) return "ai";
  return "manual";
}
function canViewEntryConversation(entry) {
  return Boolean(entry?.canViewConversation);
}
function getProfileEntryStatus(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const studentAction = getStudentAction(entry);
  if (["HIGH", "CRITICAL"].includes(riskLevel)) return "critical";
  if (["LOW"].includes(riskLevel) || studentAction === "DECLINED" || studentAction === "DISMISSED") return "support";
  return "normal";
}
function profileEntryMatchesFilter(entry, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "ai") return getEntryMode(entry) === "ai";
  if (filter === "manual") return getEntryMode(entry) !== "ai";
  return getProfileEntryStatus(entry) === filter;
}
function isDirectoryEntryFlagged(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const studentAction = getStudentAction(entry);
  return ["LOW", "HIGH", "CRITICAL"].includes(riskLevel) ||
    studentAction === "DECLINED" ||
    studentAction === "DISMISSED";
}
function EntryModeBadge({ mode, className = "" }) {
  const isAi = mode === "ai";
  return isAi ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-0.5 text-xs font-bold text-purple-700 shadow-sm ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
      <span>Muni-Assisted</span>
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-0.5 text-xs font-bold text-sky-700 shadow-sm ${className}`}
    >
      <PenSquare className="h-3.5 w-3.5 text-sky-600" />
      <span>Manual</span>
    </span>
  );
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
    sky: "border-sky-100 bg-sky-50/80 text-sky-700",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClasses[tone] || toneClasses.slate}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
function ProfileInfoTile({ label, value, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm ${className}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800 break-words">{value}</div>
    </div>
  );
}
function DirectoryRow({ student, onMessage, onViewProfile, onDelete, canDelete = false, maskStudentNumbers = false }) {
  const isDeleted = student.status === "Deleted by student" || Boolean(student.deletedAt) || Boolean(student.isScheduledForDeletion);
  const isFlagged = student.status === "Flagged" || student.flaggedEntries > 0;
  const statusLabel = isDeleted ? "Deleted by student" : isFlagged ? "Flagged" : student.status;
  const avatarTone =
    isDeleted
      ? "bg-rose-100 text-rose-700"
      : isFlagged
        ? "bg-rose-100 text-rose-700"
        : student.status === "Inactive"
          ? "bg-slate-100 text-slate-700"
          : "bg-blue-100 text-blue-700";
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-5 shadow-sm transition-all duration-150 hover:shadow-md">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <StudentAvatar
            className="h-12 w-12 rounded-full text-base font-bold shadow-sm shrink-0"
            fallbackClassName={avatarTone}
            fullName={student.fullName}
            profilePictureUrl={student.profilePictureUrl}
          />
          <div className="grid min-w-0 flex-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.3fr)_minmax(11rem,1fr)_minmax(8rem,0.7fr)_minmax(6rem,0.5fr)] lg:items-center">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900">{student.fullName}</h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs ${getStatusClasses(statusLabel)}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Course</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{student.program || "Unspecified"}</div>
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Last Entry</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{formatRelativeTime(student.lastEntryAt)}</div>
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Entries</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{student.totalEntries} total</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 xl:pl-4">
          <button
            type="button"
            onClick={() => onMessage(student)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => void onViewProfile(student.studentNumber)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0e5a3a] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b482e]"
          >
            <Eye className="h-4 w-4" />
            <span>View Profile</span>
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(student)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
              title="Delete Student Account"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
function MessageModal({
  student,
  maskStudentNumbers = false,
  onClose,
  onSuccess,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Counselor Follow-up");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!student?.studentNumber) return;
    let isMounted = true;
    async function loadHistory() {
      try {
        setLoading(true);
        const data = await fetchAdminStudentFollowUps(student.studentNumber);
        if (!isMounted) return;
        const msgList = Array.isArray(data?.messages)
          ? data.messages
          : (data?.threads || []).flatMap((t) => t.messages || []);
        msgList.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        setMessages(msgList);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load conversation history.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadHistory();
    return () => {
      isMounted = false;
    };
  }, [student?.studentNumber]);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);
  async function handleSend(e) {
    e?.preventDefault();
    if (!body.trim() || sending || !student?.studentNumber) return;
    try {
      setSending(true);
      setError("");
      const payload = {
        title: title.trim() || "Counselor Follow-up",
        message: body.trim(),
      };
      await sendAdminStudentNotification(student.studentNumber, payload);
      const newMsg = {
        id: `local-${Date.now()}`,
        title: payload.title,
        body: payload.message,
        createdAt: new Date().toISOString(),
        from: {
          name: "Guidance Counselor",
          role: "Counselor",
        },
      };
      setMessages((prev) => [...prev, newMsg]);
      setBody("");
      onSuccess?.(`Message sent to ${student.fullName || student.studentNumber}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }
  if (!student) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] max-h-[660px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in duration-150">
        {/* Chat Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3.5">
            <StudentAvatar
              className="h-11 w-11 rounded-full text-sm font-bold shadow-sm"
              fullName={student.fullName}
              profilePictureUrl={student.profilePictureUrl}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{student.fullName}</h2>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Student Channel
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {maskStudentNumber(student.studentNumber, maskStudentNumbers)} • {student.program || "Unspecified"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close conversation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Chat Message Thread Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/70 p-6 space-y-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
              Loading conversation history...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
              {error}
            </div>
          ) : messages.length ? (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className="flex flex-col items-end space-y-1">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-800 p-4 text-white shadow-sm">
                  {msg.title && msg.title !== "Counselor Follow-up" ? (
                    <div className="mb-1 text-xs font-bold text-emerald-200 border-b border-emerald-700/60 pb-1">
                      {msg.title}
                    </div>
                  ) : null}
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.body || msg.message}</p>
                </div>
                <div className="flex items-center gap-1.5 pr-1 text-[11px] font-semibold text-slate-500">
                  <span>{msg.from?.name ? `${msg.from.name}` : "Counselor"}</span>
                  <span>•</span>
                  <span>{formatDateTime(msg.createdAt)}</span>
                  <span>•</span>
                  {msg.isRead ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700" title={msg.readAt ? `Seen ${formatDateTime(msg.readAt)}` : "Seen"}>
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Seen</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400 font-medium" title="Delivered to student">
                      <Check className="h-3.5 w-3.5 text-slate-400" />
                      <span>Delivered</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <MessageSquare className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">No previous messages</p>
              <p className="max-w-sm text-xs font-medium text-slate-500">
                Send a check-in message to {student.fullName?.split(" ")[0] || "this student"}. They will receive it directly in their app.
              </p>
            </div>
          )}
        </div>
        {/* Chat Input Footer */}
        <form onSubmit={handleSend} className="shrink-0 border-t border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Subject:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Counselor Follow-up"
              className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="flex items-end gap-2.5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={`Write a message to ${student.fullName?.split(" ")[0] || "student"}... (Press Enter to send)`}
              className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{sending ? "Sending..." : "Send"}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Lock className="h-3 w-3" />
            <span>Encrypted and logged in student wellness records.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
function getStudentSummaryFeedback(entry) {
  const rating = String(entry?.summaryRating || "").trim().toUpperCase();
  const reason = String(entry?.summaryFeedbackReason || "").trim();
  if (rating !== "HELPFUL" && rating !== "NEEDS_WORK") {
    return null;
  }
  return {
    rating,
    label: rating === "HELPFUL" ? "Helpful" : "Needs work",
    reason,
  };
}
function StudentSummaryFeedback({ entry, emptyMode = "hide" }) {
  const feedback = getStudentSummaryFeedback(entry);
  if (!feedback) {
    if (emptyMode === "hide") return null;
    return <div className="mt-3 text-xs text-slate-400">No student feedback</div>;
  }
  const tone = feedback.rating === "HELPFUL"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`mt-3 rounded-lg border px-4 py-3 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">Student feedback</div>
      <div className="mt-1 text-sm font-bold">{feedback.label}</div>
      {feedback.reason ? <div className="mt-1 text-sm leading-6">{feedback.reason}</div> : null}
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
                        <StudentSummaryFeedback entry={entry} emptyMode="hide" />
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
    const canUnlock = Boolean(entry?.canOpenJournal);
    return (
      <div className="rounded-[18px] border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-800">
        <div>
          {canUnlock
            ? "Journal Lock is on for this student. Conversation stays locked by default - summary and risk details remain available until the Journal Lock PIN is entered."
            : "Journal content is protected for privacy. Summary and risk details remain available."}
        </div>
        {canUnlock ? (
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
  const isHead = isHeadCounselor(session);
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
  const [profileEntryFlagFilter, setProfileEntryFlagFilter] = useState("all");
  const [profileEntryTypeFilter, setProfileEntryTypeFilter] = useState("all");
  const [profileTab, setProfileTab] = useState("overview");
  const [journalUnlockTarget, setJournalUnlockTarget] = useState(null);
  const [journalUnlockPin, setJournalUnlockPin] = useState("");
  const [journalUnlockError, setJournalUnlockError] = useState("");
  const [journalUnlockSaving, setJournalUnlockSaving] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [isEntriesModalOpen, setIsEntriesModalOpen] = useState(false);
  const [directoryEntries, setDirectoryEntries] = useState([]);
  const [entryConcerns, setEntryConcerns] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState("");
  const [entrySearchTerm, setEntrySearchTerm] = useState("");
  const [entryScope, setEntryScope] = useState("all");
  const [entryDateRange, setEntryDateRange] = useState("all");
  const [entryConcern, setEntryConcern] = useState("");
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const summaryStats = useMemo(() => {
    const total = students.length;
    let female = 0;
    let male = 0;
    let active = 0;
    for (const s of students) {
      const g = String(s.gender || "").trim().toLowerCase();
      if (g === "male") male += 1;
      else if (g === "female") female += 1;
      if (s.status === "Active" || Number(s.totalEntries || 0) > 0) active += 1;
    }
    return { total, female, male, active };
  }, [students]);
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
    setProfileEntryFlagFilter("all");
    setProfileEntryTypeFilter("all");
    setProfileTab("overview");
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
  async function handleOpenStudentJournal() {
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
      setJournalUnlockPin("");
      setJournalUnlockError("");
      setSuccessMessage("Journal opened.");
    } catch (error) {
      setJournalUnlockError(error instanceof Error ? error.message : "Failed to open journal.");
    } finally {
      setJournalUnlockSaving(false);
    }
  }
  async function handleConfirmDeleteStudent() {
    if (!studentToDelete?.studentNumber || isDeletingStudent) return;
    const targetNum = studentToDelete.studentNumber;
    const targetName = studentToDelete.fullName || targetNum;
    try {
      setIsDeletingStudent(true);
      setErrorMessage("");
      await deleteAdminStudent(targetNum);
      setStudentToDelete(null);
      setSuccessMessage(`Student account ${targetName} (${targetNum}) has been successfully deleted.`);
      if (selectedStudentNumber === targetNum) {
        setSelectedStudentNumber("");
        setStudentProfile(null);
      }
      await loadStudents();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete student account.");
    } finally {
      setIsDeletingStudent(false);
    }
  }
  const profileEntries = useMemo(
    () => (Array.isArray(studentProfile?.entries) ? studentProfile.entries : []),
    [studentProfile],
  );
  const filteredProfileEntries = useMemo(
    () =>
      profileEntries.filter((entry) => {
        if (profileEntryFlagFilter && profileEntryFlagFilter !== "all") {
          if (getProfileEntryStatus(entry) !== profileEntryFlagFilter) return false;
        }
        if (profileEntryTypeFilter && profileEntryTypeFilter !== "all") {
          if (profileEntryTypeFilter === "ai" && getEntryMode(entry) !== "ai") return false;
          if (profileEntryTypeFilter === "manual" && getEntryMode(entry) === "ai") return false;
        }
        return true;
      }),
    [profileEntries, profileEntryFlagFilter, profileEntryTypeFilter],
  );
  const latestEntry = profileEntries[0] || null;
  const aiEntryCount = profileEntries.filter((entry) => getEntryMode(entry) === "ai").length;
  const manualEntryCount = profileEntries.filter((entry) => getEntryMode(entry) !== "ai").length;
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
        {/* Essential Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Students</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{summaryStats.total}</div>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Female Students</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                <UserCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 sm:text-3xl">{summaryStats.female}</div>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Male Students</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                <UserCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-teal-700 sm:text-3xl">{summaryStats.male}</div>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Active Profiles</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-200/60">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-blue-700 sm:text-3xl">{summaryStats.active}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
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
                  }}
                  onViewProfile={handleViewProfile}
                  onDelete={(target) => setStudentToDelete(target)}
                  canDelete={isHead}
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
            setProfileEntryFlagFilter("all");
            setProfileEntryTypeFilter("all");
            setProfileTab("overview");
            setJournalUnlockTarget(null);
            setJournalUnlockError("");
          }}
          title="Student Profile"
          maxWidth="max-w-5xl"
        >
          {profileLoading ? <div className="py-10 text-sm text-slate-500">Loading student profile...</div> : null}
          {profileError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</div> : null}
          {!profileLoading && studentProfile?.profile ? (
            <div className="space-y-5">
              {/* Identity header — once */}
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(196,181,253,0.38),_transparent_34%),linear-gradient(135deg,#f8f7ff_0%,#ffffff_44%,#f3fbf4_100%)] px-6 py-5 sm:px-7">
                  <div className="relative flex min-w-0 items-start gap-4 sm:gap-5">
                    <StudentAvatar
                      className="h-18 w-18 h-[4.5rem] w-[4.5rem] rounded-[26px] text-2xl shadow-[0_16px_36px_-24px_rgba(79,70,229,0.7)] ring-1 ring-indigo-100"
                      fallbackClassName="bg-white text-indigo-600"
                      fullName={studentProfile.profile.fullName}
                      profilePictureUrl={studentProfile.profile.profilePictureUrl}
                    />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900">{studentProfile.profile.fullName}</h2>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(studentProfile.profile.status)}`}>
                          {studentProfile.profile.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                          <UserCircle2 className="h-4 w-4" />
                          {maskStudentNumber(studentProfile.profile.studentNumber, shouldMaskStudentNumbers)}
                        </span>
                        <span>{studentProfile.profile.email || "No email provided"}</span>
                        <span>{studentProfile.profile.program || "Unspecified"}</span>
                        <span>{studentProfile.profile.gender || "Not provided"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 border-b border-slate-200 bg-slate-50/80 px-3 pt-2 sm:px-5">
                  {[
                    { id: "overview", label: "Overview" },
                    { id: "journals", label: "Journals" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProfileTab(tab.id)}
                      className={`rounded-t-xl px-4 py-2.5 text-sm font-bold transition ${
                        profileTab === tab.id
                          ? "bg-white text-emerald-800 shadow-[0_-1px_0_#fff] border border-b-0 border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {profileTab === "overview" ? (
                  <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                        <Calendar className="h-4 w-4 text-emerald-700" />
                        Demographics & Student Details
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <ProfileInfoTile label="Program / Course" value={studentProfile.profile.program || "Unspecified"} />
                        <ProfileInfoTile label="Birthdate" value={formatDate(studentProfile.profile.birthdate)} />
                        <ProfileInfoTile label="Joined Date" value={formatDate(studentProfile.profile.createdAt)} />
                        <ProfileInfoTile label="Last Entry" value={latestEntry ? formatDate(latestEntry.entryDate) : "No entries yet"} />
                        <ProfileInfoTile label="Address" value={addressLine || "Not provided"} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <ProfileStatCard label="Total Entries" value={studentProfile.profile.totalEntries || profileEntries.length} />
                      <ProfileStatCard label="Flagged" value={studentProfile.profile.flaggedEntries} tone="rose" />
                      <ProfileStatCard label="Muni-Assisted" value={aiEntryCount} tone="violet" />
                      <ProfileStatCard label="Manual Entries" value={manualEntryCount} tone="sky" />
                      <ProfileStatCard
                        label="Last Active"
                        value={latestEntry ? formatRelativeTime(latestEntry.updatedAt || latestEntry.createdAt) : "N/A"}
                        tone="emerald"
                      />
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,#fff7fb_0%,#ffffff_40%,#f9fdf9_100%)] p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <ShieldAlert className="h-4 w-4 text-rose-500" />
                          Latest Journal Summary
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
                      {latestEntry ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRiskBadgeClasses(latestEntry.riskLevel)}`}>
                            {getRiskLevelLabel(latestEntry.riskLevel)}
                          </span>
                          {formatStudentActionLabel(getStudentAction(latestEntry)) ? (
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportResponseClasses(getStudentAction(latestEntry))}`}>
                              {formatStudentActionLabel(getStudentAction(latestEntry))}
                            </span>
                          ) : null}
                          {(latestEntry.studentActionAt || latestEntry.supportResponseAt) ? (
                            <span className="text-xs text-slate-500">
                              Action at {formatDateTime(latestEntry.studentActionAt || latestEntry.supportResponseAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {isHead ? (
                      <div className="flex justify-end border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(studentProfile.profile)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 hover:text-rose-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Student Account
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">Journal Entries</div>
                        <div className="mt-1 text-sm text-slate-500">Filterable journal history with summaries, tags, and risk flags.</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <SelectShell
                          value={profileEntryFlagFilter}
                          onChange={(val) => setProfileEntryFlagFilter(val)}
                          options={PROFILE_ENTRY_FLAG_FILTERS}
                          className="w-full sm:w-44"
                        />
                        <SelectShell
                          value={profileEntryTypeFilter}
                          onChange={(val) => setProfileEntryTypeFilter(val)}
                          options={PROFILE_ENTRY_TYPE_FILTERS}
                          className="w-full sm:w-48"
                        />
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm whitespace-nowrap">
                          <PenSquare className="h-3.5 w-3.5" />
                          {filteredProfileEntries.length} of {profileEntries.length} saved {profileEntries.length === 1 ? "entry" : "entries"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {filteredProfileEntries.length ? (
                        filteredProfileEntries.map((entry) => {
                          const studentAction = getStudentAction(entry);
                          const studentActionLabel = formatStudentActionLabel(studentAction);
                          const studentActionAt = entry.studentActionAt || entry.supportResponseAt;
                          return (
                            <div key={entry.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfd_100%)] shadow-[0_18px_48px_-38px_rgba(15,23,42,0.45)]">
                              <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(187,247,208,0.32),_transparent_25%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-lg font-bold text-slate-900">{entry.title || "Untitled journal entry"}</div>
                                      <EntryModeBadge mode={getEntryMode(entry)} />
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
                                    {studentActionLabel ? (
                                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportResponseClasses(studentAction)}`}>
                                        {studentActionLabel}
                                      </span>
                                    ) : null}
                                    {entry?.isDeletedByStudent || entry?.deletedByStudentAt ? (
                                      <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                        Deleted by student
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
                                    <StudentSummaryFeedback entry={entry} emptyMode="label" />
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
                                        setJournalUnlockPin("");
                                        setJournalUnlockError("");
                                        setJournalUnlockTarget(targetEntry);
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
                                    {entry?.isDeletedByStudent || entry?.deletedByStudentAt ? (
                                      <div className="mt-3">
                                        <div className="text-xs font-semibold text-slate-400">Entry Visibility</div>
                                        <div className="mt-1 text-sm font-extrabold text-rose-600">
                                          Deleted by student
                                          {entry?.deletedByStudentAt ? ` (${formatDateTime(entry.deletedByStudentAt)})` : ""}
                                        </div>
                                      </div>
                                    ) : null}
                                    {studentActionLabel ? (
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSupportResponseClasses(studentAction)}`}>
                                          {studentActionLabel}
                                        </span>
                                        {studentActionAt ? (
                                          <span className="text-xs text-slate-500">Action at {formatDateTime(studentActionAt)}</span>
                                        ) : null}
                                      </div>
                                    ) : studentActionAt ? (
                                      <div className="mt-3 text-xs text-slate-500">Last support update: {formatDateTime(studentActionAt)}</div>
                                    ) : null}
                                  </section>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          {profileEntries.length ? "No journal entries matched this filter." : "This student does not have journal entries yet."}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
          onConfirm={() => void handleOpenStudentJournal()}
          title="Open Journal"
          description={journalUnlockError || "Enter the student's 4-digit Journal Lock PIN to view this protected journal conversation."}
          confirmLabel={journalUnlockSaving ? "Opening..." : "Open Journal"}
          inputLabel="Journal Lock PIN"
          inputRequired
          inputType="pin"
          inputValue={journalUnlockPin}
          onInputChange={(value) => {
            setJournalUnlockError("");
            setJournalUnlockPin(String(value || "").replace(/[^0-9]/g, "").slice(0, 4));
          }}
        />
        <MessageModal
          student={messageTarget}
          maskStudentNumbers={shouldMaskStudentNumbers}
          onClose={() => setMessageTarget(null)}
          onSuccess={(msg) => {
            setSuccessMessage(msg || "Message sent.");
            setMessageTarget(null);
          }}
        />
        <ConfirmActionModal
          isOpen={Boolean(studentToDelete)}
          onClose={() => {
            if (!isDeletingStudent) setStudentToDelete(null);
          }}
          onConfirm={() => { if (!isDeletingStudent) void handleConfirmDeleteStudent(); }}
          title="Permanently Delete Student Account?"
          description={`Are you sure you want to permanently delete student account ${studentToDelete?.fullName || ""} (${studentToDelete?.studentNumber || ""})? ALL data including journal entries, conversations, moods, appointments, support tickets, rewards, and login credentials will be permanently erased from the database. This action cannot be undone.`}
          cancelLabel="Cancel"
          confirmLabel={isDeletingStudent ? "Deleting..." : "Delete Permanently"}
          confirmTone="rose"
        />
      </div>
    </Layout>
  );
}

import Toast from "../components/Toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Lock,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import StudentAvatar from "../components/StudentAvatar";
import {
  fetchAdminRiskFlags,
  fetchAdminStudentProfile,
  sendAdminStudentNotification,
  updateAdminJournalFlag,
  fetchAdminStudentFollowUps,
} from "../lib/admin-api";
import { maskStudentNumber, useAdminPreferences } from "../lib/admin-preferences";
import {
  getSafetyStatusDetailLabel,
  getSafetyStatusLabel,
  isClarificationSafetyStatus,
  isConfirmedCriticalSafetyStatus,
  normalizeSignal,
} from "../lib/risk-labels";
import { PROGRAM_OPTIONS } from "../lib/register-data";

const CRITICAL = "#EF4444";
const SUPPORT = "#FBBF24";
const MANILA_TIMEZONE = "Asia/Manila";
const CRISIS_FREQUENCY_WINDOW_DAYS = 14;

const TABS = ["All", "Critical Case", "Support Needed", "Resolved"];
const TAB_META = {
  All: { icon: null },
  "Critical Case": { icon: AlertTriangle, color: CRITICAL },
  "Support Needed": { icon: ShieldAlert, color: SUPPORT },
  Resolved: { icon: CheckCircle2, color: "#3FA34D" },
};
const DATE_FILTERS = [
  { label: "All Dates", value: "all" },
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
];
const FLAG_OPTIONS = [
  { label: "Critical Case", value: "HIGH" },
  { label: "Support Needed", value: "LOW" },
  { label: "None", value: "NONE" },
];

const PRIMARY_CONCERN_OPTIONS = [
  "Personal problems",
  "Mental health",
  "Academic problems",
  "Interpersonal relationships",
  "Peer",
  "Family",
  "Romantic",
  "Career guidance",
  "Financial guidance",
  "Burnout / Exhaustion",
  "Anxiety",
  "Stress",
  "Bullying",
  "Adjustment",
  "Others",
];

const RESOLUTION_ACTION_OPTIONS = [
  "Reached out to student",
  "Spoke with student",
  "Scheduled counseling session",
  "Referred to hotline / emergency support",
  "Safety plan / resources provided",
  "Coordinated with another counselor",
  "Monitoring / follow-up planned",
  "No further action needed",
  "Other",
];

function normalizeRiskLevel(value) {
  return String(value || "NONE").trim().toUpperCase();
}

function isCritical(entry) {
  return ["HIGH", "CRITICAL"].includes(normalizeRiskLevel(entry?.riskLevel));
}

function isSupportNeeded(entry) {
  return ["LOW", "MEDIUM", "MODERATE"].includes(normalizeRiskLevel(entry?.riskLevel));
}

function isResolved(entry) {
  return Boolean(entry?.counselorResolvedAt);
}

function getEntryFlag(entry) {
  if (isResolved(entry)) return "Resolved";
  // Two-phase: CONFIRMED_CRITICAL is Critical Case; CLARIFICATION_NEEDED is not fully confirmed crisis.
  if (isConfirmedCriticalSafetyStatus(entry)) return "Critical Case";
  if (isCritical(entry) || normalizeSignal(entry) === "CRITICAL") {
    if (isClarificationSafetyStatus(entry)) return "Support Needed";
    return "Critical Case";
  }
  if (
    isSupportNeeded(entry) ||
    normalizeSignal(entry) === "DISTRESS" ||
    String(entry?.supportResponse || "").toUpperCase() === "DECLINED" ||
    String(entry?.studentAction || "").toUpperCase() === "DISMISSED"
  ) {
    return "Support Needed";
  }
  return "Balanced";
}

function entryMatchesFlag(entry, flag) {
  if (flag === "All") return true;
  if (flag === "Resolved") return isResolved(entry);
  if (flag === "Critical Case") return !isResolved(entry) && getEntryFlag(entry) === "Critical Case";
  if (flag === "Support Needed") {
    return !isResolved(entry) && getEntryFlag(entry) === "Support Needed";
  }
  return false;
}

function studentMatchesFlag(student, flag) {
  if (flag === "All") return true;
  return student.entries.some((entry) => entryMatchesFlag(entry, flag));
}

function flagColor(flag) {
  if (flag === "Critical Case") return CRITICAL;
  if (flag === "Support Needed") return SUPPORT;
  if (flag === "Resolved") return "#3FA34D";
  return "#94A3B8";
}

function formatDate(value, options = {}) {
  if (!value) return "Not available";
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split("-");
    return mm + "-" + dd + "-" + yyyy;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(options.withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  }).formatToParts(parsed);
  const mm = parts.find((p) => p.type === "month")?.value || "01";
  const dd = parts.find((p) => p.type === "day")?.value || "01";
  const yyyy = parts.find((p) => p.type === "year")?.value || "1970";
  const dateStr = mm + "-" + dd + "-" + yyyy;
  if (options.withTime) {
    const hour = parts.find((p) => p.type === "hour")?.value || "12";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value || "AM";
    return dateStr + ", " + hour + ":" + minute + " " + dayPeriod;
  }
  return dateStr;
}

function getConcernTags(entry) {
  return [entry?.primaryConcern, ...(Array.isArray(entry?.concernTags) ? entry.concernTags : [])]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function getEntryDateValue(entry) {
  return entry?.createdAt || entry?.entryDate || entry?.updatedAt || "";
}

function riskSeverityRank(entry) {
  const level = normalizeRiskLevel(entry?.riskLevel);
  if (["HIGH", "CRITICAL"].includes(level)) return 3;
  if (["LOW", "MEDIUM", "MODERATE"].includes(level)) return 2;
  const supportResponse = String(entry?.supportResponse || "").toUpperCase();
  const studentAction = String(entry?.studentAction || "").toUpperCase();
  if (supportResponse === "DECLINED" || studentAction === "DISMISSED") return 2;
  return 1;
}

function isFinishedEntry(entry) {
  if (!entry) return true;
  if (typeof entry.isFinished === "boolean") return entry.isFinished;
  if (typeof entry.is_finished === "boolean") return entry.is_finished;
  // Risk-flags list is finished-only; missing field means treat as finished.
  return true;
}

function isUnresolvedFlagged(entry) {
  return isFlaggedEntry(entry) && !isResolved(entry);
}

function pickMostSevereUnresolvedEntry(entries) {
  const list = Array.isArray(entries) ? entries : [];
  // Official queue prefers finished entries; unfinished mid-chat stays labeled, not primary.
  const finished = list.filter(isFinishedEntry);
  const scope = finished.length ? finished : list;
  const unresolved = scope.filter(isUnresolvedFlagged);
  const pool = unresolved.length ? unresolved : scope;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    const finishedDiff = Number(isFinishedEntry(b)) - Number(isFinishedEntry(a));
    if (finishedDiff) return finishedDiff;
    const rankDiff = riskSeverityRank(b) - riskSeverityRank(a);
    if (rankDiff) return rankDiff;
    return new Date(getEntryDateValue(b)) - new Date(getEntryDateValue(a));
  })[0];
}

function splitActiveAndHistoricalTags(entries) {
  const active = [];
  const historical = [];
  const seenActive = new Set();
  const seenHistorical = new Set();
  (entries || []).forEach((entry) => {
    const tags = getConcernTags(entry);
    const resolved = isResolved(entry);
    const dest = resolved ? historical : active;
    const seen = resolved ? seenHistorical : seenActive;
    tags.forEach((tag) => {
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      dest.push(tag);
    });
  });
  return {
    activeTags: active,
    historicalTags: historical.filter((tag) => !seenActive.has(tag)),
  };
}

function formatEntryLabel(entry) {
  const dateStr = formatDate(getEntryDateValue(entry), { withTime: true });
  const title = String(entry?.title || "").trim();
  if (title) return title + " · " + dateStr;
  return getEntryFlag(entry) + " · " + dateStr;
}

function isFlaggedEntry(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const supportResponse = String(entry?.supportResponse || "").toUpperCase();
  const studentAction = String(entry?.studentAction || "").toUpperCase();
  return ["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"].includes(riskLevel) ||
    supportResponse === "DECLINED" ||
    studentAction === "DISMISSED";
}

function getGroupFlag(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.some((entry) => !isResolved(entry) && getEntryFlag(entry) === "Critical Case")) return "Critical Case";
  if (list.some((entry) => !isResolved(entry) && getEntryFlag(entry) === "Support Needed")) return "Support Needed";
  if (list.some(isResolved)) return "Resolved";
  return "Balanced";
}

function countCrisisFlagsInWindow(entries, windowDays = CRISIS_FREQUENCY_WINDOW_DAYS) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return (entries || []).filter((entry) => {
    if (!isCritical(entry)) return false;
    const ts = new Date(getEntryDateValue(entry)).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

function getFlagReason(entry) {
  return entry?.adminFlagReason || "No reason recorded";
}

function getStudentActionLabel(entry) {
  const action = String(entry?.studentAction || entry?.supportResponse || "").toUpperCase();
  if (action === "CLICKED_HOTLINE" || action === "CONTACTED") return "Called hotline";
  if (action === "SCHEDULED_COUNSELING") return "Scheduled counseling";
  if (action === "VIEWED_WELLNESS") return "Opened wellness tools";
  if (action === "DISMISSED" || action === "DECLINED") return "Dismissed prompt";
  return "";
}

function groupEntriesByStudent(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = entry.studentNumber || entry.email || entry.fullName || entry.id;
    const existing = groups.get(key) || {
      studentNumber: entry.studentNumber,
      fullName: entry.fullName || "Unnamed Student",
      email: entry.email || "",
      program: entry.program || "Unspecified",
      profilePictureUrl: entry.profilePictureUrl || "",
      entries: [],
    };
    existing.entries.push(entry);
    groups.set(key, existing);
  });

  return [...groups.values()]
    .map((group) => {
      const sortedEntries = [...group.entries].sort((a, b) => {
        const finishedDiff = Number(isFinishedEntry(b)) - Number(isFinishedEntry(a));
        if (finishedDiff) return finishedDiff;
        return new Date(b.createdAt || b.entryDate) - new Date(a.createdAt || a.entryDate);
      });
      const latestEntry = sortedEntries[0] || {};
      const crisisFlagsLast14Days = countCrisisFlagsInWindow(sortedEntries);
      const { activeTags, historicalTags } = splitActiveAndHistoricalTags(sortedEntries);
      return {
        ...group,
        entries: sortedEntries,
        latestEntry,
        flag: getGroupFlag(sortedEntries),
        concernTags: [...new Set(sortedEntries.flatMap(getConcernTags))],
        activeTags,
        historicalTags,
        crisisFlagsLast14Days,
      };
    })
    .sort((a, b) => new Date(b.latestEntry.createdAt || b.latestEntry.entryDate) - new Date(a.latestEntry.createdAt || a.latestEntry.entryDate));
}

function FlagBadge({ flag }) {
  const color = flagColor(flag);
  const Icon = flag === "Resolved" ? CheckCircle2 : flag === "Critical Case" ? AlertTriangle : ShieldAlert;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color }}>
      <Icon className="h-4 w-4" style={{ color }} />
      {flag}
    </span>
  );
}

function FlagPill({ flag }) {
  const Icon = flag === "Resolved" ? CheckCircle2 : flag === "Critical Case" ? AlertTriangle : ShieldAlert;
  const className =
    flag === "Critical Case"
      ? "bg-[#EF4444] text-white"
      : flag === "Support Needed"
        ? "bg-[#FBBF24] text-white"
        : flag === "Resolved"
          ? "bg-[#3FA34D] text-white"
          : "bg-slate-100 text-slate-600";

  return (
    <span className={"inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold " + className}>
      <Icon className="h-4 w-4" />
      {flag}
    </span>
  );
}

function CountBadge({ children, active }) {
  return (
    <span className={"rounded-md px-2 py-0.5 text-xs font-bold " + (active ? "bg-[#134611]/15 text-[#134611]" : "bg-slate-100 text-slate-500")}>
      {children}
    </span>
  );
}

function FilterTabs({ activeTab, counts, onChange }) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const Icon = TAB_META[tab]?.icon;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={"inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition " + (
              isActive ? "bg-[#e7f1ed] text-[#134611]" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {Icon ? <Icon className="h-4 w-4" style={{ color: isActive ? TAB_META[tab].color : undefined }} /> : null}
            {tab}
            <CountBadge active={isActive}>{counts[tab] || 0}</CountBadge>
          </button>
        );
      })}
    </div>
  );
}

function FlaggedStudentRow({ student, onReview, maskStudentNumbers = false }) {
  return (
    <tr className="border-b border-emerald-100/60 bg-white text-sm shadow-sm transition hover:shadow-md last:border-b-0">
      <td className="rounded-l-2xl px-5 py-4">
        <div className="flex items-center gap-3.5">
          <StudentAvatar
            className="h-11 w-11 rounded-full text-base"
            fullName={student.fullName}
            profilePictureUrl={student.profilePictureUrl}
          />
          <div>
            <div className="font-black text-slate-900 tracking-wide uppercase text-sm">{student.fullName}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex max-w-sm flex-wrap gap-1.5">
          {(student.activeTags || []).map((tag) => (
            <span key={student.studentNumber + "-active-" + tag} className="rounded-full border border-amber-300 bg-amber-50/70 px-3 py-1 text-xs font-semibold text-amber-800">
              {tag}
            </span>
          ))}
          {(student.historicalTags || []).slice(0, 2).map((tag) => (
            <span key={student.studentNumber + "-hist-" + tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-400">
              {tag}
            </span>
          ))}
          {(student.historicalTags || []).length > 2 ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-400">
              {/* + past */}
              {"+" + ((student.historicalTags || []).length - 2) + " past"}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4">
        <FlagBadge flag={student.flag} />
      </td>
      <td className="px-5 py-4 text-center">
        <div className="text-base font-black text-slate-900">{student.entries.length}</div>
        {student.crisisFlagsLast14Days >= 2 ? (
          <div className="mt-1 inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-[#EF4444]">
            {student.crisisFlagsLast14Days} elevated well-being risk flags in 14d
          </div>
        ) : null}
      </td>
      <td className="px-5 py-4 font-semibold text-slate-700 text-sm">
        {formatDate(student.latestEntry.createdAt || student.latestEntry.entryDate, { withTime: true })}
      </td>
      <td className="rounded-r-2xl px-5 py-4 text-right">
        <button
          type="button"
          onClick={() => onReview(student)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0e5a3a] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b482e]"
        >
          <Eye className="h-4 w-4" />
          Review
          <ChevronRight className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function EntryCard({ entry, isSelected, onSelect }) {
  const flag = getEntryFlag(entry);
  const actionLabel = getStudentActionLabel(entry);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={
        "w-full rounded-2xl border bg-white p-4 text-left transition " +
        (isSelected
          ? "border-[#229365] ring-2 ring-emerald-100 shadow-sm"
          : "border-slate-200 hover:border-emerald-200")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {formatEntryLabel(entry)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {!isFinishedEntry(entry) ? (
            <span
              className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700"
              title="Mid-chat / not finished — not the official Flagged case yet"
            >
              In progress
            </span>
          ) : null}
          {getSafetyStatusLabel(entry) ? (
            <span
              className={
                "rounded-md px-2 py-0.5 text-xs font-bold " +
                (isClarificationSafetyStatus(entry)
                  ? "border border-violet-200 bg-violet-50 text-violet-700"
                  : isConfirmedCriticalSafetyStatus(entry)
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700")
              }
              title={isClarificationSafetyStatus(entry) ? "Needs clarification — not a fully confirmed well-being risk yet" : isConfirmedCriticalSafetyStatus(entry) ? "Confirmed risk (Critical Case)" : "Well-being safety status"}
            >
              {getSafetyStatusLabel(entry)}
            </span>
          ) : null}
          <span
            className={
              "rounded-md px-2 py-0.5 text-xs font-bold " +
              (isResolved(entry)
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-amber-200 bg-amber-50 text-amber-700")
            }
          >
            {isResolved(entry) ? "Resolved" : "Pending"}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {getConcernTags(entry).slice(0, 3).map((tag) => (
          <span key={entry.id + "-" + tag} className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {tag}
          </span>
        ))}
      </div>
      {actionLabel ? (
        <div className="mt-2 text-xs font-semibold text-slate-500">
          Intervention: <span className="text-slate-800">{actionLabel}</span>
        </div>
      ) : null}
      <div className="mt-3">
        <FlagPill flag={flag} />
      </div>
    </button>
  );
}

function JournalEntryViewer({ entry }) {
  const visibleMessages = Array.isArray(entry?.messages) ? entry.messages.filter((message) => message.text) : [];

  if (visibleMessages.length) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {visibleMessages.map((message) => {
          const role = String(message.role || "").toLowerCase();
          const isUser = role === "user" || role === "student";
          return (
            <div
              key={message.id || entry.id + "-" + message.createdAt}
              className={"flex " + (isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={
                  "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm " +
                  (isUser
                    ? "rounded-br-md bg-[#229365] text-white"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-700")
                }
              >
                <div
                  className={
                    "mb-1 text-[11px] font-bold uppercase tracking-wide " +
                    (isUser ? "text-white/70" : "text-slate-400")
                  }
                >
                  {isUser ? "Student" : "Assistant"}
                </div>
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (entry?.canOpenJournal) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Journal Lock is on for this student. Conversation stays locked by default — summary and risk details only.</span>
        </div>
      </div>
    );
  }

  if (entry?.conversationHidden) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Lock className="h-4 w-4" />
        This entry conversation is hidden because it was not safety-flagged.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
      {entry?.summary || entry?.adminFlagReason || "No journal text is available for this entry."}
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

function StudentSummaryFeedback({ entry, compact = false }) {
  const feedback = getStudentSummaryFeedback(entry);
  if (!feedback) {
    return (
      <div className={compact ? "mt-3 text-xs text-slate-400" : "rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"}>
        No student feedback
      </div>
    );
  }

  const tone = feedback.rating === "HELPFUL"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={"rounded-xl border px-4 py-3 " + tone}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">Student feedback</div>
      <div className="mt-1 text-sm font-bold">{feedback.label}</div>
      {feedback.reason ? <div className="mt-1 text-sm leading-6">{feedback.reason}</div> : null}
    </div>
  );
}

function SummaryNotes({ entry }) {
  const notes = Array.isArray(entry?.insights) ? entry.insights.filter(Boolean) : [];

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-800 mb-2.5">Summary Notes</h3>
      {notes.length ? (
        <ul className="space-y-2 text-sm leading-6 text-slate-700">
          {notes.map((note, index) => (
            <li key={entry.id + "-note-" + index} className="rounded-xl border border-slate-200 bg-white p-3">
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No summary notes recorded for this entry.
        </div>
      )}
    </div>
  );
}

function FlagHistory({ entry }) {
  const items = entry?.flagHistory || entry?.history || [];

  function formatRiskName(level) {
    const norm = normalizeRiskLevel(level);
    if (norm === "HIGH" || norm === "CRITICAL") return "Critical Case";
    if (norm === "LOW" || norm === "MEDIUM" || norm === "MODERATE" || norm === "DISTRESSED") return "Support Needed";
    if (norm === "NONE") return "None";
    return norm;
  }

  function humanizeAction(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Update";
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function buildDetail(item) {
    const note = String(item?.note || "").trim();
    if (note) return note;

    const parts = [];
    if (item?.fromRiskLevel || item?.toRiskLevel) {
      const fromLabel = formatRiskName(item?.fromRiskLevel);
      const toLabel = formatRiskName(item?.toRiskLevel);
      if (fromLabel !== toLabel) {
        parts.push(`Risk: ${fromLabel} -> ${toLabel}`);
      }
    }
    if (item?.fromStudentAction || item?.toStudentAction) {
      const fromAction = item?.fromStudentAction || "-";
      const toAction = item?.toStudentAction || "-";
      if (fromAction !== toAction) parts.push(`Student action: ${fromAction} -> ${toAction}`);
    }
    if (item?.fromCounselorResolved != null || item?.toCounselorResolved != null) {
      const fromResolved = item?.fromCounselorResolved ? "resolved" : "unresolved";
      const toResolved = item?.toCounselorResolved ? "resolved" : "unresolved";
      if (fromResolved !== toResolved) parts.push(`Counselor: ${fromResolved} -> ${toResolved}`);
    }
    return parts.join(" | ");
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Change History</h3>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const title = humanizeAction(item?.actionType || item?.action || item?.type || "Update");
            const when = item?.createdAtManila || formatDate(item?.createdAt, { withTime: true });
            const actor = item?.actorName || item?.actorEmail || "";
            const detail = buildDetail(item);
            const key = item?.id || `${entry?.id || "entry"}-history-${index}`;

            return (
              <li key={key} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">{title}</div>
                    {actor ? <div className="mt-0.5 text-xs font-medium text-emerald-700">{actor}</div> : null}
                    {detail ? <div className="mt-1 text-xs leading-5 text-slate-600">{detail}</div> : null}
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold text-slate-400">{when}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          No audit history for this entry yet.
        </div>
      )}
    </div>
  );
}


function FlagDetails({ entry, isEditing, editState, saving, onChange, onEdit, onCancel, onSave }) {
  const flag = getEntryFlag(entry);
  const actionLabel = getStudentActionLabel(entry);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Flag Details</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-[#229365]"
          aria-label="Edit flag details"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-500">
            Risk Flag
            <select
              value={editState.riskLevel}
              onChange={(event) => onChange("riskLevel", event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
            >
              {FLAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Primary Concern
            <select
              value={editState.primaryConcern}
              onChange={(event) => onChange("primaryConcern", event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
            >
              <option value="">Not set</option>
              {editState.primaryConcern && !PRIMARY_CONCERN_OPTIONS.includes(editState.primaryConcern) ? (
                <option value={editState.primaryConcern}>{editState.primaryConcern}</option>
              ) : null}
              {PRIMARY_CONCERN_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Reason
            <textarea
              value={editState.adminFlagReason}
              onChange={(event) => onChange("adminFlagReason", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
              placeholder="No reason recorded."
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-[#0e5a3a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b482e] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-slate-400">Risk Flag</div>
            <div className="mt-1 font-bold text-slate-800">{flag}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Well-being status</div>
            <div className="mt-1 font-bold text-slate-800">
              {getSafetyStatusDetailLabel(entry) || getSafetyStatusLabel(entry) || (isFinishedEntry(entry) ? "—" : "In progress")}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Primary Concern</div>
            <div className="mt-1 font-bold text-slate-800">{entry?.primaryConcern || "Not set"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Intervention Chosen</div>
            <div className="mt-1 font-bold text-slate-800">{actionLabel || "None"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Reason</div>
            <div className="mt-1 font-bold text-slate-800">{getFlagReason(entry)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewModal({
  student,
  entries,
  selectedEntry,
  loading,
  error,
  editState,
  isEditing,
  saving,
  onClose,
  activeFilter,
  counts,
  onSelectEntry,
  onFilterChange,
  onEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onMessage,
  onViewProfile,
  onMarkResolved,
  onRemoveFlag,
  maskStudentNumbers = false,
  followUpInfo = null,
}) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-5xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-wide uppercase">{student.fullName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-slate-500 font-medium">
                <span>{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</span>
                <span>•</span>
                <span className="uppercase">{student.program || "Unspecified"}</span>
                {followUpInfo?.lastFollowUpAt ? (
                  <>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800">
                      Follow-up sent {formatDate(followUpInfo.lastFollowUpAt, { withTime: true })} • {followUpInfo.lastFollowUpByName || "Counselor"}
                    </span>
                  </>
                ) : null}
                <span>•</span>
                <span className="font-black text-[#EF4444]">{entries.length} Flagged Entries</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5">
            <FilterTabs activeTab={activeFilter} counts={counts} onChange={onFilterChange} />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid gap-6 px-7 py-6 lg:grid-cols-[0.95fr,1.1fr] overflow-hidden">
          <div className="h-full overflow-y-auto pr-2 space-y-4">
            {loading ? <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Loading flagged entries...</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isSelected={selectedEntry?.id === entry.id}
                onSelect={onSelectEntry}
              />
            ))}
          </div>

          <div className="h-full overflow-y-auto pr-2 space-y-6">
            {selectedEntry ? (
              <>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2.5">Flagged Journal Entry</h3>
                  <JournalEntryViewer entry={selectedEntry} />
                </div>

                <SummaryNotes entry={selectedEntry} />

                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2.5">Student Feedback</h3>
                  <StudentSummaryFeedback entry={selectedEntry} />
                </div>

                <FlagDetails
                  entry={selectedEntry}
                  isEditing={isEditing}
                  editState={editState}
                  saving={saving}
                  onChange={onEditChange}
                  onEdit={onEdit}
                  onCancel={onCancelEdit}
                  onSave={onSaveEdit}
                />

                <FlagHistory entry={selectedEntry} />
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Select an entry to review.</div>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-7 py-4 shadow-lg">
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            Message Student
          </button>
          <button
            type="button"
            onClick={() => onViewProfile(student.studentNumber)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Student Profile
          </button>
          <button
            type="button"
            onClick={onRemoveFlag}
            disabled={!selectedEntry || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Remove Flag
          </button>
          <button
            type="button"
            onClick={onMarkResolved}
            disabled={!selectedEntry || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0e5a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b482e] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isResolved(selectedEntry) ? "Undo Resolved" : "Mark Resolved"}
          </button>
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
                  <span>{formatDate(msg.createdAt, { withTime: true })}</span>
                  <span>•</span>
                  {msg.isRead ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700" title={msg.readAt ? `Seen ${formatDate(msg.readAt, { withTime: true })}` : "Seen"}>
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

export default function FlaggedEntries({ onLogout, session }) {
  const { preferences } = useAdminPreferences();
  const navigate = useNavigate();
  const shouldMaskStudentNumbers = Boolean(preferences.privacy.maskStudentNumbers);
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [concernFilter, setConcernFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [followUpsByStudent, setFollowUpsByStudent] = useState({});

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reviewEntries, setReviewEntries] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("All");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [editingFlag, setEditingFlag] = useState(false);
  const [editState, setEditState] = useState({
    riskLevel: "LOW",
    primaryConcern: "",
    supportResponse: "",
    adminFlagReason: "",
  });
  const [messageTarget, setMessageTarget] = useState(null);
  const [savingFlag, setSavingFlag] = useState(false);
  const [resolveCandidate, setResolveCandidate] = useState(null);
  const [resolveAction, setResolveAction] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadEntries() {
    try {
      setLoading(true);
      const data = await fetchAdminRiskFlags();
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load flagged entries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  const groupedStudents = useMemo(() => groupEntriesByStudent(entries), [entries]);

  const concernOptions = useMemo(() => {
    const options = new Set();
    entries.forEach((entry) => getConcernTags(entry).forEach((tag) => options.add(tag)));
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const counts = useMemo(() => {
    const base = { All: groupedStudents.length, "Critical Case": 0, "Support Needed": 0, Resolved: 0 };
    groupedStudents.forEach((student) => {
      TABS.filter((tab) => tab !== "All").forEach((tab) => {
        if (studentMatchesFlag(student, tab)) {
          base[tab] += 1;
        }
      });
    });
    return base;
  }, [groupedStudents]);

  const reviewCounts = useMemo(() => {
    const base = { All: reviewEntries.length, "Critical Case": 0, "Support Needed": 0, Resolved: 0 };
    reviewEntries.forEach((entry) => {
      TABS.filter((tab) => tab !== "All").forEach((tab) => {
        if (entryMatchesFlag(entry, tab)) {
          base[tab] += 1;
        }
      });
    });
    return base;
  }, [reviewEntries]);

  const filteredReviewEntries = useMemo(
    () => reviewEntries.filter((entry) => entryMatchesFlag(entry, reviewFilter)),
    [reviewEntries, reviewFilter],
  );

  const filteredStudents = useMemo(() => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();

    return groupedStudents.filter((student) => {
      // Tab filter
      const matchesTab = studentMatchesFlag(student, activeTab);
      if (!matchesTab) return false;

      // Search Query filter
      if (query) {
        const matchesName = student.fullName.toLowerCase().includes(query);
        const matchesNum = student.studentNumber.toLowerCase().includes(query);
        if (!matchesName && !matchesNum) return false;
      }

      // Program filter
      if (programFilter !== "all") {
        if (String(student.program || "").toLowerCase() !== programFilter.toLowerCase()) return false;
      }

      // Concern filter & Date filter on student entries
      const hasMatchingEntry = student.entries.some((entry) => {
        const matchesConcern = concernFilter === "all" || getConcernTags(entry).includes(concernFilter);
        const entryDate = new Date(entry.createdAt || entry.entryDate).getTime();
        const matchesDate =
          dateFilter === "all" ||
          (!Number.isNaN(entryDate) && now - entryDate <= Number(dateFilter) * 24 * 60 * 60 * 1000);
        return matchesConcern && matchesDate;
      });

      return hasMatchingEntry;
    });
  }, [groupedStudents, activeTab, searchQuery, programFilter, concernFilter, dateFilter]);

  const totalFilteredEntries = useMemo(() => {
    return filteredStudents.reduce((acc, s) => acc + s.entries.length, 0);
  }, [filteredStudents]);

  function resetEditState(entry) {
    setEditState({
      riskLevel: isCritical(entry) ? "HIGH" : isSupportNeeded(entry) ? "LOW" : "NONE",
      primaryConcern: entry?.primaryConcern || "",
      supportResponse: ["HIGH", "CRITICAL"].includes(normalizeRiskLevel(entry?.riskLevel)) ? entry?.supportResponse || "" : "",
      adminFlagReason: entry?.adminFlagReason || "",
    });
  }

  async function handleReviewStudent(student) {
    setSelectedStudent(student);
    setReviewEntries(student.entries);
    setReviewFilter("All");
    const initialEntry = pickMostSevereUnresolvedEntry(student.entries) || student.entries[0] || null;
    setSelectedEntry(initialEntry);
    resetEditState(initialEntry);
    setReviewError("");
    setReviewLoading(true);

    try {
      const [profileData, followUpData] = await Promise.all([
        fetchAdminStudentProfile(student.studentNumber).catch(() => null),
        fetchAdminStudentFollowUps(student.studentNumber).catch(() => null),
      ]);

      if (profileData?.entries) {
        const flaggedEntries = profileData.entries.filter(isFlaggedEntry);
        const historyMap = new Map((student.entries || []).map((e) => [e.id, e.flagHistory || e.history || []]));
        const enriched = (flaggedEntries.length ? flaggedEntries : student.entries).map((entry) => ({
          ...entry,
          flagHistory: (Array.isArray(entry.flagHistory) && entry.flagHistory.length) ? entry.flagHistory : (historyMap.get(entry.id) || []),
        }));
        enriched.sort((a, b) => {
          const finishedDiff = Number(isFinishedEntry(b)) - Number(isFinishedEntry(a));
          if (finishedDiff) return finishedDiff;
          return new Date(getEntryDateValue(b)) - new Date(getEntryDateValue(a));
        });
        const nextEntry = pickMostSevereUnresolvedEntry(enriched) || enriched.find(isFinishedEntry) || enriched[0] || null;
        setReviewEntries(enriched);
        setSelectedEntry(nextEntry);
        resetEditState(nextEntry);
      }

      if (followUpData?.threads) {
        const allMsgs = (followUpData.threads || []).flatMap((t) => t.messages || []);
        allMsgs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const latest = allMsgs[0];
        if (latest) {
          setFollowUpsByStudent((prev) => ({
            ...prev,
            [student.studentNumber]: {
              lastFollowUpAt: latest.createdAt,
              lastFollowUpByName: latest.from?.name || "Counselor",
            },
          }));
        }
      }
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to load full flagged entry history.");
    } finally {
      setReviewLoading(false);
    }
  }

  function handleSelectEntry(entry) {
    setSelectedEntry(entry);
    resetEditState(entry);
    setEditingFlag(false);
  }

  function handleReviewFilterChange(nextFilter) {
    setReviewFilter(nextFilter);
    const nextEntries = reviewEntries.filter((entry) => entryMatchesFlag(entry, nextFilter));
    const selectedStillVisible = nextEntries.some((entry) => entry.id === selectedEntry?.id);
    if (!selectedStillVisible) {
      const nextEntry = nextEntries[0] || null;
      setSelectedEntry(nextEntry);
      resetEditState(nextEntry);
      setEditingFlag(false);
    }
  }

  function reconcileUpdatedEntry(updatedEntry) {
    if (!isFlaggedEntry(updatedEntry)) {
      setEntries((current) => current.filter((entry) => entry.id !== updatedEntry.id));
      setReviewEntries((current) => {
        const nextEntries = current.filter((entry) => entry.id !== updatedEntry.id);
        setSelectedEntry((currentEntry) => {
          if (currentEntry?.id !== updatedEntry.id) return currentEntry;
          const nextEntry = nextEntries.find((entry) => entryMatchesFlag(entry, reviewFilter)) || nextEntries[0] || null;
          resetEditState(nextEntry);
          return nextEntry;
        });
        return nextEntries;
      });
      return;
    }

    setEntries((current) => current.map((entry) => {
      if (entry.id !== updatedEntry.id) return entry;
      const merged = { ...entry, ...updatedEntry };
      if (!Array.isArray(updatedEntry?.flagHistory) && Array.isArray(entry?.flagHistory)) {
        merged.flagHistory = entry.flagHistory;
      }
      if (!Array.isArray(updatedEntry?.history) && Array.isArray(entry?.history)) {
        merged.history = entry.history;
      }
      return merged;
    }));
    setReviewEntries((current) => {
      const nextEntries = current.map((entry) => {
        if (entry.id !== updatedEntry.id) return entry;
        const merged = { ...entry, ...updatedEntry };
        if (!Array.isArray(updatedEntry?.flagHistory) && Array.isArray(entry?.flagHistory)) {
          merged.flagHistory = entry.flagHistory;
        }
        if (!Array.isArray(updatedEntry?.history) && Array.isArray(entry?.history)) {
          merged.history = entry.history;
        }
        return merged;
      });
      setSelectedEntry((currentEntry) => {
        if (currentEntry?.id !== updatedEntry.id) return currentEntry;
        if (entryMatchesFlag(updatedEntry, reviewFilter)) {
          const merged = { ...currentEntry, ...updatedEntry };
          if (!Array.isArray(updatedEntry?.flagHistory) && Array.isArray(currentEntry?.flagHistory)) {
            merged.flagHistory = currentEntry.flagHistory;
          }
          if (!Array.isArray(updatedEntry?.history) && Array.isArray(currentEntry?.history)) {
            merged.history = currentEntry.history;
          }
          return merged;
        }
        const nextEntry = nextEntries.find((entry) => entryMatchesFlag(entry, reviewFilter)) || nextEntries[0] || null;
        resetEditState(nextEntry);
        return nextEntry;
      });
      return nextEntries;
    });
  }

  async function handleSaveFlag() {
    if (!selectedEntry?.id) return;
    const currentLevel = normalizeRiskLevel(selectedEntry?.riskLevel);
    const nextLevel = normalizeRiskLevel(editState.riskLevel);
    if (["HIGH", "CRITICAL"].includes(currentLevel) && nextLevel === "LOW") {
      setReviewError("Support Needed cannot overwrite an existing elevated well-being risk flag.");
      return;
    }
    try {
      setSavingFlag(true);
      const nextSupportResponse = ["HIGH", "CRITICAL"].includes(editState.riskLevel) ? editState.supportResponse || null : null;
      const data = await updateAdminJournalFlag(selectedEntry.id, {
        riskLevel: editState.riskLevel,
        primaryConcern: editState.primaryConcern,
        supportResponse: nextSupportResponse,
        adminFlagReason: editState.adminFlagReason,
      });
      if (data?.entry) {
        reconcileUpdatedEntry(data.entry);
      }
      setEditingFlag(false);
      setSuccessMessage(editState.riskLevel === "NONE" ? "Flag removed from entry." : "Flag details updated.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Failed to update flag details.");
    } finally {
      setSavingFlag(false);
    }
  }

  async function handleMarkResolved() {
    const targetEntry = resolveCandidate || selectedEntry;
    if (!targetEntry?.id) return;
    const undoResolved = isResolved(targetEntry);
    const resolutionAction = String(resolveAction || "").trim();
    const note = String(resolveNote || "").trim();
    if (!undoResolved && (!resolutionAction || !note)) {
      setReviewError("Choose an intervention action and add counselor notes to mark resolved.");
      return;
    }
    try {
      setSavingFlag(true);
      const payload = {
        riskLevel: isCritical(targetEntry) ? "HIGH" : isSupportNeeded(targetEntry) ? "LOW" : "NONE",
        primaryConcern: targetEntry.primaryConcern || "",
        adminFlagReason: targetEntry.adminFlagReason || "",
        markResolved: !undoResolved,
      };
      if (!undoResolved) {
        payload.note = note;
        payload.resolutionAction = resolutionAction;
      }
      const data = await updateAdminJournalFlag(targetEntry.id, payload);
      if (data?.entry) {
        reconcileUpdatedEntry(data.entry);
      }
      setSuccessMessage(undoResolved ? "Resolved status undone." : "Entry marked resolved.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Failed to mark entry resolved.");
    } finally {
      setSavingFlag(false);
      setResolveCandidate(null);
      setResolveAction("");
      setResolveNote("");
    }
  }

  async function handleRemoveFlag() {
    const targetEntry = removeCandidate || selectedEntry;
    if (!targetEntry?.id) return;
    try {
      setSavingFlag(true);
      const data = await updateAdminJournalFlag(targetEntry.id, {
        riskLevel: "NONE",
        primaryConcern: targetEntry.primaryConcern || "",
        supportResponse: null,
        adminFlagReason: "",
      });
      if (data?.entry) {
        reconcileUpdatedEntry(data.entry);
      }
      setEditingFlag(false);
      setSuccessMessage("Flag removed from entry.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Failed to remove flag.");
    } finally {
      setSavingFlag(false);
      setRemoveCandidate(null);
    }
  }

  function handleViewProfile(studentNum) {
    if (!studentNum) return;
    navigate(`/users?student=${encodeURIComponent(studentNum)}`);
  }

  return (
    <Layout
      title="Flagged Entries"
      subtitle="Review journal entries that need counselor attention and follow-up."
      onLogout={onLogout}
      session={session}
      mainClassName="bg-[rgba(14,90,58,0.1)]"
    >
      <div className="mx-auto max-w-[1180px] space-y-6 pb-12">
        {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{errorMessage}</div> : null}
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        {/* Top Controls Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          {/* Search Bar */}
          <div className="relative w-full lg:flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or student number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#229365] focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter */}
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-11 appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-[#229365] focus:bg-white focus:ring-1 focus:ring-emerald-100"
              >
                {DATE_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Concern Filter */}
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={concernFilter}
                onChange={(e) => setConcernFilter(e.target.value)}
                className="h-11 min-w-[11rem] appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-[#229365] focus:bg-white focus:ring-1 focus:ring-emerald-100"
              >
                <option value="all">All Concern Types</option>
                {concernOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Program Filter */}
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="h-11 min-w-[10rem] appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-[#229365] focus:bg-white focus:ring-1 focus:ring-emerald-100"
              >
                <option value="all">All Programs</option>
                {PROGRAM_OPTIONS.map((prog) => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Count Bar & Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <div className="text-sm font-extrabold text-slate-800">
            Showing <span className="text-[#0e5a3a]">{filteredStudents.length}</span> students{" "}
            <span className="font-semibold text-slate-500">({totalFilteredEntries} flagged entries)</span>
          </div>
          <FilterTabs activeTab={activeTab} counts={counts} onChange={setActiveTab} />
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-3.5 text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                <th className="px-5 py-2">Student Name</th>
                <th className="px-5 py-2">Concern Type</th>
                <th className="px-5 py-2">Risk Flag</th>
                <th className="px-5 py-2 text-center">Total Flagged Entries</th>
                <th className="px-5 py-2">Flagged On</th>
                <th className="px-5 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="rounded-2xl bg-white px-5 py-8 text-sm text-slate-500 font-medium">Loading flagged students...</td>
                </tr>
              ) : filteredStudents.length ? (
                filteredStudents.map((student) => (
                  <FlaggedStudentRow
                    key={student.studentNumber || student.fullName}
                    student={student}
                    maskStudentNumbers={shouldMaskStudentNumbers}
                    onReview={handleReviewStudent}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-slate-500 font-medium">
                    No flagged students matched the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReviewModal
        student={selectedStudent}
        entries={filteredReviewEntries}
        selectedEntry={selectedEntry}
        loading={reviewLoading}
        error={reviewError}
        editState={editState}
        isEditing={editingFlag}
        saving={savingFlag}
        activeFilter={reviewFilter}
        counts={reviewCounts}
        onClose={() => {
          setSelectedStudent(null);
          setSelectedEntry(null);
          setReviewEntries([]);
          setReviewFilter("All");
          setEditingFlag(false);
        }}
        onSelectEntry={handleSelectEntry}
        onFilterChange={handleReviewFilterChange}
        onEdit={() => setEditingFlag(true)}
        onCancelEdit={() => {
          resetEditState(selectedEntry);
          setEditingFlag(false);
        }}
        onEditChange={(key, value) => setEditState((current) => ({ ...current, [key]: value }))}
        onSaveEdit={handleSaveFlag}
        onMessage={() => {
          setMessageTarget(selectedStudent);
        }}
        onViewProfile={handleViewProfile}
        onMarkResolved={() => {
          setResolveAction("");
          setResolveNote("");
          setResolveCandidate(selectedEntry);
        }}
        onRemoveFlag={() => setRemoveCandidate(selectedEntry)}
        maskStudentNumbers={shouldMaskStudentNumbers}
        followUpInfo={selectedStudent ? followUpsByStudent[selectedStudent.studentNumber] : null}
      />


      <MessageModal
        student={messageTarget}
        maskStudentNumbers={shouldMaskStudentNumbers}
        onClose={() => setMessageTarget(null)}
        onSuccess={(msg) => {
          const studentNumber = messageTarget?.studentNumber;
          setSuccessMessage(msg || "Message sent.");
          if (studentNumber) {
            setFollowUpsByStudent((prev) => ({
              ...prev,
              [studentNumber]: {
                lastFollowUpAt: new Date().toISOString(),
                lastFollowUpByName: session?.fullName || "Counselor",
              },
            }));
          }
          setMessageTarget(null);
        }}
      />

      {resolveCandidate && !isResolved(resolveCandidate) ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="font-black text-slate-900 text-base">Mark Entry Resolved</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Record the intervention action and counselor notes. Both are required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResolveCandidate(null);
                  setResolveAction("");
                  setResolveNote("");
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Intervention action
                <select
                  value={resolveAction}
                  onChange={(event) => setResolveAction(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-800 focus:border-[#229365] focus:outline-none"
                >
                  <option value="">Select action</option>
                  {RESOLUTION_ACTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Counselor notes
                <textarea
                  value={resolveNote}
                  onChange={(event) => setResolveNote(event.target.value)}
                  rows={5}
                  placeholder="Describe the follow-up, outcome, or next step..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3.5 text-sm font-medium text-slate-800 focus:border-[#229365] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setResolveCandidate(null);
                  setResolveAction("");
                  setResolveNote("");
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMarkResolved()}
                disabled={savingFlag || !String(resolveAction || "").trim() || !String(resolveNote || "").trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e5a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b482e] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {savingFlag ? "Saving..." : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        isOpen={Boolean(resolveCandidate) && isResolved(resolveCandidate)}
        onClose={() => setResolveCandidate(null)}
        onConfirm={() => void handleMarkResolved()}
        title="Undo Resolved"
        description="Undo resolved for this entry? It will return to the appropriate unresolved flag tab."
        cancelLabel="Cancel"
        confirmLabel="Undo Resolved"
      />

      <ConfirmActionModal
        isOpen={Boolean(removeCandidate)}
        onClose={() => setRemoveCandidate(null)}
        onConfirm={() => void handleRemoveFlag()}
        title="Remove Flag"
        description="Remove this entry from Flagged Entries? This clears the risk flag and resolved status for this entry."
        cancelLabel="Cancel"
        confirmLabel="Remove Flag"
        confirmTone="rose"
      />
    </Layout>
  );
}

import Toast from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Lock,
  MessageSquare,
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
  openAdminStudentJournalEntry,
  sendAdminStudentNotification,
  updateAdminJournalFlag,
} from "../lib/admin-api";
import { maskStudentNumber, useAdminPreferences } from "../lib/admin-preferences";

const CRITICAL = "#EF4444";
const SUPPORT = "#FBBF24";
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
  return String(entry?.supportResponse || "").toUpperCase() === "CONTACTED";
}

function getEntryFlag(entry) {
  if (isResolved(entry)) return "Resolved";
  if (isCritical(entry)) return "Critical Case";
  if (isSupportNeeded(entry) || String(entry?.supportResponse || "").toUpperCase() === "DECLINED") {
    return "Support Needed";
  }
  return "Balanced";
}

function entryMatchesFlag(entry, flag) {
  if (flag === "All") return true;
  if (flag === "Resolved") return isResolved(entry);
  if (flag === "Critical Case") return !isResolved(entry) && isCritical(entry);
  if (flag === "Support Needed") {
    return !isResolved(entry) && (isSupportNeeded(entry) || String(entry?.supportResponse || "").toUpperCase() === "DECLINED");
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(options.withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function getConcernTags(entry) {
  return [entry?.primaryConcern, ...(Array.isArray(entry?.concernTags) ? entry.concernTags : [])]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function isFlaggedEntry(entry) {
  const riskLevel = normalizeRiskLevel(entry?.riskLevel);
  const supportResponse = String(entry?.supportResponse || "").toUpperCase();
  return ["LOW", "MEDIUM", "MODERATE", "HIGH", "CRITICAL"].includes(riskLevel) ||
    supportResponse === "DECLINED";
}

function getGroupFlag(entries) {
  if (entries.some((entry) => !isResolved(entry) && isCritical(entry))) return "Critical Case";
  if (entries.some((entry) => !isResolved(entry) && (isSupportNeeded(entry) || String(entry.supportResponse || "").toUpperCase() === "DECLINED"))) {
    return "Support Needed";
  }
  if (entries.some(isResolved)) return "Resolved";
  return "Balanced";
}

function getFlagReason(entry) {
  return entry?.adminFlagReason || "No reason recorded";
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
      const sortedEntries = [...group.entries].sort((a, b) => new Date(b.createdAt || b.entryDate) - new Date(a.createdAt || a.entryDate));
      const latestEntry = sortedEntries[0] || {};
      return {
        ...group,
        entries: sortedEntries,
        latestEntry,
        flag: getGroupFlag(sortedEntries),
        concernTags: [...new Set(sortedEntries.flatMap(getConcernTags))],
      };
    })
    .sort((a, b) => new Date(b.latestEntry.createdAt || b.latestEntry.entryDate) - new Date(a.latestEntry.createdAt || a.latestEntry.entryDate));
}

function FlagBadge({ flag }) {
  const color = flagColor(flag);
  const Icon = flag === "Resolved" ? CheckCircle2 : flag === "Critical Case" ? AlertTriangle : ShieldAlert;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
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
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${className}`}>
      <Icon className="h-4 w-4" />
      {flag}
    </span>
  );
}

function CountBadge({ children }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      {children}
    </span>
  );
}

function FilterTabs({ activeTab, counts, onChange }) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const Icon = TAB_META[tab]?.icon;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
              isActive ? "bg-[#e7f1ed] text-[#134611]" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {Icon ? <Icon className="h-4 w-4" style={{ color: isActive ? TAB_META[tab].color : undefined }} /> : null}
            {tab}
            <CountBadge>{counts[tab] || 0}</CountBadge>
          </button>
        );
      })}
    </div>
  );
}

function FlaggedStudentRow({ student, onReview, maskStudentNumbers = false }) {
  return (
    <tr className="border-b border-emerald-100 bg-white text-sm shadow-sm last:border-b-0">
      <td className="rounded-l-xl px-4 py-4">
        <div className="flex items-center gap-3">
          <StudentAvatar
            className="h-10 w-10 rounded-full text-sm"
            fullName={student.fullName}
            profilePictureUrl={student.profilePictureUrl}
          />
          <div>
            <div className="font-bold text-slate-900">{student.fullName}</div>
            <div className="text-xs text-slate-500">{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex max-w-sm flex-wrap gap-2">
          {student.concernTags.slice(0, 3).map((tag) => (
            <span key={`${student.studentNumber}-${tag}`} className="rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-4">
        <FlagBadge flag={student.flag} />
      </td>
      <td className="px-4 py-4 text-center text-slate-700">{student.entries.length}</td>
      <td className="px-4 py-4 text-slate-500">{formatDate(student.latestEntry.createdAt || student.latestEntry.entryDate, { withTime: true })}</td>
      <td className="rounded-r-xl px-4 py-4 text-right">
        <button
          type="button"
          onClick={() => onReview(student)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#229365] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1b7b54]"
        >
          <Eye className="h-4 w-4" />
          Review
          <ChevronRight className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function EntryCard({ entry, index, isSelected, onSelect }) {
  const flag = getEntryFlag(entry);
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={`w-full rounded-lg border bg-white p-4 text-left transition ${
        isSelected ? "border-[#229365] shadow-sm" : "border-slate-200 hover:border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">{entry.title || `Entry # ${index + 1}`}</div>
          <div className="mt-1 text-xs text-slate-500">{formatDate(entry.entryDate || entry.createdAt, { withTime: true })}</div>
        </div>
        <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
          {isResolved(entry) ? "Reviewed" : "Pending"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {getConcernTags(entry).slice(0, 3).map((tag) => (
          <span key={`${entry.id}-${tag}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <FlagPill flag={flag} />
      </div>
    </button>
  );
}

function JournalEntryViewer({ entry, onOpenJournal }) {
  const visibleMessages = Array.isArray(entry?.messages) ? entry.messages.filter((message) => message.text) : [];

  if (visibleMessages.length) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {visibleMessages.map((message) => {
          const role = String(message.role || "").toLowerCase();
          const isUser = role === "user" || role === "student";
          return (
            <div
              key={message.id || `${entry.id}-${message.createdAt}`}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  isUser
                    ? "rounded-br-md bg-[#229365] text-white"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${isUser ? "text-white/70" : "text-slate-400"}`}>
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Journal Lock is on for this student. Only the summary is available until the student's Journal Lock PIN is entered.</span>
        </div>
        <button
          type="button"
          onClick={() => onOpenJournal?.(entry)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54]"
        >
          <Lock className="h-4 w-4" />
          Open Journal
        </button>
      </div>
    );
  }

  if (entry?.conversationHidden) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Lock className="h-4 w-4" />
        This entry conversation is hidden because it was not safety-flagged.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
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
      <div className={compact ? "mt-3 text-xs text-slate-400" : "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"}>
        No student feedback
      </div>
    );
  }

  const tone = feedback.rating === "HELPFUL"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
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
      <h3 className="text-sm font-bold text-slate-800">Summary Notes</h3>
      {notes.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          {notes.map((note, index) => (
            <li key={`${entry.id}-note-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No summary notes recorded for this entry.
        </div>
      )}
    </div>
  );
}

function FlagDetails({ entry, isEditing, editState, saving, onChange, onEdit, onCancel, onSave }) {
  const flag = getEntryFlag(entry);
  const highRisk = isCritical(entry);
  const intervention = highRisk && String(entry?.supportResponse || "").toUpperCase() === "CONTACTED" ? "Contacted support" : "None";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Flag Details</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-[#229365]"
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
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
            >
              {FLAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Primary Concern
            <input
              value={editState.primaryConcern}
              onChange={(event) => onChange("primaryConcern", event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
              placeholder="Not set"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Intervention Chosen
            <select
              value={["HIGH", "CRITICAL"].includes(editState.riskLevel) ? editState.supportResponse : ""}
              onChange={(event) => onChange("supportResponse", event.target.value)}
              disabled={!["HIGH", "CRITICAL"].includes(editState.riskLevel)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#229365] focus:outline-none"
            >
              <option value="">None</option>
              <option value="CONTACTED">Contacted support</option>
              <option value="DECLINED">None selected by student</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Reason
            <textarea
              value={editState.adminFlagReason}
              onChange={(event) => onChange("adminFlagReason", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#229365] focus:outline-none"
              placeholder="No reason recorded."
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54] disabled:opacity-60"
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
            <div className="text-xs font-semibold text-slate-400">Primary Concern</div>
            <div className="mt-1 font-bold text-slate-800">{entry?.primaryConcern || "Not set"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Intervention Chosen</div>
            <div className="mt-1 font-bold text-slate-800">{intervention}</div>
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
  onMarkResolved,
  onOpenJournal,
  onRemoveFlag,
  maskStudentNumbers = false,
}) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
      <div className="h-full w-full max-w-5xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{student.fullName}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                <span>{maskStudentNumber(student.studentNumber, maskStudentNumbers)}</span>
                <span>-</span>
                <span>{student.program || "Unspecified"}</span>
                <span>-</span>
                <span className="font-semibold text-[#EF4444]">{entries.length} Flagged Entries</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4">
            <FilterTabs activeTab={activeFilter} counts={counts} onChange={onFilterChange} />
          </div>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[0.95fr,1.1fr]">
          <div className="space-y-4">
            {loading ? <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">Loading flagged entries...</div> : null}
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {entries.map((entry, index) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                index={entries.length - index}
                isSelected={selectedEntry?.id === entry.id}
                onSelect={onSelectEntry}
              />
            ))}
          </div>

          <div className="space-y-5">
            {selectedEntry ? (
              <>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Flagged Journal Entry</h3>
                  <div className="mt-3">
                    <JournalEntryViewer entry={selectedEntry} onOpenJournal={onOpenJournal} />
                  </div>
                </div>

                <SummaryNotes entry={selectedEntry} />

                <div>
                  <h3 className="text-sm font-bold text-slate-800">Student Feedback</h3>
                  <div className="mt-3">
                    <StudentSummaryFeedback entry={selectedEntry} />
                  </div>
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
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">Select an entry to review.</div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            Message Student
          </button>
          <button
            type="button"
            onClick={onRemoveFlag}
            disabled={!selectedEntry || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Remove Flag
          </button>
          <button
            type="button"
            onClick={onMarkResolved}
            disabled={!selectedEntry || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isResolved(selectedEntry) ? "Undo Resolved" : "Mark Resolved"}
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
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
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

export default function FlaggedEntries({ onLogout, session }) {
  const { preferences } = useAdminPreferences();
  const shouldMaskStudentNumbers = Boolean(preferences.privacy.maskStudentNumbers);
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [concernFilter, setConcernFilter] = useState("all");
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
  const [messageTitle, setMessageTitle] = useState("Counselor Follow-up");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [resolveCandidate, setResolveCandidate] = useState(null);
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [journalUnlockTarget, setJournalUnlockTarget] = useState(null);
  const [journalUnlockPin, setJournalUnlockPin] = useState("");
  const [journalUnlockError, setJournalUnlockError] = useState("");
  const [journalUnlockSaving, setJournalUnlockSaving] = useState(false);
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
    const filteredEntries = entries.filter((entry) => {
      const matchesTab = entryMatchesFlag(entry, activeTab);
      const matchesConcern = concernFilter === "all" || getConcernTags(entry).includes(concernFilter);
      const entryDate = new Date(entry.createdAt || entry.entryDate).getTime();
      const matchesDate =
        dateFilter === "all" ||
        (!Number.isNaN(entryDate) && now - entryDate <= Number(dateFilter) * 24 * 60 * 60 * 1000);
      return matchesTab && matchesConcern && matchesDate;
    });
    return groupEntriesByStudent(filteredEntries);
  }, [activeTab, concernFilter, dateFilter, entries]);

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
    setSelectedEntry(student.entries[0] || null);
    resetEditState(student.entries[0] || null);
    setReviewError("");
    setReviewLoading(true);

    try {
      const data = await fetchAdminStudentProfile(student.studentNumber);
      const flaggedEntries = (Array.isArray(data?.entries) ? data.entries : []).filter(isFlaggedEntry);
      const enriched = flaggedEntries.length ? flaggedEntries : student.entries;
      setReviewEntries(enriched);
      setSelectedEntry(enriched[0] || null);
      resetEditState(enriched[0] || null);
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

    setEntries((current) => current.map((entry) => (entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry)));
    setReviewEntries((current) => {
      const nextEntries = current.map((entry) => (entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry));
      setSelectedEntry((currentEntry) => {
        if (currentEntry?.id !== updatedEntry.id) return currentEntry;
        if (entryMatchesFlag(updatedEntry, reviewFilter)) return { ...currentEntry, ...updatedEntry };
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
      setReviewError("Support Needed cannot overwrite an existing HIGH crisis flag.");
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
    setEditState((current) => ({ ...current, supportResponse: undoResolved ? "" : "CONTACTED" }));
    try {
      setSavingFlag(true);
      const data = await updateAdminJournalFlag(targetEntry.id, {
        riskLevel: isCritical(targetEntry) ? "HIGH" : isSupportNeeded(targetEntry) ? "LOW" : "NONE",
        primaryConcern: targetEntry.primaryConcern || "",
        supportResponse: undoResolved ? null : "CONTACTED",
        adminFlagReason: targetEntry.adminFlagReason || "",
      });
      if (data?.entry) {
        reconcileUpdatedEntry(data.entry);
      }
      setSuccessMessage(undoResolved ? "Resolved status undone." : "Entry marked resolved.");
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Failed to mark entry resolved.");
    } finally {
      setSavingFlag(false);
      setResolveCandidate(null);
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

  function mergeUnlockedEntry(unlockedEntry) {
    if (!unlockedEntry?.id) return;
    setEntries((current) => current.map((entry) => (entry.id === unlockedEntry.id ? { ...entry, ...unlockedEntry } : entry)));
    setReviewEntries((current) => current.map((entry) => (entry.id === unlockedEntry.id ? { ...entry, ...unlockedEntry } : entry)));
    setSelectedEntry((current) => (current?.id === unlockedEntry.id ? { ...current, ...unlockedEntry } : current));
  }

  async function handleOpenJournal() {
    const studentNumber = selectedStudent?.studentNumber || journalUnlockTarget?.studentNumber;
    if (!studentNumber || !journalUnlockTarget?.id) return;
    if (String(journalUnlockPin || "").length < 4) {
      setJournalUnlockError("Enter the 4-digit Journal Lock PIN.");
      return;
    }

    try {
      setJournalUnlockSaving(true);
      const data = await openAdminStudentJournalEntry(studentNumber, journalUnlockTarget.id, journalUnlockPin);
      if (data?.entry) {
        mergeUnlockedEntry(data.entry);
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

  return (
    <Layout
      title="Flagged Entries"
      subtitle="Review journal entries that need counselor attention and follow-up."
      onLogout={onLogout}
      session={session}
      mainClassName="bg-[rgba(14,90,58,0.1)]"
    >
      <div className="mx-auto max-w-[1180px] space-y-5 pb-12">
        {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <FilterTabs activeTab={activeTab} counts={counts} onChange={setActiveTab} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block">
              <span className="sr-only">Date range</span>
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-semibold text-slate-600 shadow-sm focus:border-[#229365] focus:outline-none"
              >
                {DATE_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>

            <label className="relative block">
              <span className="sr-only">Concern type</span>
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={concernFilter}
                onChange={(event) => setConcernFilter(event.target.value)}
                className="h-10 min-w-[11rem] appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-semibold text-slate-600 shadow-sm focus:border-[#229365] focus:outline-none"
              >
                <option value="all">Concern Type</option>
                {concernOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-3 text-left">
            <thead>
              <tr className="text-xs font-bold text-slate-400">
                <th className="px-4 py-2">Student Name</th>
                <th className="px-4 py-2">Concern Type</th>
                <th className="px-4 py-2">Risk Flag</th>
                <th className="px-4 py-2 text-center">Total Flagged Entries</th>
                <th className="px-4 py-2">Flagged On</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="rounded-xl bg-white px-4 py-8 text-sm text-slate-500">Loading flagged students...</td>
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
                  <td colSpan={6} className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500">
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
          setJournalUnlockTarget(null);
          setJournalUnlockError("");
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
          setMessageTitle("Counselor Follow-up");
          setMessageBody("");
        }}
        onMarkResolved={() => setResolveCandidate(selectedEntry)}
        onOpenJournal={(entry) => {
          setJournalUnlockTarget(entry);
          setJournalUnlockError("");
        }}
        onRemoveFlag={() => setRemoveCandidate(selectedEntry)}
        maskStudentNumbers={shouldMaskStudentNumbers}
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

      <ConfirmActionModal
        isOpen={Boolean(resolveCandidate)}
        onClose={() => setResolveCandidate(null)}
        onConfirm={() => void handleMarkResolved()}
        title={isResolved(resolveCandidate) ? "Undo Resolved" : "Mark Entry Resolved"}
        description={
          isResolved(resolveCandidate)
            ? "Undo resolved for this entry? It will return to the appropriate unresolved flag tab."
            : "Mark this flagged entry as resolved? The student can still remain in other tabs if they have other unresolved critical or support-needed entries."
        }
        cancelLabel="Cancel"
        confirmLabel={isResolved(resolveCandidate) ? "Undo Resolved" : "Mark Resolved"}
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

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Eye, Flag, MessageCircle, Search } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { fetchAdminRiskFlags, sendAdminStudentNotification } from "../lib/admin-api";

const TABS = ["All", "Urgent", "High", "Reviewed"];

function urgencyFromEntry(entry) {
  const riskLevel = String(entry?.riskLevel || "").toUpperCase();
  if (riskLevel === "CRITICAL") return "Urgent";
  if (riskLevel === "HIGH") return "High";
  return "High";
}

function statusFromEntry(entry) {
  const response = String(entry?.supportResponse || "").toUpperCase();
  if (response === "CONTACTED") return "Reviewed";
  if (response === "DECLINED") return "Declined support";
  return "Pending review";
}

function priorityRank(entry) {
  if (entry.urgency === "Urgent") return 0;
  if (entry.status === "Declined support") return 1;
  if (entry.urgency === "High") return 2;
  return 3;
}

function urgencyClasses(urgency) {
  if (urgency === "Urgent") return "border-red-300 bg-red-600 text-white shadow-sm shadow-red-200";
  if (urgency === "High") return "border-orange-300 bg-orange-500 text-white shadow-sm shadow-orange-200";
  if (urgency === "Reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusClasses(status) {
  if (status === "Declined support") return "border-red-200 bg-red-50 text-red-700";
  if (status === "Pending review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function cardClasses(entry) {
  if (entry.urgency === "Urgent") {
    return "border-red-300 bg-gradient-to-r from-red-50 via-white to-white shadow-[0_18px_45px_-32px_rgba(220,38,38,0.9)]";
  }
  if (entry.status === "Declined support") {
    return "border-red-200 bg-gradient-to-r from-rose-50 via-white to-white";
  }
  return "border-orange-200 bg-gradient-to-r from-orange-50/80 via-white to-white";
}

function markerClasses(entry) {
  if (entry.urgency === "Urgent") return "bg-red-600";
  if (entry.status === "Declined support") return "bg-rose-500";
  return "bg-orange-500";
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

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function FlaggedEntryCard({ entry, onMessage, onReview }) {
  const isUrgent = entry.urgency === "Urgent";
  const concernTags = Array.isArray(entry.concernTags) ? entry.concernTags : [];
  const reason = entry.adminFlagReason || entry.summary || "No flag reason recorded.";

  return (
    <article className={`relative overflow-hidden rounded-2xl border p-5 ${cardClasses(entry)}`}>
      <div className={`absolute inset-y-0 left-0 w-2 ${markerClasses(entry)}`} />

      <div className="flex flex-col gap-5 pl-2 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${urgencyClasses(entry.urgency)}`}>
              {isUrgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              {entry.urgency}
            </span>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(entry.status)}`}>
              {entry.status}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {entry.riskLevel || "HIGH"} risk
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${isUrgent ? "bg-red-600 text-white" : "bg-orange-100 text-orange-800"}`}>
              {getInitials(entry.fullName)}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black leading-7 text-slate-950">{entry.fullName || entry.studentNumber}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-slate-600">
                <span>{entry.studentNumber}</span>
                <span>|</span>
                <span>{entry.program || "Unspecified program"}</span>
                <span>|</span>
                <span>{formatDateTime(entry.createdAt || entry.entryDate)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Flag reason</div>
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-800">{reason}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {entry.primaryConcern ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {entry.primaryConcern}
              </span>
            ) : null}
            {concernTags.slice(0, 4).map((tag) => (
              <span key={`${entry.id}-${tag}`} className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-700">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 xl:w-44">
          <button
            type="button"
            onClick={() => onReview(entry)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
          >
            <Eye className="h-4 w-4" />
            Review Now
          </button>
          <button
            type="button"
            onClick={() => onMessage(entry)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
          >
            <MessageCircle className="h-4 w-4" />
            Message
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FlaggedEntries({ onLogout, session }) {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageTitle, setMessageTitle] = useState("Counselor Follow-up");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
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

  const normalizedEntries = useMemo(
    () =>
      entries
        .map((entry) => ({
          ...entry,
          urgency: urgencyFromEntry(entry),
          status: statusFromEntry(entry),
        }))
        .sort((a, b) => priorityRank(a) - priorityRank(b) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return normalizedEntries.filter((entry) => {
      const matchesTab =
        activeTab === "All" ||
        (activeTab === "Reviewed" ? entry.status === "Reviewed" : entry.urgency === activeTab);
      const haystack = [
        entry.fullName,
        entry.studentNumber,
        entry.program,
        entry.primaryConcern,
        ...(Array.isArray(entry.concernTags) ? entry.concernTags : []),
        entry.summary,
        entry.adminFlagReason,
      ]
        .join(" ")
        .toLowerCase();
      return matchesTab && haystack.includes(needle);
    });
  }, [activeTab, normalizedEntries, query]);

  const stats = useMemo(() => {
    const totalFlagged = normalizedEntries.length;
    const urgent = normalizedEntries.filter((entry) => entry.urgency === "Urgent").length;
    const declined = normalizedEntries.filter((entry) => entry.status === "Declined support").length;
    const pending = normalizedEntries.filter((entry) => entry.status === "Pending review" || entry.status === "Declined support").length;
    const resolved = normalizedEntries.filter((entry) => entry.status === "Reviewed").length;
    return { totalFlagged, urgent, declined, pending, resolved };
  }, [normalizedEntries]);

  async function handleSendMessage() {
    if (!messageTarget?.studentNumber) return;
    try {
      setIsSending(true);
      await sendAdminStudentNotification(messageTarget.studentNumber, {
        title: messageTitle,
        message: messageBody,
        actorEmail: session?.email || "",
        actorName: session?.name || "",
        actorRole: "Counselor",
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

  return (
    <Layout title="Flagged Entries" subtitle="High-priority student safety queue for counselor review." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {stats.pending > 0 ? (
          <div className="rounded-3xl border border-red-200 bg-gradient-to-r from-red-600 to-red-500 px-5 py-5 text-white shadow-[0_24px_70px_-38px_rgba(220,38,38,0.9)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-red-100">Immediate attention</div>
                  <h2 className="mt-1 text-2xl font-black">{stats.pending} flagged {stats.pending === 1 ? "case" : "cases"} pending review</h2>
                  <p className="mt-1 text-sm font-medium text-red-50">
                    Review urgent and declined-support entries first. The queue is sorted by risk.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(stats.urgent > 0 ? "Urgent" : "High")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-red-700 shadow-sm hover:bg-red-50"
              >
                Focus Priority Queue
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Flagged", value: stats.totalFlagged, icon: Flag, className: "border-slate-200 bg-white text-slate-900" },
            { label: "Urgent", value: stats.urgent, icon: AlertTriangle, className: "border-red-300 bg-red-600 text-white shadow-lg shadow-red-100" },
            { label: "Declined Support", value: stats.declined, icon: AlertCircle, className: "border-rose-200 bg-rose-50 text-rose-800" },
            { label: "Pending Review", value: stats.pending, icon: Eye, className: "border-amber-200 bg-amber-50 text-amber-800" },
            { label: "Reviewed", value: stats.resolved, icon: CheckCircle, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-2xl border p-5 ${stat.className}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black uppercase tracking-[0.12em] opacity-80">{stat.label}</div>
                  <Icon className="h-5 w-5 opacity-80" />
                </div>
                <div className="mt-4 text-4xl font-black leading-none">{stat.value}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                    activeTab === tab
                      ? tab === "Urgent"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, student no., concern..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm font-medium focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
            Loading flagged entries...
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <FlaggedEntryCard
                  key={entry.id}
                  entry={entry}
                  onMessage={setMessageTarget}
                  onReview={setSelectedEntry}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                No flagged entries matched the current search.
              </div>
            )}
          </div>
        )}

        <Modal isOpen={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} title="Review Journal Entry" maxWidth="max-w-4xl">
          {selectedEntry ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${urgencyClasses(selectedEntry.urgency)}`}>
                        {selectedEntry.urgency} Priority
                      </span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(selectedEntry.status)}`}>
                        {selectedEntry.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-slate-950">{selectedEntry.fullName}</h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-sm font-medium text-slate-600">
                      <span>{selectedEntry.studentNumber}</span>
                      <span>|</span>
                      <span>{selectedEntry.program || "Unspecified"}</span>
                      <span>|</span>
                      <span>{formatDateTime(selectedEntry.entryDate || selectedEntry.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMessageTarget(selectedEntry)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message Student
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr,1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Summary</div>
                    <p className="text-sm font-medium leading-6 text-slate-800">{selectedEntry.summary || "No summary available."}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Summary Notes</div>
                    {Array.isArray(selectedEntry.insights) && selectedEntry.insights.length ? (
                      <ul className="space-y-2 text-sm leading-6 text-slate-700">
                        {selectedEntry.insights.map((insight, index) => (
                          <li key={`${selectedEntry.id}-insight-${index}`} className="rounded-xl bg-slate-50 px-3 py-2">
                            {insight}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-500">No summary notes generated.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Concern Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(selectedEntry.concernTags) && selectedEntry.concernTags.length ? (
                        selectedEntry.concernTags.map((tag) => (
                          <span key={`${selectedEntry.id}-${tag}`} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No tags saved.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-white p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-red-500">Flag Details</div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><span className="font-black text-slate-950">Risk Level:</span> {selectedEntry.riskLevel}</div>
                      <div><span className="font-black text-slate-950">Primary Concern:</span> {selectedEntry.primaryConcern || "Not set"}</div>
                      <div><span className="font-black text-slate-950">Support Response:</span> {selectedEntry.supportResponse || "No response recorded"}</div>
                      <div><span className="font-black text-slate-950">Reason:</span> {selectedEntry.adminFlagReason || "No admin flag reason recorded."}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal isOpen={Boolean(messageTarget)} onClose={() => setMessageTarget(null)} title={`Message ${messageTarget?.fullName || ""}`}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">This message will be sent to the student's mobile notification center.</p>
            </div>

            <input
              type="text"
              value={messageTitle}
              onChange={(event) => setMessageTitle(event.target.value)}
              placeholder="Notification title"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <textarea
              rows={4}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Type your follow-up message..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setMessageTarget(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={isSending || !messageBody.trim() || !messageTitle.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}

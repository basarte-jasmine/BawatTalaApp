import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Eye, Flag, MessageCircle, Search } from "lucide-react";
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

function urgencyClasses(urgency) {
  if (urgency === "Urgent") return "bg-red-50 text-red-700 border-red-200";
  if (urgency === "High") return "bg-orange-50 text-orange-700 border-orange-200";
  if (urgency === "Reviewed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function statusFromEntry(entry) {
  const response = String(entry?.supportResponse || "").toUpperCase();
  if (response === "CONTACTED") return "Reviewed";
  if (response === "DECLINED") return "Declined support";
  return "Pending review";
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
      entries.map((entry) => ({
        ...entry,
        urgency: urgencyFromEntry(entry),
        status: statusFromEntry(entry),
      })),
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
      ]
        .join(" ")
        .toLowerCase();
      return matchesTab && haystack.includes(needle);
    });
  }, [activeTab, normalizedEntries, query]);

  const stats = useMemo(() => {
    const totalFlagged = normalizedEntries.length;
    const urgent = normalizedEntries.filter((entry) => entry.urgency === "Urgent").length;
    const pending = normalizedEntries.filter((entry) => entry.status === "Pending review" || entry.status === "Declined support").length;
    const resolved = normalizedEntries.filter((entry) => entry.status === "Reviewed").length;
    return { totalFlagged, urgent, pending, resolved };
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
    <Layout title="Flagged Entries" subtitle="Review journal entries that need counselor attention and follow-up." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Flagged", value: stats.totalFlagged, icon: Flag, iconClass: "text-emerald-700", bgClass: "bg-emerald-50" },
            { label: "Urgent", value: stats.urgent, icon: AlertCircle, iconClass: "text-red-600", bgClass: "bg-red-50" },
            { label: "Pending Review", value: stats.pending, icon: Eye, iconClass: "text-amber-600", bgClass: "bg-amber-50" },
            { label: "Reviewed", value: stats.resolved, icon: CheckCircle, iconClass: "text-emerald-600", bgClass: "bg-emerald-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.bgClass}`}>
                  <Icon className={`h-6 w-6 ${stat.iconClass}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">{stat.label}</div>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 p-4 sm:flex-row">
            <div className="flex items-center space-x-1 rounded-xl bg-slate-100 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                    activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search students or entries..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading flagged entries...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-semibold">Student Name</th>
                    <th className="px-6 py-4 font-semibold">Program</th>
                    <th className="px-6 py-4 font-semibold">Concern Type</th>
                    <th className="px-6 py-4 font-semibold">Urgency</th>
                    <th className="px-6 py-4 font-semibold">Flagged Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {filteredEntries.length ? (
                    filteredEntries.map((entry) => (
                      <tr key={entry.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => setSelectedEntry(entry)}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
                              {getInitials(entry.fullName)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 group-hover:text-emerald-700">{entry.fullName}</div>
                              <div className="text-xs text-slate-500">{entry.studentNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-600">{entry.program || "Unspecified"}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {entry.primaryConcern ? (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                {entry.primaryConcern}
                              </span>
                            ) : null}
                            {Array.isArray(entry.concernTags) && entry.concernTags.length
                              ? entry.concernTags.slice(0, 2).map((tag) => (
                                  <span key={`${entry.id}-${tag}`} className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    {tag}
                                  </span>
                                ))
                              : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${urgencyClasses(entry.urgency)}`}>{entry.urgency}</span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-500">{formatDateTime(entry.createdAt)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-600">{entry.status}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100">
                            <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => setSelectedEntry(entry)}>
                              <Eye className="h-4 w-4" />
                            </button>
                            <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => setMessageTarget(entry)}>
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                        No flagged entries matched the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal isOpen={Boolean(selectedEntry)} onClose={() => setSelectedEntry(null)} title="Review Journal Entry" maxWidth="max-w-4xl">
          {selectedEntry ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedEntry.fullName}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>{selectedEntry.studentNumber}</span>
                    <span>•</span>
                    <span>{selectedEntry.program || "Unspecified"}</span>
                    <span>•</span>
                    <span>{formatDateTime(selectedEntry.entryDate)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${urgencyClasses(selectedEntry.urgency)}`}>{selectedEntry.urgency} Priority</span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{selectedEntry.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr,1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</div>
                    <p className="text-sm leading-6 text-slate-800">{selectedEntry.summary || "No summary available."}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Insights</div>
                    {Array.isArray(selectedEntry.insights) && selectedEntry.insights.length ? (
                      <ul className="space-y-2 text-sm leading-6 text-slate-700">
                        {selectedEntry.insights.map((insight, index) => (
                          <li key={`${selectedEntry.id}-insight-${index}`}>• {insight}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-500">No insights generated.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Concern Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(selectedEntry.concernTags) && selectedEntry.concernTags.length ? (
                        selectedEntry.concernTags.map((tag) => (
                          <span key={`${selectedEntry.id}-${tag}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No tags saved.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Flag Details</div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><span className="font-semibold text-slate-900">Risk Level:</span> {selectedEntry.riskLevel}</div>
                      <div><span className="font-semibold text-slate-900">Primary Concern:</span> {selectedEntry.primaryConcern || "Not set"}</div>
                      <div><span className="font-semibold text-slate-900">Support Response:</span> {selectedEntry.supportResponse || "No response recorded"}</div>
                      <div><span className="font-semibold text-slate-900">Reason:</span> {selectedEntry.adminFlagReason || "No admin flag reason recorded."}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal isOpen={Boolean(messageTarget)} onClose={() => setMessageTarget(null)} title={`Message ${messageTarget?.fullName || ""}`}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-800">This message will be sent to the student's mobile notification center.</p>
            </div>

            <input
              type="text"
              value={messageTitle}
              onChange={(event) => setMessageTitle(event.target.value)}
              placeholder="Notification title"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <textarea
              rows={4}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Type your follow-up message..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setMessageTarget(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={isSending || !messageBody.trim() || !messageTitle.trim()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
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

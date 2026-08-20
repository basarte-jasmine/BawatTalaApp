import { useEffect, useMemo, useState } from "react";
import { Image, MessageSquare, RefreshCw, Search } from "lucide-react";
import Layout from "../components/Layout";
import { fetchAdminFeedbacks, updateAdminFeedback } from "../lib/admin-api";

const STATUS_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "NEW", label: "New" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "REVIEWED", label: "Reviewed" },
  { id: "RESOLVED", label: "Resolved" },
];

const STATUS_LABELS = {
  NEW: "New",
  REVIEWED: "Reviewed",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

const PRIORITY_LABELS = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
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

function getStatusClasses(status) {
  if (status === "NEW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "RESOLVED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getActorPayload(session) {
  return {
    actorEmail: session?.email || "",
  };
}

export default function Feedbacks({ onLogout, session }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadFeedbacks() {
    try {
      setIsLoading(true);
      const data = await fetchAdminFeedbacks({ search: query.trim(), status: activeStatus });
      const nextFeedbacks = Array.isArray(data?.feedbacks) ? data.feedbacks : [];
      setFeedbacks(nextFeedbacks);
      setDrafts((current) => {
        const next = { ...current };
        nextFeedbacks.forEach((feedback) => {
          if (!next[feedback.id]) {
            next[feedback.id] = {
              adminNotes: feedback.adminNotes || "",
              priority: feedback.priority || "NORMAL",
              status: feedback.status || "NEW",
            };
          }
        });
        return next;
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load feedbacks.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadFeedbacks();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [activeStatus, query]);

  const stats = useMemo(() => {
    return {
      total: feedbacks.length,
      newItems: feedbacks.filter((item) => item.status === "NEW").length,
      withImages: feedbacks.filter((item) => item.attachment).length,
      resolved: feedbacks.filter((item) => item.status === "RESOLVED").length,
    };
  }, [feedbacks]);

  function updateDraft(feedbackId, updates) {
    setDrafts((current) => ({
      ...current,
      [feedbackId]: {
        ...(current[feedbackId] || {}),
        ...updates,
      },
    }));
  }

  async function saveFeedback(feedback) {
    const draft = drafts[feedback.id] || {};
    try {
      setSavingId(feedback.id);
      const data = await updateAdminFeedback(feedback.id, {
        ...getActorPayload(session),
        adminNotes: draft.adminNotes || "",
        priority: draft.priority || feedback.priority || "NORMAL",
        status: draft.status || feedback.status || "NEW",
      });
      const updated = data?.feedback;
      if (updated) {
        setFeedbacks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        updateDraft(updated.id, {
          adminNotes: updated.adminNotes || "",
          priority: updated.priority || "NORMAL",
          status: updated.status || "NEW",
        });
      }
      setSuccessMessage(data?.message || "Feedback updated.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update feedback.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <Layout
      title="Feedbacks"
      subtitle="Review app feedback, screenshots, bugs, and suggestions sent by students."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1180px] space-y-6 pb-12">
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

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#dce8d2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-admin-muted">Shown</p>
            <p className="mt-2 text-3xl font-bold text-admin-ink">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-[#dce8d2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-admin-muted">New</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.newItems}</p>
          </div>
          <div className="rounded-2xl border border-[#dce8d2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-admin-muted">With Images</p>
            <p className="mt-2 text-3xl font-bold text-admin-ink">{stats.withImages}</p>
          </div>
          <div className="rounded-2xl border border-[#dce8d2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-admin-muted">Resolved</p>
            <p className="mt-2 text-3xl font-bold text-admin-ink">{stats.resolved}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce8d2] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveStatus(filter.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    activeStatus === filter.id
                      ? "border-[#229365] bg-[#229365] text-white"
                      : "border-[#dce8d2] bg-white text-[#229365] hover:bg-[#eef8e9]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-[#dce8d2] bg-[#f8fbf4] px-3 py-2">
                <Search className="h-4 w-4 text-admin-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search student or message"
                  className="w-full bg-transparent text-sm text-admin-ink outline-none placeholder:text-admin-muted"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadFeedbacks()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#229365] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b7b54]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[#dce8d2] bg-white p-8 text-center text-sm font-semibold text-admin-muted">
            Loading feedbacks...
          </div>
        ) : feedbacks.length ? (
          <div className="space-y-4">
            {feedbacks.map((feedback) => {
              const draft = drafts[feedback.id] || {};
              return (
                <article key={feedback.id} className="rounded-2xl border border-[#dce8d2] bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(feedback.status)}`}>
                          {STATUS_LABELS[feedback.status] || feedback.status}
                        </span>
                        <span className="rounded-full border border-[#dce8d2] bg-[#f8fbf4] px-3 py-1 text-xs font-bold text-[#4d6c58]">
                          {feedback.category}
                        </span>
                        <span className="text-xs font-semibold text-admin-muted">{formatDateTime(feedback.createdAt)}</span>
                      </div>

                      <h2 className="text-lg font-bold text-admin-ink">
                        {feedback.studentName || feedback.studentNumber}
                      </h2>
                      <p className="text-sm text-admin-muted">
                        {feedback.studentNumber}
                        {feedback.studentEmail ? ` · ${feedback.studentEmail}` : ""}
                      </p>
                      <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#f8fbf4] p-4 text-sm leading-6 text-[#334155]">
                        {feedback.message}
                      </p>

                      {feedback.attachment ? (
                        <a
                          href={feedback.attachment.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-[#dce8d2] bg-white p-3 text-sm font-semibold text-[#229365] hover:bg-[#f8fbf4]"
                        >
                          <img
                            src={feedback.attachment.dataUrl}
                            alt={feedback.attachment.fileName || "Feedback attachment"}
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                          <span className="inline-flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            View attachment
                          </span>
                        </a>
                      ) : null}
                    </div>

                    <div className="w-full space-y-3 rounded-2xl border border-[#e5ecd9] bg-[#fbfdf7] p-4 lg:w-[320px]">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-admin-muted">Status</span>
                        <select
                          value={draft.status || feedback.status || "NEW"}
                          onChange={(event) => updateDraft(feedback.id, { status: event.target.value })}
                          className="w-full rounded-xl border border-[#dce8d2] bg-white px-3 py-2 text-sm font-semibold text-admin-ink outline-none"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-admin-muted">Priority</span>
                        <select
                          value={draft.priority || feedback.priority || "NORMAL"}
                          onChange={(event) => updateDraft(feedback.id, { priority: event.target.value })}
                          className="w-full rounded-xl border border-[#dce8d2] bg-white px-3 py-2 text-sm font-semibold text-admin-ink outline-none"
                        >
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-admin-muted">Admin Notes</span>
                        <textarea
                          value={draft.adminNotes ?? feedback.adminNotes ?? ""}
                          onChange={(event) => updateDraft(feedback.id, { adminNotes: event.target.value })}
                          rows={5}
                          className="w-full resize-none rounded-xl border border-[#dce8d2] bg-white px-3 py-2 text-sm leading-5 text-admin-ink outline-none"
                          placeholder="Internal note for review or follow-up"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void saveFeedback(feedback)}
                        disabled={savingId === feedback.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229365] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b7b54] disabled:opacity-60"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {savingId === feedback.id ? "Saving..." : "Save Review"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#cdddc2] bg-white p-10 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-[#8aa083]" />
            <h2 className="mt-3 text-lg font-bold text-admin-ink">No feedback found</h2>
            <p className="mt-1 text-sm text-admin-muted">New app feedback will appear here once students send it.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

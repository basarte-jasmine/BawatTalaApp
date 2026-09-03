import Toast from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Image, MessageSquare, RefreshCw, Search, Trash2 } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { deleteAdminFeedback, fetchAdminFeedbacks, updateAdminFeedback } from "../lib/admin-api";

const STATUS_FILTERS = [
  { id: "ALL", label: "All Statuses" },
  { id: "NEW", label: "New" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "REVIEWED", label: "Reviewed" },
  { id: "RESOLVED", label: "Resolved" },
];

const TYPE_FILTERS = [
  { id: "ALL", label: "All Types" },
  { id: "SUPPORT", label: "Support Requests" },
  { id: "FEEDBACK", label: "User Feedback" },
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

const ITEMS_PER_PAGE = 8;

function getSubmissionType(item) {
  const raw = String(item?.submissionType || item?.type || item?.kind || "").trim().toUpperCase();
  if (raw === "SUPPORT") return "SUPPORT";
  return "FEEDBACK";
}

function getTypeBadge(item) {
  if (getSubmissionType(item) === "SUPPORT") {
    return {
      label: "Support",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }
  return {
    label: "Feedback",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

function getPriorityClasses(priority) {
  if (priority === "HIGH") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "LOW") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-[#dce8d2] bg-[#f8fbf4] text-[#4d6c58]";
}

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

function getSnippet(item) {
  const subject = String(item?.category || item?.subject || "").replace(/\s+/g, " ").trim();
  const message = String(item?.message || "").replace(/\s+/g, " ").trim();
  if (subject && message) return `${subject} — ${message}`;
  return subject || message || "No message";
}

const filterButtonClass = (active) =>
  `rounded-full border px-3 py-1.5 text-xs font-semibold ${
    active
      ? "border-[#229365] bg-[#229365] text-white"
      : "border-[#dce8d2] bg-white text-[#229365] hover:bg-[#eef8e9]"
  }`;

export default function Feedbacks({ onLogout, session }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [activeType, setActiveType] = useState("ALL");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [lightboxAttachment, setLightboxAttachment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, activeType, query]);

  const visibleFeedbacks = useMemo(() => {
    if (activeType === "ALL") return feedbacks;
    return feedbacks.filter((item) => getSubmissionType(item) === activeType);
  }, [activeType, feedbacks]);

  const totalPages = Math.max(1, Math.ceil(visibleFeedbacks.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleFeedbacks.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, visibleFeedbacks]);

  const stats = useMemo(() => {
    return {
      total: visibleFeedbacks.length,
      newItems: visibleFeedbacks.filter((item) => item.status === "NEW").length,
      withImages: visibleFeedbacks.filter((item) => item.attachment).length,
      resolved: visibleFeedbacks.filter((item) => item.status === "RESOLVED").length,
    };
  }, [visibleFeedbacks]);

  const reviewItem = useMemo(
    () => visibleFeedbacks.find((item) => item.id === reviewId) || feedbacks.find((item) => item.id === reviewId) || null,
    [feedbacks, reviewId, visibleFeedbacks],
  );

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

  async function handleDeleteFeedback() {
    if (!deleteTarget?.id) return;
    try {
      setIsDeleting(true);
      await deleteAdminFeedback(deleteTarget.id);
      setFeedbacks((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (reviewId === deleteTarget.id) {
        closeReview();
      }
      setDeleteTarget(null);
      setSuccessMessage("Request deleted successfully.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete request.");
    } finally {
      setIsDeleting(false);
    }
  }

  function closeReview() {
    setReviewId("");
    setLightboxAttachment(null);
  }

  const reviewDraft = reviewItem ? drafts[reviewItem.id] || {} : {};
  const reviewTypeBadge = reviewItem ? getTypeBadge(reviewItem) : null;

  return (
    <Layout
      title="Help & Support Requests / Feedback"
      subtitle="Review help tickets and user feedback, including screenshots, bugs, and suggestions sent by students."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1180px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex items-center justify-between rounded-xl border border-[#dce8d2] bg-white px-4 py-2.5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-muted">Shown</p>
            <p className="text-2xl font-bold text-admin-ink">{stats.total}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#dce8d2] bg-white px-4 py-2.5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-muted">New</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.newItems}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#dce8d2] bg-white px-4 py-2.5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-muted">With Images</p>
            <p className="text-2xl font-bold text-admin-ink">{stats.withImages}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#dce8d2] bg-white px-4 py-2.5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-muted">Resolved</p>
            <p className="text-2xl font-bold text-admin-ink">{stats.resolved}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce8d2] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={`type-${filter.id}`}
                  type="button"
                  onClick={() => setActiveType(filter.id)}
                  className={filterButtonClass(activeType === filter.id)}
                >
                  {filter.label}
                </button>
              ))}
              <span className="hidden h-5 w-px bg-[#dce8d2] sm:block" aria-hidden="true" />
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={`status-${filter.id}`}
                  type="button"
                  onClick={() => setActiveStatus(filter.id)}
                  className={filterButtonClass(activeStatus === filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-[#dce8d2] bg-[#f8fbf4] px-3 py-2">
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
            Loading requests...
          </div>
        ) : visibleFeedbacks.length ? (
          <div className="overflow-hidden rounded-2xl border border-[#dce8d2] bg-white shadow-sm">
            <div className="divide-y divide-[#eef3e8]">
              {paginatedFeedbacks.map((feedback) => {
                const typeBadge = getTypeBadge(feedback);
                return (
                  <div
                    key={feedback.id}
                    onClick={() => setReviewId(feedback.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f8fbf4]"
                  >
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${typeBadge.className}`}>
                      {typeBadge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-admin-ink">
                        {feedback.studentName || feedback.studentNumber}
                      </p>
                      <p className="truncate text-xs text-admin-muted">{getSnippet(feedback)}</p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline ${getStatusClasses(feedback.status)}`}>
                      {STATUS_LABELS[feedback.status] || feedback.status}
                    </span>
                    <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold md:inline ${getPriorityClasses(feedback.priority)}`}>
                      {PRIORITY_LABELS[feedback.priority] || feedback.priority || "Normal"}
                    </span>
                    <span className="w-[118px] shrink-0 text-right text-[11px] font-semibold text-admin-muted">
                      {formatDateTime(feedback.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(feedback);
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Delete request"
                      aria-label="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#eef3e8] bg-[#fbfdf7] px-4 py-3 sm:flex-row">
              <p className="text-xs font-medium text-admin-muted">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, visibleFeedbacks.length)} of{" "}
                {visibleFeedbacks.length} requests
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-full border border-[#dce8d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#229365] transition hover:bg-[#eef8e9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <span className="px-2 text-xs font-bold text-admin-ink">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-full border border-[#dce8d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#229365] transition hover:bg-[#eef8e9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#cdddc2] bg-white p-10 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-[#8aa083]" />
            <h2 className="mt-3 text-lg font-bold text-admin-ink">No requests found</h2>
            <p className="mt-1 text-sm text-admin-muted">Help & Support requests and user feedback will appear here once students send them.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(reviewItem)}
        onClose={closeReview}
        title={reviewItem ? `${reviewItem.studentName || reviewItem.studentNumber}` : "Review"}
        maxWidth="max-w-2xl"
      >
        {reviewItem ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${reviewTypeBadge.className}`}>
                {reviewTypeBadge.label}
              </span>
              <span className="text-xs font-semibold text-admin-muted">{formatDateTime(reviewItem.createdAt)}</span>
            </div>
            <p className="text-sm text-admin-muted">
              {reviewItem.studentNumber}
              {reviewItem.studentEmail ? ` · ${reviewItem.studentEmail}` : ""}
            </p>
            {reviewItem.category ? (
              <p className="text-sm font-semibold text-admin-ink">
                Category: <span className="font-medium text-admin-muted">{reviewItem.category}</span>
              </p>
            ) : null}
            <p className="whitespace-pre-wrap rounded-2xl bg-[#f8fbf4] p-4 text-sm leading-6 text-[#334155]">
              {reviewItem.message || "No message"}
            </p>

            {reviewItem.attachment?.dataUrl ? (
              <button
                type="button"
                onClick={() => setLightboxAttachment(reviewItem.attachment)}
                className="inline-flex items-center gap-3 rounded-2xl border border-[#dce8d2] bg-white p-3 text-sm font-semibold text-[#229365] hover:bg-[#f8fbf4]"
              >
                <img
                  src={reviewItem.attachment.dataUrl}
                  alt={reviewItem.attachment.fileName || "Feedback attachment"}
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <span className="inline-flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  View attachment
                </span>
              </button>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-admin-muted">Status</span>
                <select
                  value={reviewDraft.status || reviewItem.status || "NEW"}
                  onChange={(event) => updateDraft(reviewItem.id, { status: event.target.value })}
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
                  value={reviewDraft.priority || reviewItem.priority || "NORMAL"}
                  onChange={(event) => updateDraft(reviewItem.id, { priority: event.target.value })}
                  className="w-full rounded-xl border border-[#dce8d2] bg-white px-3 py-2 text-sm font-semibold text-admin-ink outline-none"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-admin-muted">Admin Notes</span>
              <textarea
                value={reviewDraft.adminNotes ?? reviewItem.adminNotes ?? ""}
                onChange={(event) => updateDraft(reviewItem.id, { adminNotes: event.target.value })}
                rows={5}
                className="w-full resize-none rounded-xl border border-[#dce8d2] bg-white px-3 py-2 text-sm leading-5 text-admin-ink outline-none"
                placeholder="Internal note for review or follow-up"
              />
            </label>
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(reviewItem)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => void saveFeedback(reviewItem)}
                disabled={savingId === reviewItem.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#229365] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1b7b54] disabled:opacity-60"
              >
                <MessageSquare className="h-4 w-4" />
                {savingId === reviewItem.id ? "Saving..." : "Save Review"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteFeedback()}
        title={deleteTarget ? `Delete ${getSubmissionType(deleteTarget) === "SUPPORT" ? "Support Request" : "Feedback"}` : "Delete"}
        description={`Are you sure you want to delete this ${deleteTarget && getSubmissionType(deleteTarget) === "SUPPORT" ? "support request" : "feedback"} from ${deleteTarget?.studentName || deleteTarget?.studentNumber || "student"}? This action cannot be undone.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        confirmTone="rose"
      />

      <Modal
        isOpen={Boolean(lightboxAttachment?.dataUrl)}
        onClose={() => setLightboxAttachment(null)}
        title={lightboxAttachment?.fileName || "Attachment"}
        maxWidth="max-w-4xl"
      >
        {lightboxAttachment?.dataUrl ? (
          <img
            src={lightboxAttachment.dataUrl}
            alt={lightboxAttachment.fileName || "Feedback attachment"}
            className="mx-auto max-h-[70vh] w-full rounded-xl object-contain"
          />
        ) : null}
      </Modal>
    </Layout>
  );
}

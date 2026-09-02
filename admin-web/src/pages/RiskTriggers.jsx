import Toast from "../components/Toast";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import {
  createRiskTrigger,
  deleteRiskTrigger,
  fetchRiskTriggers,
  updateRiskTrigger,
} from "../lib/admin-api";
import { getRiskBadgeClasses, getRiskLevelLabel } from "../lib/risk-labels";

const DEFAULT_FORM = {
  isEnabled: true,
  phrase: "",
  riskLevel: "HIGH",
};

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "HIGH", label: "Crisis / Critical Need" },
  { id: "LOW", label: "Distressed / Needs Support" },
  { id: "DISABLED", label: "Disabled" },
];

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

function getActorPayload(session) {
  return {
    actorName: session?.name || "",
    actorRole: session?.roleLabel || session?.role || "Admin",
  };
}

export default function RiskTriggers({ onLogout, session }) {
  const [triggers, setTriggers] = useState([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingTrigger, setEditingTrigger] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formState, setFormState] = useState(DEFAULT_FORM);

  async function loadTriggers() {
    try {
      setIsLoading(true);
      const data = await fetchRiskTriggers();
      setTriggers(Array.isArray(data?.triggers) ? data.triggers : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load risk triggers.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTriggers();
  }, []);

  const stats = useMemo(() => {
    const enabled = triggers.filter((trigger) => trigger.isEnabled);
    return {
      crisis: enabled.filter((trigger) => trigger.riskLevel === "HIGH").length,
      disabled: triggers.filter((trigger) => !trigger.isEnabled).length,
      distressed: enabled.filter((trigger) => trigger.riskLevel === "LOW").length,
      total: triggers.length,
    };
  }, [triggers]);

  const filteredTriggers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return triggers.filter((trigger) => {
      const matchesFilter =
        activeFilter === "ALL" ||
        (activeFilter === "DISABLED" ? !trigger.isEnabled : trigger.riskLevel === activeFilter);
      const haystack = [trigger.phrase, trigger.riskLabel]
        .join(" ")
        .toLowerCase();
      return matchesFilter && haystack.includes(needle);
    });
  }, [activeFilter, query, triggers]);

  function openCreateModal() {
    setEditingTrigger(null);
    setFormState(DEFAULT_FORM);
    setIsFormOpen(true);
    setSuccessMessage("");
    setErrorMessage("");
  }

  function openEditModal(trigger) {
    setEditingTrigger(trigger);
    setFormState({
      isEnabled: Boolean(trigger.isEnabled),
      phrase: trigger.phrase || "",
      riskLevel: trigger.riskLevel || "HIGH",
    });
    setIsFormOpen(true);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleSave() {
    const phrase = formState.phrase.trim();
    if (!phrase) {
      setErrorMessage("Trigger word or phrase is required.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        ...getActorPayload(session),
        isEnabled: Boolean(formState.isEnabled),
        phrase,
        riskLevel: formState.riskLevel,
      };

      const data = editingTrigger
        ? await updateRiskTrigger(editingTrigger.id, payload)
        : await createRiskTrigger(payload);

      const savedTrigger = data?.trigger;
      if (savedTrigger) {
        setTriggers((current) =>
          editingTrigger
            ? current.map((trigger) => (trigger.id === savedTrigger.id ? savedTrigger : trigger))
            : [savedTrigger, ...current],
        );
      } else {
        await loadTriggers();
      }
      setSuccessMessage(data?.message || "Risk trigger saved.");
      setEditingTrigger(null);
      setIsFormOpen(false);
      setFormState(DEFAULT_FORM);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save risk trigger.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(trigger) {
    try {
      const data = await updateRiskTrigger(trigger.id, {
        ...getActorPayload(session),
        isEnabled: !trigger.isEnabled,
        phrase: trigger.phrase,
        riskLevel: trigger.riskLevel,
      });
      const updated = data?.trigger;
      if (updated) {
        setTriggers((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
      setSuccessMessage(data?.message || "Risk trigger updated.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update risk trigger.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    try {
      const data = await deleteRiskTrigger(deleteTarget.id, getActorPayload(session));
      setTriggers((current) => current.filter((trigger) => trigger.id !== deleteTarget.id));
      setSuccessMessage(data?.message || "Risk trigger deleted.");
      setDeleteTarget(null);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete risk trigger.");
    }
  }

  return (
    <Layout
      title="Risk Trigger Settings"
      subtitle="Manage the fallback phrases used for journal safety flagging."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Risk Trigger Settings</h1>
            <p className="mt-1 text-sm text-slate-500">
              These phrases are a fallback safety check. AI analysis still reviews journal meaning and context.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Add Trigger
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShieldAlert,
              label: "Total Triggers",
              tone: "border-slate-200 bg-white text-slate-900",
              value: stats.total,
            },
            {
              icon: AlertTriangle,
              label: "Crisis / Critical Need",
              tone: "border-red-200 bg-red-50 text-red-900",
              value: stats.crisis,
            },
            {
              icon: CheckCircle2,
              label: "Distressed / Needs Support",
              tone: "border-amber-200 bg-amber-50 text-amber-900",
              value: stats.distressed,
            },
            {
              icon: XCircle,
              label: "Disabled",
              tone: "border-slate-200 bg-slate-50 text-slate-700",
              value: stats.disabled,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-2xl border p-5 shadow-sm ${stat.tone}`}>
                <div className="mb-3 flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <div className="text-sm font-semibold">{stat.label}</div>
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    activeFilter === filter.id
                      ? "bg-emerald-700 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search trigger phrases..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading risk triggers...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-semibold">Trigger Phrase</th>
                    <th className="px-6 py-4 font-semibold">Risk Flag</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTriggers.length ? (
                    filteredTriggers.map((trigger) => (
                      <tr key={trigger.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{trigger.phrase}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRiskBadgeClasses(trigger.riskLevel)}`}>
                            {trigger.riskLabel || getRiskLevelLabel(trigger.riskLevel)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => void handleToggle(trigger)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              trigger.isEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {trigger.isEnabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{formatDateTime(trigger.updatedAt || trigger.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(trigger)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                              aria-label={`Edit ${trigger.phrase}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(trigger)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Delete ${trigger.phrase}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                        No trigger phrases matched the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <span className="font-semibold">Balanced / Stable</span> is still used when no AI or fallback risk signal is found. It does not need trigger phrases.
        </div>

        <Modal
          isOpen={isFormOpen}
          onClose={() => {
            setEditingTrigger(null);
            setIsFormOpen(false);
            setFormState(DEFAULT_FORM);
          }}
          title={editingTrigger ? "Edit Risk Trigger" : "Add Risk Trigger"}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Trigger word or phrase</label>
              <input
                type="text"
                value={formState.phrase}
                onChange={(event) => setFormState((current) => ({ ...current, phrase: event.target.value }))}
                placeholder="example: hindi ko na kaya"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Risk flag</label>
              <select
                value={formState.riskLevel}
                onChange={(event) => setFormState((current) => ({ ...current, riskLevel: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="HIGH">Crisis / Critical Need</option>
                <option value="LOW">Distressed / Needs Support</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-slate-800">Enabled</span>
                <span className="block text-xs text-slate-500">Enabled triggers are used by the fallback detector.</span>
              </span>
              <input
                type="checkbox"
                checked={formState.isEnabled}
                onChange={(event) => setFormState((current) => ({ ...current, isEnabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTrigger(null);
                  setIsFormOpen(false);
                  setFormState(DEFAULT_FORM);
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Trigger"}
              </button>
            </div>
          </div>
        </Modal>

        <ConfirmActionModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
          title="Delete Risk Trigger"
          description={`Remove "${deleteTarget?.phrase || "this trigger"}" from the fallback detector?`}
          cancelLabel="Keep Trigger"
          confirmLabel="Delete Trigger"
          confirmTone="rose"
        />
      </div>
    </Layout>
  );
}

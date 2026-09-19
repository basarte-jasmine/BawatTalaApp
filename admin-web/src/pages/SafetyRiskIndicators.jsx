 import Toast from "../components/Toast";
 import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit2,
  Filter,
 HelpCircle,
 History,
 Plus,
 Search,
 ShieldAlert,
 Sparkles,
 Trash2,
 XCircle,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import {
  createSafetyRiskIndicator,
  deleteSafetyRiskIndicator,
  fetchSafetyRiskIndicators,
 fetchSafetyRiskIndicatorHistory,
  updateSafetyRiskIndicator,
} from "../lib/admin-api";
import {
  SAFETY_INDICATOR_CATEGORIES,
  SAFETY_INDICATOR_CATEGORY_DESCRIPTIONS,
  SAFETY_INDICATOR_CATEGORY_LABELS,
  SAFETY_INDICATOR_DOMAINS,
  SAFETY_INDICATOR_DOMAIN_CATEGORY_SET,
  getIndicatorCategoryBadgeClasses,
  getIndicatorCategoryLabel,
} from "../lib/risk-labels";
 
const DEFAULT_FORM = {
  category: "GROOMING",
  severityTier: "CRITICAL",
  description: "",
  isEnabled: true,
  phrase: "",
  variantsInput: "",
};
 

 
 function formatDateTime(value) {
   if (!value) return "Not available";
   const parsed = new Date(value);
   if (Number.isNaN(parsed.getTime())) return "Not available";
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
   return mm + "-" + dd + "-" + yyyy + ", " + hour + ":" + minute + " " + dayPeriod;
 }
 
 function getActorPayload(session) {
   return {
     actorName: session?.name || "",
     actorRole: session?.roleLabel || session?.role || "Counselor",
   };
 }
 
 export default function SafetyRiskIndicators({ onLogout, session }) {
   const [indicators, setIndicators] = useState([]);
   const [query, setQuery] = useState("");
   const [activeTab, setActiveTab] = useState("ALL");   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [isEditingVariants, setIsEditingVariants] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_FORM);
 
   async function loadIndicators() {
     try {
       setIsLoading(true);
       const data = await fetchSafetyRiskIndicators();
       setIndicators(Array.isArray(data?.indicators) ? data.indicators : []);
       setErrorMessage("");
     } catch (error) {
       setErrorMessage(error instanceof Error ? error.message : "Failed to load safety risk indicators.");
     } finally {
       setIsLoading(false);
     }
   }
 
   useEffect(() => {
     void loadIndicators();
   }, []);
 
  const stats = useMemo(() => {
    const enabled = indicators.filter((i) => i.isEnabled);
    return {
      total: indicators.length,
      critical: enabled.filter((i) => (i.severityTier === "CRITICAL" && !["EXPRESSION_HYPERBOLE", "CONFIRMATION_SIGNAL"].includes(i.category)) || ["SELF_HARM", "COERCION_BLACKMAIL", "GROOMING", "ABUSE", "THREAT_VIOLENCE", "SUBSTANCE"].includes(i.category)).length,
      ambiguous: enabled.filter((i) => i.severityTier === "AMBIGUOUS" || i.category === "CRITICAL_AMBIGUOUS").length,
      distress: enabled.filter((i) => i.severityTier === "DISTRESS" || ["EMOTIONAL_DISTRESS", "BULLYING_HARASSMENT", "UNSAFE_ENVIRONMENT", "DISTRESS"].includes(i.category)).length,
      filters: enabled.filter((i) => ["EXPRESSION_HYPERBOLE", "DENY_HYPERBOLE"].includes(i.category) || i.severityTier === "FILTER").length,
      confirmations: enabled.filter((i) => ["CONFIRMATION_SIGNAL", "CONFIRM_LITERAL"].includes(i.category) || i.severityTier === "CONFIRMATION").length,
      disabled: indicators.filter((i) => !i.isEnabled).length,
    };
  }, [indicators]);
 
   const filteredIndicators = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indicators.filter((item) => {
      if (activeTab === "DISABLED" && item.isEnabled) return false;
      if (activeTab === "DISABLED") {
        // show disabled only; still apply search
      } else if (activeTab === "LEGACY") {
        if (SAFETY_INDICATOR_DOMAIN_CATEGORY_SET.has(item.category)) return false;
      } else if (activeTab !== "ALL") {
        const domain = SAFETY_INDICATOR_DOMAINS.find((d) => d.id === activeTab);
        const cats = domain ? domain.subIndicators.map((s) => s.category) : [];
        if (!cats.includes(item.category)) return false;
      }
      const haystack = [item.phrase, item.categoryLabel, item.description, ...(Array.isArray(item.variants) ? item.variants : [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return needle ? haystack.includes(needle) : true;
    });
  }, [activeTab, query, indicators]); 
  function openCreateModal() {
    setEditingIndicator(null);
    setIsEditingVariants(true);
    setFormState({
      ...DEFAULT_FORM,
      category: "GROOMING",
      severityTier: "CRITICAL",
    });
    setIsFormOpen(true);
    setSuccessMessage("");
    setErrorMessage("");
  }

  function openEditModal(item) {
    setEditingIndicator(item);
    setIsEditingVariants(false);
    setFormState({
      category: item.category || "SELF_HARM",
      severityTier: item.severityTier || "CRITICAL",
      description: item.description || "",
      isEnabled: Boolean(item.isEnabled),
      phrase: item.phrase || "",
      variantsInput: Array.isArray(item.variants) ? item.variants.join(", ") : "",
    });
    setIsFormOpen(true);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleSave() {
    const phrase = formState.phrase.trim();
    if (!phrase) {
      setErrorMessage("Indicator phrase is required.");
      return;
    }

    const tokens = (formState.variantsInput || "").split(",");
    const variants = [];
    for (const t of tokens) {
      const v = t.trim().toLowerCase();
      if (v && v !== phrase.toLowerCase() && !variants.includes(v)) {
        variants.push(v);
      }
    }

    try {
      setIsSaving(true);
      const payload = {
        ...getActorPayload(session),
        category: formState.category,
        description: formState.description.trim(),
        isEnabled: Boolean(formState.isEnabled),
        phrase,
        variants,
      };
 
       const data = editingIndicator
         ? await updateSafetyRiskIndicator(editingIndicator.id, payload)
         : await createSafetyRiskIndicator(payload);
 
       const saved = data?.indicator;
       if (saved) {
         setIndicators((current) =>
           editingIndicator
             ? current.map((i) => (i.id === saved.id ? saved : i))
             : [saved, ...current],
         );
       } else {
         await loadIndicators();
       }
       setSuccessMessage(data?.message || "Safety risk indicator saved.");
       setEditingIndicator(null);
       setIsFormOpen(false);
       setFormState(DEFAULT_FORM);
       setErrorMessage("");
     } catch (error) {
       setErrorMessage(error instanceof Error ? error.message : "Failed to save safety risk indicator.");
     } finally {
       setIsSaving(false);
     }
   }
 
  async function handleToggle(item) {
    try {
      const data = await updateSafetyRiskIndicator(item.id, {
        ...getActorPayload(session),
        category: item.category,
        description: item.description,
        variants: item.variants || [],
        isEnabled: !item.isEnabled,
        phrase: item.phrase,
      });
       const updated = data?.indicator;
       if (updated) {
         setIndicators((current) =>
           current.map((i) => (i.id === updated.id ? updated : i)),
         );
       }
       setSuccessMessage(data?.message || "Safety risk indicator updated.");
       setErrorMessage("");
     } catch (error) {
       setErrorMessage(error instanceof Error ? error.message : "Failed to update safety risk indicator.");
     }
   }
 
  async function handleDelete() {
    if (!deleteTarget?.id) return;
    try {
      const data = await deleteSafetyRiskIndicator(deleteTarget.id, getActorPayload(session));
      setIndicators((current) => current.filter((i) => i.id !== deleteTarget.id));
      setSuccessMessage(data?.message || "Safety risk indicator deleted.");
      setDeleteTarget(null);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete safety risk indicator.");
    }
  }

  async function openHistoryModal(item) {
    setHistoryTarget(item);
    setIsHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await fetchSafetyRiskIndicatorHistory(item.id);
      setHistoryLogs(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load audit history.");
      setHistoryLogs([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  return (
     <Layout
       title="Safety and Well-being Risk Indicators"
       subtitle="Manage dynamic clinical indicator dictionaries that power the Two-Phase Safety & Clarification Engine."
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


        {/* Summary Metric Tiles */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
           {[
             {
               icon: ShieldAlert,
               iconBg: "bg-slate-100 text-slate-700",
               label: "Total Indicators",
               value: stats.total,
               valueColor: "text-slate-900",
             },
             {
               icon: AlertCircle,
               iconBg: "bg-rose-50 text-rose-700",
               label: "Urgent (Critical)",
               value: stats.critical,
               valueColor: "text-rose-700",
             },
             {
               icon: AlertTriangle,
               iconBg: "bg-amber-50 text-amber-700",
               label: "Ambiguous",
               value: stats.ambiguous,
               valueColor: "text-amber-800",
             },
             {
               icon: CheckCircle2,
               iconBg: "bg-violet-50 text-violet-700",
               label: "Distress",
               value: stats.distress,
               valueColor: "text-violet-700",
             },
             {
               icon: Filter,
               iconBg: "bg-emerald-50 text-emerald-700",
               label: "Expression Filters",
               value: stats.filters,
               valueColor: "text-emerald-700",
             },
           ].map((stat) => {
             const Icon = stat.icon;
             return (
               <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                 <div className="mb-2 flex items-center gap-2">
                   <span className={"flex h-8 w-8 items-center justify-center rounded-xl " + stat.iconBg}>
                     <Icon className="h-4 w-4" />
                   </span>
                   <div className="text-xs font-semibold text-slate-600 truncate">{stat.label}</div>
                 </div>
                 <div className={"text-2xl font-bold " + stat.valueColor}>{stat.value}</div>
               </div>
             );
           })}
         </div>
 
        {/* Domain cards */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search phrases, variants, or notes..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 shadow-sm"
                  />
                </div>

                <div className="w-full sm:w-60">
                  <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 shadow-sm cursor-pointer"
                    aria-label="Filter by Clinical Category"
                  >
                    <option value="ALL">Filter: All Indicators</option>
                    {SAFETY_INDICATOR_DOMAINS.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.title}
                      </option>
                    ))}
                    <option value="LEGACY">Other / Legacy Indicators</option>
                    <option value="DISABLED">Disabled Indicators</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 hover:text-emerald-700 transition"
                  title="Counselor Guide & Clinical Instructions"
                >
                  <HelpCircle className="h-4 w-4 text-emerald-600" />
                  <span>Guide & Help</span>
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
                >
                  <Plus className="h-4 w-4" />
                  Add Indicator
                </button>
              </div>
            </div>
            
          </div>

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading safety risk indicators...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="px-6 py-3.5 font-semibold">Indicator Phrase</th>
                    <th className="px-6 py-3.5 font-semibold">Clinical Category</th>
                    <th className="px-6 py-3.5 font-semibold">Counselor Note / Context</th>
                    <th className="px-6 py-3.5 font-semibold">Status</th>
                    <th className="px-6 py-3.5 font-semibold">Updated</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredIndicators.length ? (
                    filteredIndicators.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          &quot;{item.phrase}&quot;
                        </td>
                        <td className="px-6 py-4">
                          <span className={"inline-flex rounded-full border px-3 py-0.5 text-xs font-semibold " + getIndicatorCategoryBadgeClasses(item.category)}>
                            {item.categoryLabel || getIndicatorCategoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                          {item.description || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => void handleToggle(item)}
                            className={"rounded-full border px-3 py-0.5 text-xs font-semibold transition " + (
                              item.isEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            )}
                          >
                            {item.isEnabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatDateTime(item.updatedAt || item.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openHistoryModal(item)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                              aria-label={"View history for " + item.phrase}
                              title="View Edit History"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition"
                              aria-label={"Edit " + item.phrase}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              aria-label={"Delete " + item.phrase}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                        No safety risk indicators matched the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add / Edit Indicator Modal */}
         <Modal
           isOpen={isFormOpen}
           onClose={() => {
             setEditingIndicator(null);
             setIsFormOpen(false);
             setFormState(DEFAULT_FORM);
           }}
           title={editingIndicator ? "Edit Safety Risk Indicator" : "Add Safety Risk Indicator"}
         >
           <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Indicator word or phrase</label>
              <input
                type="text"
                value={formState.phrase}
                onChange={(e) => setFormState((cur) => ({ ...cur, phrase: e.target.value }))}
                placeholder="example: hindi ko na kaya"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Tagalog &amp; English Variants / Synonyms
                </label>
                {!isEditingVariants ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingVariants(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit Variants</span>
                  </button>
                ) : null}
              </div>

              {!isEditingVariants ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 min-h-[50px]">
                  {(formState.variantsInput || "")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(formState.variantsInput || "")
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean)
                        .map((v, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 shadow-sm"
                          >
                            {v}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      No variants added yet. Click &quot;Edit Variants&quot; to add Tagalog/English equivalents.
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={formState.variantsInput || ""}
                    onChange={(e) => setFormState((cur) => ({ ...cur, variantsInput: e.target.value }))}
                    placeholder="e.g. ayoko nang mabuhay, ayoko na mabuhay, di ko na kaya"
                    className="w-full rounded-xl border border-emerald-500 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 shadow-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Enter comma-separated Tagalog/English colloquial spellings, contractions, or slang equivalents.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {editingIndicator ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormState((cur) => ({
                            ...cur,
                            variantsInput: Array.isArray(editingIndicator.variants) ? editingIndicator.variants.join(", ") : "",
                          }));
                          setIsEditingVariants(false);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition"
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsEditingVariants(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Variants</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
             <div className="space-y-1.5">
               <label className="text-sm font-medium text-slate-700">Clinical Category in Two-Phase Engine</label>
               <select
                 value={formState.category}
                 onChange={(e) => setFormState((cur) => ({ ...cur, category: e.target.value }))}
                 className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
               >
                 {Object.keys(SAFETY_INDICATOR_CATEGORIES).map((catKey) => (
                   <option key={catKey} value={catKey}>
                     {SAFETY_INDICATOR_CATEGORY_LABELS[catKey]}
                   </option>
                 ))}
               </select>
               <p className="text-xs text-slate-500 mt-1">
                 {SAFETY_INDICATOR_CATEGORY_DESCRIPTIONS[formState.category] || ""}
               </p>
             </div>
 
             <div className="space-y-1.5">
               <label className="text-sm font-medium text-slate-700">Counselor Note / Clinical Context (Optional)</label>
               <textarea
                 value={formState.description}
                 onChange={(e) => setFormState((cur) => ({ ...cur, description: e.target.value }))}
                 placeholder="Add context on why this indicator is tracked..."
                 rows={2}
                 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
               />
             </div>
 
             <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
               <span>
                 <span className="block text-sm font-semibold text-slate-800">Enabled</span>
                 <span className="block text-xs text-slate-500">
                   When enabled, this indicator actively participates in the Two-Phase Engine evaluation.
                 </span>
               </span>
               <input
                 type="checkbox"
                 checked={formState.isEnabled}
                 onChange={(e) => setFormState((cur) => ({ ...cur, isEnabled: e.target.checked }))}
                 className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
               />
             </label>
 
             <div className="flex justify-end gap-3 pt-2">
               <button
                 type="button"
                 onClick={() => {
                   setEditingIndicator(null);
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
                {isSaving ? "Saving..." : "Save Indicator"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Audit History Trail Modal */}
        <Modal
          isOpen={Boolean(historyTarget)}
          onClose={() => {
            setHistoryTarget(null);
            setHistoryLogs([]);
            setHistoryError("");
          }}
          title={"Audit History: \"" + (historyTarget?.phrase || "") + "\""}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Tracks creation, modifier details, and previous wording for clinical governance.
            </p>

            {isHistoryLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading audit history...</div>
            ) : historyError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {historyError}
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No previous log events recorded for this indicator yet.
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 pr-1">
                {historyLogs.map((log) => (
                  <div key={log.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{log.title}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{log.description}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>Updated by: <strong className="text-slate-700">{log.actorName || log.actorEmail || "System Admin"}</strong> ({log.actorRole || "Counselor"})</span>
                      {log.actorEmail ? <span>&bull; {log.actorEmail}</span> : null}
                    </div>
                    {log.metadata?.changes && Object.keys(log.metadata.changes).length > 0 ? (
                      <div className="mt-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 space-y-0.5 border border-slate-200/60">
                        {log.metadata.changes.fromPhrase ? (
                          <div><strong>Phrase changed:</strong> "{log.metadata.changes.fromPhrase}" &rarr; "{log.metadata.changes.toPhrase}"</div>
                        ) : null}
                        {log.metadata.changes.fromCategory ? (
                          <div><strong>Category changed:</strong> {getIndicatorCategoryLabel(log.metadata.changes.fromCategory)} &rarr; {getIndicatorCategoryLabel(log.metadata.changes.toCategory)}</div>
                        ) : null}
                        {log.metadata.changes.fromDescription !== undefined ? (
                          <div><strong>Note updated:</strong> "{log.metadata.changes.fromDescription || "(empty)"}" &rarr; "{log.metadata.changes.toDescription || "(empty)"}"</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>

        {/* Counselor Guide & Instructions Modal */}
        <Modal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          maxWidth="max-w-2xl"
          title="Counselor Guide: Two-Phase Risk Indicators & Safeguarding"
        >
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            {/* Overview Banner */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 space-y-1.5">
              <div className="font-semibold text-emerald-900 flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-emerald-700" />
                <span>How the Two-Phase Safety Workflow Works</span>
              </div>
              <p className="text-emerald-800 leading-normal">
                Bawat Tala uses a Two-Phase assessment so that students are not falsely frightened by sudden crisis screens when using metaphors, venting, or academic idioms.
              </p>
            </div>

            {/* PART 1: The 5 Core Two-Phase Risk Classification Tiers */}
            <div className="space-y-2.5">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span>1. Core Two-Phase Risk Classification Tiers</span>
                <span className="text-[10px] font-medium text-slate-400 capitalize">Engine Mechanics &amp; Safety Tiers</span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-rose-100 bg-rose-50/50 space-y-1">
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-100/70 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                    1. Urgent Intent (Critical)
                  </span>
                  <p className="text-slate-700 text-[11px]">
                    Direct, explicit statements of self-harm, suicide, or active crisis (e.g. <em>&quot;kill myself&quot;</em>, <em>&quot;magpakamatay&quot;</em>, <em>&quot;he hits me&quot;</em>). In <strong>Phase 1</strong>, Muni initiates gentle clarification to check immediate safety without triggering a sudden crisis popup.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/50 space-y-1">
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    2. Ambiguous Concern
                  </span>
                  <p className="text-slate-700 text-[11px]">
                    Passive ideation or polysemous language requiring context (e.g. <em>&quot;want to die&quot;</em>, <em>&quot;leak my photos&quot;</em>, <em>&quot;keep a secret from my parents&quot;</em>). The engine monitors this across conversation history to detect escalation or recurring distress.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-violet-100 bg-violet-50/50 space-y-1">
                  <span className="inline-flex rounded-full border border-violet-200 bg-violet-100/70 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                    3. Emotional Distress
                  </span>
                  <p className="text-slate-700 text-[11px]">
                    Severe burnout, school pressure, overwhelm, or sadness (e.g. <em>&quot;overwhelmed&quot;</em>, <em>&quot;burned out&quot;</em>, <em>&quot;di ko na kaya&quot;</em>). Flags the entry as <strong>Emotional Distress</strong> without treating it as an emergency crisis.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-1">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100/70 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    4. Expression &amp; Hyperbole Filter
                  </span>
                  <p className="text-slate-700 text-[11px]">
                    Idioms, humor, venting, and Tagalog colloquialisms (e.g. <em>&quot;thesis is killing me&quot;</em>, <em>&quot;joke lang&quot;</em>, <em>&quot;just venting&quot;</em>). In <strong>Phase 2</strong>, if the student replies with any of these, the critical alarm is <strong>CLEARED</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-sky-100 bg-sky-50/50 space-y-1">
                  <span className="inline-flex rounded-full border border-sky-200 bg-sky-100/70 px-2.5 py-0.5 text-[10px] font-bold text-sky-800">
                    5. Confirmation Signals
                  </span>
                  <p className="text-slate-700 text-[11px]">
                    Phrases where the student affirms literal intent during clarification (e.g. <em>&quot;yes I mean it&quot;</em>, <em>&quot;I have a plan&quot;</em>, <em>&quot;totoo po&quot;</em>). Only then does the engine escalate to <strong>Urgent</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* PART 2: Specific Safeguarding Domains */}
            <div className="space-y-2.5 pt-1">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span>2. Safeguarding Domains (Clinical Scenarios)</span>
                <span className="text-[10px] font-medium text-slate-400 capitalize">Incident Categorization</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Phrases are organized into 8 domain cards. Domain 1 stays one card with four separate sub-indicator editors (not four top-level cards). Counselors add wording in CMS — nothing is hardcoded in the app.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-purple-100 bg-purple-50/40 space-y-1 md:col-span-2">
                  <span className="font-bold text-purple-800 text-[11px]">1. Grooming, Power Imbalance &amp; Boundary Concerns</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Authority-figure boundary violations, demands for secrecy (&quot;keep our chat secret&quot;), inappropriate gifts or special favors, and private meetup pressure across 4 dedicated sub-indicator lists.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/40 space-y-1">
                  <span className="font-bold text-fuchsia-800 text-[11px]">2. AI Attachment &amp; Parasocial</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Romantic or physical attachment directed toward Muni (e.g. asking to date, be partners, or sleep together), isolating the student from real-world human support.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-red-100 bg-red-50/40 space-y-1">
                  <span className="font-bold text-red-800 text-[11px]">3. Coercion, Blackmail &amp; Extortion</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Image-based sexual abuse (threats to leak photos or chats), financial extortion, or demanding favors under duress, fear, or manipulation.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-1">
                  <span className="font-bold text-indigo-800 text-[11px]">4. Bullying &amp; Harassment</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Chronic peer harassment, malicious social exclusion, targeted cyberbullying, public humiliation, or group intimidation.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-orange-100 bg-orange-50/40 space-y-1">
                  <span className="font-bold text-orange-800 text-[11px]">5. Abuse &amp; Domestic Harm</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Physical battery, ongoing domestic violence, hostile family environments, or severe emotional/verbal abuse in home or relationship settings.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-rose-100 bg-rose-50/40 space-y-1">
                  <span className="font-bold text-rose-900 text-[11px]">6. Threats &amp; Violence</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Direct or credible threats of physical violence, weapons, or bodily harm directed from or toward another individual.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/40 space-y-1">
                  <span className="font-bold text-amber-800 text-[11px]">7. Unsafe Environment &amp; Neglect</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Hostile living conditions, sudden eviction, homelessness, lack of shelter/safety, or severe physical/care neglect.
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-yellow-100 bg-yellow-50/40 space-y-1">
                  <span className="font-bold text-yellow-800 text-[11px]">8. Substance &amp; Addiction</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Forced intoxication, drink spiking, accidental or intentional prescription overdose, and severe substance dependency crises.
                  </p>
                </div>
              </div>
            </div>

            {/* PART 3: Best Practices */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="font-semibold text-slate-800 text-xs">Best Practices for Counselors:</div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                <li>
                  <strong>Avoid duplicate rows:</strong> Use the <em>Variants / Synonyms</em> field inside an indicator to group Tagalog contractions (<em>ayaw ko</em> vs <em>ayoko</em>) or English translations instead of creating new separate rows.
                </li>
                <li>
                  <strong>Keep phrases lowercase:</strong> The engine automatically matches phrases case-insensitively.
                </li>
                <li>
                  <strong>Check edit history:</strong> Click the clock icon next to any indicator to view who modified it, when, and what changed.
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm transition"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
         <ConfirmActionModal
           isOpen={Boolean(deleteTarget)}
           onClose={() => setDeleteTarget(null)}
           onConfirm={() => void handleDelete()}
           title="Delete Safety Risk Indicator"
           description={"Remove \"" + (deleteTarget?.phrase || "this indicator") + "\" from the active safety dictionary?"}
           cancelLabel="Keep Indicator"
           confirmLabel="Delete Indicator"
           confirmTone="rose"
         />
       </div>
     </Layout>
   );
 }

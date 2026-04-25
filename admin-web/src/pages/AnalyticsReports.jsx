import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { fetchAdminAnalytics } from "../lib/admin-api";

const RANGE_OPTIONS = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

function formatDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildAnalyticsCsv(analytics) {
  const lines = [];

  lines.push("Analytics Cards");
  lines.push("Metric,Value,Delta");
  for (const [key, card] of Object.entries(analytics?.cards || {})) {
    const delta =
      key === "averageEntriesPerStudent"
        ? `${Number(card.deltaValue || 0) >= 0 ? "+" : ""}${formatDecimal(card.deltaValue || 0)}`
        : card.percentageText || "0%";
    lines.push([escapeCsv(card.label), escapeCsv(card.value), escapeCsv(delta)].join(","));
  }

  lines.push("");
  lines.push("Journal Entry Volume");
  lines.push("Date,Entries");
  for (const item of analytics?.charts?.journalEntryVolume || []) {
    lines.push([escapeCsv(item.label), escapeCsv(item.value)].join(","));
  }

  lines.push("");
  lines.push("Concern Trends");
  lines.push("Concern," + (analytics?.charts?.concernTrends?.labels || []).map(escapeCsv).join(","));
  for (const series of analytics?.charts?.concernTrends?.series || []) {
    lines.push([escapeCsv(series.label), ...(series.values || []).map(escapeCsv)].join(","));
  }

  lines.push("");
  lines.push("Counselor Workload");
  lines.push("Counselor,Role,Cases");
  for (const item of analytics?.charts?.counselorWorkload || []) {
    lines.push([escapeCsv(item.label), escapeCsv(item.role), escapeCsv(item.value)].join(","));
  }

  lines.push("");
  lines.push("At-Risk Student Trends");
  lines.push("Series," + (analytics?.charts?.atRiskStudentTrends?.labels || []).map(escapeCsv).join(","));
  for (const series of analytics?.charts?.atRiskStudentTrends?.series || []) {
    lines.push([escapeCsv(series.label), ...(series.values || []).map(escapeCsv)].join(","));
  }

  lines.push("");
  lines.push("Resolution Rates");
  lines.push("Category,Percentage,Target");
  for (const item of analytics?.charts?.resolutionRates || []) {
    lines.push([escapeCsv(item.label), escapeCsv(item.value), escapeCsv(item.targetLabel)].join(","));
  }

  return lines.join("\n");
}

export default function AnalyticsReports({ onLogout, session }) {
  const today = new Date().toISOString().slice(0, 10);
  const [rangeKey, setRangeKey] = useState("30d");
  const [customRange, setCustomRange] = useState({ startDate: today, endDate: today });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  async function loadAnalytics(nextRangeKey = rangeKey, nextCustomRange = customRange) {
    try {
      setLoading(true);
      const data = await fetchAdminAnalytics({
        range: nextRangeKey,
        startDate: nextRangeKey === "custom" ? nextCustomRange.startDate : undefined,
        endDate: nextRangeKey === "custom" ? nextCustomRange.endDate : undefined,
      });
      setAnalytics(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  function handleRangeChange(nextRangeKey) {
    setRangeKey(nextRangeKey);
    void loadAnalytics(nextRangeKey, customRange);
  }

  function handleCustomApply() {
    void loadAnalytics("custom", customRange);
  }

  function handleExportCsv() {
    downloadFile(
      `analytics-report-${analytics?.filters?.startDate || today}-to-${analytics?.filters?.endDate || today}.csv`,
      buildAnalyticsCsv(analytics || {}),
      "text/csv;charset=utf-8;",
    );
    setIsExportModalOpen(false);
  }

  function handleExportJson() {
    downloadFile(
      `analytics-report-${analytics?.filters?.startDate || today}-to-${analytics?.filters?.endDate || today}.json`,
      JSON.stringify(analytics || {}, null, 2),
      "application/json;charset=utf-8;",
    );
    setIsExportModalOpen(false);
  }

  return (
    <Layout title="Analytics & Reports" subtitle="Deep dive into student wellbeing metrics and system usage." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleRangeChange(option.key)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  rangeKey === option.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {rangeKey === "custom" ? (
              <>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleCustomApply}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Apply
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              disabled={loading || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Download Report
            </button>
          </div>
        </div>

        <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Download Report">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Download the current analytics view for {analytics?.filters?.startDate || "--"} to {analytics?.filters?.endDate || "--"}.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Export JSON
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}

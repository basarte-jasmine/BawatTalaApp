import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import Layout from "../components/Layout";
import { fetchAdminAnalytics } from "../lib/admin-api";

const RANGE_OPTIONS = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function formatMetricValue(key, value) {
  return key === "averageEntriesPerStudent" ? formatDecimal(value) : formatNumber(value);
}

function formatMetricDelta(key, card) {
  if (key === "averageEntriesPerStudent") {
    const delta = Number(card?.deltaValue || 0);
    return `${delta >= 0 ? "+" : ""}${formatDecimal(delta)}`;
  }
  return card?.percentageText || "0%";
}

function buildReportSections(analytics) {
  const cards = analytics?.cards || {};
  const charts = analytics?.charts || {};
  const concernLabels = charts.concernTrends?.labels || [];
  const riskLabels = charts.atRiskStudentTrends?.labels || [];

  return [
    {
      id: "summary",
      title: "Summary Metrics",
      description: "High-level counts for the selected report range.",
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value", align: "right" },
        { key: "change", label: "Change" },
        { key: "notes", label: "Notes" },
      ],
      rows: Object.entries(cards).map(([key, card]) => ({
        metric: card.label || key,
        value: formatMetricValue(key, card.value),
        change: formatMetricDelta(key, card),
        notes: key === "averageEntriesPerStudent" ? "Average uses total students as denominator." : "Aggregate value only.",
      })),
    },
    {
      id: "entry-volume",
      title: "Journal Entry Counts",
      description: "Daily entry totals only. Journal text, messages, and AI insights are excluded.",
      columns: [
        { key: "date", label: "Date" },
        { key: "entries", label: "Number of Entries", align: "right" },
      ],
      rows: (charts.journalEntryVolume || []).map((item) => ({
        date: item.isoDate || item.label,
        entries: formatNumber(item.value),
      })),
    },
    {
      id: "concerns",
      title: "Concern Trend Counts",
      description: "Primary concern totals by report period.",
      columns: [
        { key: "period", label: "Period" },
        { key: "concern", label: "Concern" },
        { key: "count", label: "Count", align: "right" },
      ],
      rows: (charts.concernTrends?.series || []).flatMap((series) =>
        (series.values || []).map((value, index) => ({
          period: concernLabels[index] || `Period ${index + 1}`,
          concern: series.label,
          count: formatNumber(value),
        })),
      ),
    },
    {
      id: "workload",
      title: "Counselor Workload",
      description: "Confirmed and completed counseling sessions assigned per counselor.",
      columns: [
        { key: "counselor", label: "Counselor" },
        { key: "role", label: "Role" },
        { key: "cases", label: "Cases", align: "right" },
      ],
      rows: (charts.counselorWorkload || []).map((item) => ({
        counselor: item.label,
        role: item.role || "Counselor",
        cases: formatNumber(item.value),
      })),
    },
    {
      id: "risk",
      title: "Risk Flag Counts",
      description: "High and critical risk counts only. Entry content is not included.",
      columns: [
        { key: "period", label: "Period" },
        { key: "riskLevel", label: "Risk Level" },
        { key: "flags", label: "Number of Flags", align: "right" },
      ],
      rows: (charts.atRiskStudentTrends?.series || []).flatMap((series) =>
        (series.values || []).map((value, index) => ({
          period: riskLabels[index] || `W${index + 1}`,
          riskLevel: series.label,
          flags: formatNumber(value),
        })),
      ),
    },
    {
      id: "response",
      title: "Response Time Compliance",
      description: "Share of flagged cases that received a counselor response within target time.",
      columns: [
        { key: "category", label: "Category" },
        { key: "target", label: "Target" },
        { key: "rate", label: "Within Target", align: "right" },
      ],
      rows: (charts.resolutionRates || []).map((item) => ({
        category: item.label,
        target: item.targetLabel,
        rate: `${formatNumber(item.value)}%`,
      })),
    },
  ];
}

function buildReportCsv(sections) {
  const lines = [];

  for (const section of sections) {
    lines.push(section.title);
    lines.push(section.columns.map((column) => escapeCsv(column.label)).join(","));
    for (const row of section.rows) {
      lines.push(section.columns.map((column) => escapeCsv(row[column.key])).join(","));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildPrintHtml({ sections, title, subtitle, filters }) {
  const tableMarkup = sections
    .map(
      (section) => `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.description)}</p>
          <table>
            <thead>
              <tr>${section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${
                section.rows.length
                  ? section.rows
                      .map(
                        (row) =>
                          `<tr>${section.columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`,
                      )
                      .join("")
                  : `<tr><td colspan="${section.columns.length}">No rows available for this filter.</td></tr>`
              }
            </tbody>
          </table>
        </section>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #14213d; margin: 32px; }
          h1 { margin: 0; font-size: 26px; }
          h2 { margin: 28px 0 4px; font-size: 18px; color: #134611; }
          p { margin: 0 0 12px; color: #52616b; font-size: 12px; }
          .meta { margin: 10px 0 18px; font-size: 12px; color: #52616b; }
          .privacy { margin: 18px 0; padding: 10px 12px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          th, td { border: 1px solid #d7dee8; padding: 8px; font-size: 11px; text-align: left; vertical-align: top; }
          th { background: #edf6e9; color: #134611; font-weight: 700; }
          tr { page-break-inside: avoid; }
          @page { margin: 18mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">${escapeHtml(subtitle)}<br/>Range: ${escapeHtml(filters?.startDate || "--")} to ${escapeHtml(filters?.endDate || "--")}</div>
        <div class="privacy">This report excludes journal messages, entry text, private notes, and generated insights. It contains only administrative counts and labels.</div>
        ${tableMarkup}
      </body>
    </html>
  `;
}

function ReportTable({ section, loading }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{section.description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {section.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-5 py-3 font-semibold text-slate-600 ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={section.columns.length} className="px-5 py-8 text-center text-slate-500">
                  Loading report rows...
                </td>
              </tr>
            ) : section.rows.length ? (
              section.rows.map((row, index) => (
                <tr key={`${section.id}-${index}`} className="hover:bg-slate-50/80">
                  {section.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-5 py-3 text-slate-700 ${
                        column.align === "right" ? "text-right font-semibold text-slate-900" : ""
                      }`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={section.columns.length} className="px-5 py-8 text-center text-slate-500">
                  No rows available for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AnalyticsReports({ onLogout, session }) {
  const today = new Date().toISOString().slice(0, 10);
  const [rangeKey, setRangeKey] = useState("30d");
  const [customRange, setCustomRange] = useState({ startDate: today, endDate: today });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const reportSections = useMemo(() => buildReportSections(analytics), [analytics]);
  const reportTitle = "Bawat Tala Admin Report";
  const reportSubtitle = "Filtered administrative report tables";

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
      setErrorMessage(error instanceof Error ? error.message : "Failed to load reports.");
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
      `admin-report-${analytics?.filters?.startDate || today}-to-${analytics?.filters?.endDate || today}.csv`,
      buildReportCsv(reportSections),
      "text/csv;charset=utf-8;",
    );
  }

  function handlePrintReport() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      buildPrintHtml({
        sections: reportSections,
        title: reportTitle,
        subtitle: reportSubtitle,
        filters: analytics?.filters,
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <Layout
      title="Reports"
      subtitle="Generate filtered tables without journal text, messages, or private insights."
      onLogout={onLogout}
      session={session}
    >
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
              onClick={handleExportCsv}
              disabled={loading || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              disabled={loading || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
          Report rows include administrative counts, dates, labels, workload, risk totals, and response-time percentages only.
          Journal messages, entry text, student-written content, and generated insights are intentionally excluded.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-slate-500">Report Range</div>
              <div className="mt-1 font-semibold text-slate-900">
                {analytics?.filters?.startDate || "--"} to {analytics?.filters?.endDate || "--"}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Generated Sections</div>
              <div className="mt-1 font-semibold text-slate-900">{reportSections.length} tables</div>
            </div>
            <div>
              <div className="text-slate-500">Privacy Scope</div>
              <div className="mt-1 font-semibold text-slate-900">Counts and labels only</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {reportSections.map((section) => (
            <ReportTable key={section.id} section={section} loading={loading} />
          ))}
        </div>
      </div>
    </Layout>
  );
}

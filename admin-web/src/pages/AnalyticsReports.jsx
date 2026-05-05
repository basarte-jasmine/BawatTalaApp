import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import Layout from "../components/Layout";
import { fetchAdminAnalytics } from "../lib/admin-api";
import { getRiskLevelLabel } from "../lib/risk-labels";

const RANGE_OPTIONS = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

const REPORT_COLUMNS = [
  { key: "studentNumber", label: "Student No." },
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "program", label: "Program" },
  { key: "yearLevel", label: "Year Level" },
  { key: "gender", label: "Gender" },
  { key: "barangay", label: "Barangay" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "entriesInRange", label: "Entries", align: "right" },
  { key: "flagsInRange", label: "Flags", align: "right" },
  { key: "highRiskFlags", label: "Crisis / Critical Need", align: "right" },
  { key: "mediumRiskFlags", label: "Distressed / Needs Support", align: "right" },
  { key: "declinedSupport", label: "Declined Support", align: "right" },
  { key: "contactedSupport", label: "Contacted", align: "right" },
  { key: "counselingSessions", label: "Sessions", align: "right" },
  { key: "topConcern", label: "Top Concern" },
  { key: "latestRiskLevel", label: "Latest Risk" },
  { key: "lastEntryDate", label: "Last Entry" },
  { key: "reportStatus", label: "Status" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
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

function formatCellValue(row, column) {
  const value = row?.[column.key];
  if (column.align === "right") return formatNumber(value);
  if (column.key === "latestRiskLevel") return getRiskLevelLabel(value);
  return value || "";
}

function buildStudentReportCsv(rows) {
  const lines = [REPORT_COLUMNS.map((column) => escapeCsv(column.label)).join(",")];
  for (const row of rows) {
    lines.push(REPORT_COLUMNS.map((column) => escapeCsv(formatCellValue(row, column))).join(","));
  }
  return lines.join("\n");
}

function buildPrintHtml({ rows, filters }) {
  const tableRows = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              ${REPORT_COLUMNS.map((column) => `<td>${escapeHtml(formatCellValue(row, column))}</td>`).join("")}
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="${REPORT_COLUMNS.length}">No student rows available for this filter.</td></tr>`;

  return `
    <!doctype html>
    <html>
      <head>
        <title>Bawat Tala Student Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #14213d; margin: 24px; }
          h1 { margin: 0; font-size: 24px; }
          .meta { margin: 8px 0 14px; font-size: 12px; color: #52616b; }
          .privacy { margin: 14px 0; padding: 10px 12px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          th, td { border: 1px solid #d7dee8; padding: 6px; font-size: 9px; text-align: left; vertical-align: top; }
          th { background: #edf6e9; color: #134611; font-weight: 700; }
          tr { page-break-inside: avoid; }
          @page { margin: 12mm; size: landscape; }
        </style>
      </head>
      <body>
        <h1>Bawat Tala Student Report</h1>
        <div class="meta">Range: ${escapeHtml(filters?.startDate || "--")} to ${escapeHtml(filters?.endDate || "--")}</div>
        <div class="privacy">Student users only. Journal messages, entry text, private notes, generated insights, admin accounts, and counselor names are excluded.</div>
        <table>
          <thead>
            <tr>${REPORT_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function StudentReportTable({ rows, loading }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Student User Report</h3>
        <p className="mt-1 text-sm text-slate-500">
          One row per student user. This table excludes journal content, insights, admin users, and counselor names.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[2100px] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {REPORT_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 font-semibold text-slate-600 ${
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
                <td colSpan={REPORT_COLUMNS.length} className="px-5 py-10 text-center text-slate-500">
                  Loading student report...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.studentNumber} className="hover:bg-slate-50/80">
                  {REPORT_COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-4 py-3 text-slate-700 ${
                        column.align === "right" ? "text-right font-semibold text-slate-900" : ""
                      }`}
                    >
                      {formatCellValue(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={REPORT_COLUMNS.length} className="px-5 py-10 text-center text-slate-500">
                  No student rows available for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsReports({ onLogout, session }) {
  const today = new Date().toISOString().slice(0, 10);
  const [rangeKey, setRangeKey] = useState("30d");
  const [customRange, setCustomRange] = useState({ startDate: today, endDate: today });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const studentRows = useMemo(
    () => (Array.isArray(analytics?.reports?.students) ? analytics.reports.students : []),
    [analytics],
  );
  const totals = useMemo(
    () =>
      studentRows.reduce(
        (acc, row) => ({
          entries: acc.entries + Number(row.entriesInRange || 0),
          flags: acc.flags + Number(row.flagsInRange || 0),
          sessions: acc.sessions + Number(row.counselingSessions || 0),
        }),
        { entries: 0, flags: 0, sessions: 0 },
      ),
    [studentRows],
  );

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
      `student-report-${analytics?.filters?.startDate || today}-to-${analytics?.filters?.endDate || today}.csv`,
      buildStudentReportCsv(studentRows),
      "text/csv;charset=utf-8;",
    );
  }

  function handlePrintReport() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildPrintHtml({ rows: studentRows, filters: analytics?.filters }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <Layout
      title="Reports"
      subtitle="Generate one student-user report table without journal text, messages, or private insights."
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
          This report contains student users only. It includes profile fields and filtered activity counts, but excludes journal
          messages, entry text, private notes, generated insights, admin accounts, and counselor names.
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Report Range</div>
            <div className="mt-1 font-semibold text-slate-900">
              {analytics?.filters?.startDate || "--"} to {analytics?.filters?.endDate || "--"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Student Rows</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(studentRows.length)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Entries in Range</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(totals.entries)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Flags in Range</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(totals.flags)}</div>
          </div>
        </div>

        <StudentReportTable rows={studentRows} loading={loading} />
      </div>
    </Layout>
  );
}

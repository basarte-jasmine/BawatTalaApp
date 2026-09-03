import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
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

function downloadFile(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
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

function escapePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/[\\()]/g, "\\$&")
    .replace(/\s+/g, " ")
    .trim();
}

function truncatePdfText(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function createStudentReportPdf({ rows, filters }) {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 36;
  const bottomMargin = 30;
  const pages = [];
  let commands = [];
  let y = pageHeight - margin;

  const addText = (text, x = margin, size = 9, bold = false) => {
    commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  };
  const addRule = (offset = 7) => {
    commands.push(`0.82 0.87 0.84 RG 0.7 w ${margin} ${(y - offset).toFixed(2)} m ${pageWidth - margin} ${(y - offset).toFixed(2)} l S`);
  };
  const beginPage = () => {
    commands = [];
    pages.push(commands);
    y = pageHeight - margin;
    addText("Bawat Tala Student User Report", margin, 18, true);
    y -= 22;
    addText(`Report range: ${filters?.startDate || "--"} to ${filters?.endDate || "--"}`, margin, 10, true);
    y -= 16;
    addText(
      "Student users only. Journal text, messages, private notes, generated insights, admin accounts, and counselor names are excluded.",
      margin,
      8,
    );
    y -= 17;
    addRule(0);
    y -= 18;
  };
  const ensureSpace = (requiredHeight) => {
    if (y - requiredHeight < bottomMargin) beginPage();
  };

  beginPage();

  if (!rows.length) {
    addText("No student rows are available for this filter.", margin, 11);
  }

  rows.forEach((row, index) => {
    ensureSpace(82);
    addText(
      `${index + 1}. ${truncatePdfText(row.fullName || "Unnamed student", 64)} (${truncatePdfText(row.studentNumber || "No student number", 24)})`,
      margin,
      11,
      true,
    );
    y -= 16;
    addText(
      `Email: ${truncatePdfText(row.email || "--", 44)}   |   Program: ${truncatePdfText(row.program || "--", 34)}   |   Year: ${row.yearLevel || "--"}   |   Gender: ${row.gender || "--"}`,
      margin + 10,
      8.5,
    );
    y -= 14;
    addText(
      `Location: ${truncatePdfText([row.barangay, row.city, row.province].filter(Boolean).join(", ") || "--", 116)}`,
      margin + 10,
      8.5,
    );
    y -= 14;
    addText(
      `Entries: ${formatNumber(row.entriesInRange)}   |   Flags: ${formatNumber(row.flagsInRange)}   |   Crisis: ${formatNumber(row.highRiskFlags)}   |   Distressed: ${formatNumber(row.mediumRiskFlags)}   |   Declined: ${formatNumber(row.declinedSupport)}   |   Contacted: ${formatNumber(row.contactedSupport)}   |   Sessions: ${formatNumber(row.counselingSessions)}`,
      margin + 10,
      8.5,
    );
    y -= 14;
    addText(
      `Top concern: ${truncatePdfText(row.topConcern || "--", 44)}   |   Latest risk: ${getRiskLevelLabel(row.latestRiskLevel)}   |   Status: ${row.reportStatus || "--"}`,
      margin + 10,
      8.5,
    );
    y -= 14;
    addRule(0);
    y -= 14;
  });

  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let byteOffset = 0;
  const appendString = (value) => {
    const bytes = encoder.encode(value);
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const appendObject = (id, content) => {
    offsets[id] = byteOffset;
    appendString(`${id} 0 obj\n${content}\nendobj\n`);
  };

  appendString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = pages.map((_, index) => 5 + index * 2);
  appendObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  appendObject(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  appendObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  appendObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((pageCommands, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const content = pageCommands.join("\n");
    appendObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    appendObject(contentId, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  });

  const xrefOffset = byteOffset;
  const maxObjectId = 4 + pages.length * 2;
  appendString(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxObjectId; id += 1) {
    appendString(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  appendString(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(parts, { type: "application/pdf" });
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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

  async function getAnalyticsForCurrentFilters() {
    if (rangeKey !== "custom") return analytics;

    const currentStartDate = analytics?.filters?.startDate || "";
    const currentEndDate = analytics?.filters?.endDate || "";
    if (currentStartDate === customRange.startDate && currentEndDate === customRange.endDate) {
      return analytics;
    }

    const data = await fetchAdminAnalytics({
      range: "custom",
      startDate: customRange.startDate,
      endDate: customRange.endDate,
    });
    setAnalytics(data);
    return data;
  }

  async function handleExportCsv() {
    try {
      setLoading(true);
      const currentAnalytics = await getAnalyticsForCurrentFilters();
      const rows = Array.isArray(currentAnalytics?.reports?.students) ? currentAnalytics.reports.students : [];
      const filters = currentAnalytics?.filters || {};
      setErrorMessage("");
      downloadFile(
        `student-report-${filters.startDate || today}-to-${filters.endDate || today}.csv`,
        buildStudentReportCsv(rows),
        "text/csv;charset=utf-8;",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export CSV.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
    try {
      setIsExportingPdf(true);
      const currentAnalytics = await getAnalyticsForCurrentFilters();
      const rows = Array.isArray(currentAnalytics?.reports?.students) ? currentAnalytics.reports.students : [];
      const filters = currentAnalytics?.filters || {};
      setErrorMessage("");
      const pdf = createStudentReportPdf({ rows, filters });
      downloadFile(
        `student-report-${filters.startDate || today}-to-${filters.endDate || today}.pdf`,
        pdf,
        "application/pdf",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  function handleCustomDateChange(field, value) {
    setCustomRange((current) => ({ ...current, [field]: value }));
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
                  onChange={(event) => handleCustomDateChange("startDate", event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => handleCustomDateChange("endDate", event.target.value)}
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
              onClick={handleExportPdf}
              disabled={loading || isExportingPdf || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExportingPdf ? "Exporting..." : "Export PDF"}
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

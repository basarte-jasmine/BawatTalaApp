import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import Layout from "../components/Layout";
import StudentAvatar from "../components/StudentAvatar";
import { fetchAdminAnalytics } from "../lib/admin-api";
import { getRiskBadgeClasses, getRiskLevelLabel, normalizeRiskLevel } from "../lib/risk-labels";

const RANGE_OPTIONS = [
  { key: "all", label: "All" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

/** Flat columns kept for CSV export contract (Frontend may extend metadata). */
const REPORT_COLUMNS = [
  { key: "studentNumber", label: "Student No." },
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "program", label: "Program" },
  { key: "gender", label: "Gender" },
  { key: "barangay", label: "Barangay" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "entriesInRange", label: "Entries", align: "right" },
  { key: "flagsInRange", label: "Flags", align: "right" },
  { key: "highRiskFlags", label: "Crisis / Critical Need", align: "right" },
  // Distressed / Needs Support = LOW only (backend mediumRiskFlags / distressedFlags).
  { key: "distressedFlags", label: "Distressed / Needs Support", align: "right" },
  { key: "declinedSupport", label: "Declined Support", align: "right" },
  { key: "contactedSupport", label: "Contacted", align: "right" },
  { key: "counselingSessions", label: "Sessions", align: "right" },
  { key: "topConcern", label: "Top Concern" },
  { key: "latestRiskLevel", label: "Highest Risk" },
  { key: "reportStatus", label: "Status" },
];

function getManilaTodayIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function getManilaDateTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatCountOrDash(value) {
  const number = Number(value || 0);
  return number === 0 ? "—" : formatNumber(number);
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

function getDistressedCount(row) {
  if (row?.distressedFlags != null) return Number(row.distressedFlags || 0);
  if (row?.lowRiskFlags != null) return Number(row.lowRiskFlags || 0);
  return Number(row?.mediumRiskFlags || 0);
}


function formatLocation(row) {
  const parts = [row?.barangay, row?.city, row?.province]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function getShortRiskLabel(value) {
  const risk = normalizeRiskLevel(value);
  if (risk === "HIGH" || risk === "CRITICAL") return "Crisis";
  if (risk === "LOW" || risk === "MEDIUM" || risk === "MODERATE") return "Distressed";
  return "None";
}


function isFlaggedOrAtRisk(row) {
  const flags = Number(row?.flagsInRange || 0);
  const crisis = Number(row?.highRiskFlags || 0);
  const distressed = getDistressedCount(row);
  return flags > 0 || crisis > 0 || distressed > 0;
}

function getRowRiskCategory(row) {
  const level = normalizeRiskLevel(row?.highestRiskLevel ?? row?.latestRiskLevel);
  if (level === "HIGH" || level === "CRITICAL") return "crisis";
  if (level === "LOW") return "distressed";
  // Fallback when level is missing/NONE: use flag counts (HIGH/LOW/NONE only).
  if (Number(row?.highRiskFlags || 0) > 0) return "crisis";
  if (getDistressedCount(row) > 0) return "distressed";
  return "none";
}

function applyClientFilters(rows, { flaggedOnly, programFilter, riskLevelFilter }) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (flaggedOnly && !isFlaggedOrAtRisk(row)) return false;
    if (programFilter) {
      const program = String(row?.program || "").trim();
      if (program !== programFilter) return false;
    }
    if (riskLevelFilter && riskLevelFilter !== "all") {
      if (getRowRiskCategory(row) !== riskLevelFilter) return false;
    }
    return true;
  });
}

function getStatusPillClasses(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized.includes("flag")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (normalized.includes("active") || normalized.includes("entry")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("no ") || normalized.includes("inactive") || !normalized) {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatCellValue(row, column) {
  if (column.key === "distressedFlags") return formatNumber(getDistressedCount(row));
  const value = row?.[column.key];
  if (column.align === "right") return formatNumber(value);
  if (column.key === "latestRiskLevel") return getRiskLevelLabel(value);
  return value || "";
}

function buildStudentReportCsv(rows, filters = {}) {
  const startDate = filters?.startDate || "--";
  const endDate = filters?.endDate || "--";
  const lines = [
    "# Bawat Tala Guidance Analytics Report",
    `# Date Range: ${startDate} to ${endDate}`,
    `# Generated On: ${getManilaDateTimeLabel()}`,
    REPORT_COLUMNS.map((column) => escapeCsv(column.label)).join(","),
  ];
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

function createStudentReportPdf({ rows, filters, summary }) {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 28;
  const bottomMargin = 42;
  const contentWidth = pageWidth - margin * 2;
  const pages = [];
  let commands = [];
  let y = pageHeight - margin;
  const generatedAt = getManilaDateTimeLabel();
  const startDate = filters?.startDate || "--";
  const endDate = filters?.endDate || "--";
  const metrics = {
    students: Number(summary?.students ?? rows.length ?? 0),
    entries: Number(summary?.entries ?? 0),
    flags: Number(summary?.flags ?? 0),
    sessions: Number(summary?.sessions ?? 0),
    crisisFlags: Number(
      summary?.crisisFlags ??
        rows.reduce((acc, row) => acc + Number(row.highRiskFlags || 0), 0),
    ),
  };

  const pdfColumns = [
    { key: "identity", label: "Student", width: 150, align: "left" },
    { key: "program", label: "Program", width: 95, align: "left" },
    { key: "location", label: "Location", width: 110, align: "left" },
    { key: "entriesInRange", label: "Entries", width: 42, align: "right" },
    { key: "flagsInRange", label: "Flags", width: 38, align: "right" },
    { key: "highRiskFlags", label: "Crisis", width: 40, align: "right", accent: true },
    { key: "distressedFlags", label: "Distress", width: 46, align: "right" },
    { key: "counselingSessions", label: "Sess.", width: 36, align: "right" },
    { key: "topConcern", label: "Top Concern", width: 90, align: "left" },
    { key: "latestRiskLevel", label: "Risk", width: 54, align: "left" },
    { key: "reportStatus", label: "Status", width: 85, align: "left" },
  ];

  const setStroke = (r, g, b, width = 0.6) => {
    commands.push(`${r} ${g} ${b} RG ${width} w`);
  };
  const setFill = (r, g, b) => {
    commands.push(`${r} ${g} ${b} rg`);
  };
  const fillRect = (x, rectY, w, h) => {
    commands.push(`${x.toFixed(2)} ${rectY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };
  const strokeRect = (x, rectY, w, h) => {
    commands.push(`${x.toFixed(2)} ${rectY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  };
  const addTextAt = (text, x, textY, size = 9, bold = false, color = null) => {
    if (color) {
      commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
    } else {
      commands.push("0.08 0.1 0.14 rg");
    }
    commands.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${textY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`,
    );
  };

  const drawHeaderBand = () => {
    setFill(0.98, 0.95, 0.96);
    fillRect(margin, pageHeight - margin - 54, contentWidth, 54);
    setStroke(0.88, 0.3, 0.4, 1.4);
    commands.push(
      `${margin.toFixed(2)} ${(pageHeight - margin - 54).toFixed(2)} m ${(margin + contentWidth).toFixed(2)} ${(pageHeight - margin - 54).toFixed(2)} l S`,
    );
    addTextAt("BAWAT TALA", margin + 10, pageHeight - margin - 18, 16, true, [0.55, 0.12, 0.22]);
    addTextAt("Guidance & Counseling Analytics Report", margin + 10, pageHeight - margin - 34, 10, true);
    addTextAt(`Generated: ${generatedAt} (Asia/Manila)`, margin + 10, pageHeight - margin - 48, 8, false, [
      0.35,
      0.38,
      0.42,
    ]);
    addTextAt(`Date range: ${startDate} to ${endDate}`, margin + 320, pageHeight - margin - 48, 8, false, [
      0.35,
      0.38,
      0.42,
    ]);
    y = pageHeight - margin - 68;
  };

  const drawKeyMetrics = () => {
    const cardW = (contentWidth - 18) / 4;
    const cardH = 46;
    const items = [
      { label: "Total Active Students", value: formatNumber(metrics.students) },
      { label: "Total Journal Entries", value: formatNumber(metrics.entries) },
      { label: "Flags Raised", value: formatNumber(metrics.flags), rose: metrics.flags > 0 },
      { label: "Sessions Completed", value: formatNumber(metrics.sessions) },
    ];
    items.forEach((item, index) => {
      const x = margin + index * (cardW + 6);
      setFill(item.rose ? 0.99 : 0.97, item.rose ? 0.94 : 0.98, item.rose ? 0.95 : 0.97);
      fillRect(x, y - cardH, cardW, cardH);
      setStroke(item.rose ? 0.88 : 0.82, item.rose ? 0.45 : 0.86, item.rose ? 0.5 : 0.84, 0.8);
      strokeRect(x, y - cardH, cardW, cardH);
      addTextAt(item.label, x + 8, y - 16, 7.5, false, [0.4, 0.44, 0.48]);
      addTextAt(item.value, x + 8, y - 34, 13, true, item.rose ? [0.7, 0.15, 0.28] : [0.08, 0.1, 0.14]);
    });
    y -= cardH + 14;
    if (metrics.crisisFlags > 0) {
      addTextAt(
        `Crisis / HIGH risk flag count in range: ${formatNumber(metrics.crisisFlags)}`,
        margin,
        y,
        8,
        true,
        [0.7, 0.15, 0.28],
      );
      y -= 14;
    }
  };

  const drawTableHeader = () => {
    const rowH = 18;
    setFill(0.93, 0.95, 0.97);
    fillRect(margin, y - rowH, contentWidth, rowH);
    setStroke(0.78, 0.82, 0.86, 0.7);
    strokeRect(margin, y - rowH, contentWidth, rowH);
    let x = margin + 4;
    pdfColumns.forEach((column) => {
      const labelX = column.align === "right" ? x + column.width - 4 : x;
      // right-aligned labels: approximate by shifting left from edge
      if (column.align === "right") {
        addTextAt(column.label, x + Math.max(0, column.width - column.label.length * 4.2 - 2), y - 12, 7, true, [
          0.3,
          0.34,
          0.4,
        ]);
      } else {
        addTextAt(column.label, labelX, y - 12, 7, true, column.accent ? [0.7, 0.15, 0.28] : [0.3, 0.34, 0.4]);
      }
      x += column.width;
    });
    y -= rowH;
  };

  const getPdfCellValue = (row, column) => {
    switch (column.key) {
      case "identity":
        return truncatePdfText(
          `${row.fullName || "Unnamed"} | ${row.studentNumber || "--"}`,
          34,
        );
      case "program":
        return truncatePdfText(row.program || "—", 22);
      case "location":
        return truncatePdfText(formatLocation(row), 26);
      case "entriesInRange":
      case "flagsInRange":
      case "highRiskFlags":
      case "counselingSessions":
        return formatCountOrDash(row[column.key]);
      case "distressedFlags":
        return formatCountOrDash(getDistressedCount(row));
      case "topConcern":
        return truncatePdfText(row.topConcern || "—", 20);
      case "latestRiskLevel":
        return getShortRiskLabel(row.latestRiskLevel);
      case "reportStatus":
        return truncatePdfText(row.reportStatus || "—", 18);
      default:
        return "—";
    }
  };

  const drawDataRow = (row, index) => {
    const rowH = 16;
    if (index % 2 === 1) {
      setFill(0.98, 0.985, 0.99);
      fillRect(margin, y - rowH, contentWidth, rowH);
    }
    setStroke(0.9, 0.92, 0.94, 0.4);
    strokeRect(margin, y - rowH, contentWidth, rowH);
    let x = margin + 4;
    pdfColumns.forEach((column) => {
      const value = getPdfCellValue(row, column);
      const isCrisis =
        column.key === "highRiskFlags" && Number(row.highRiskFlags || 0) > 0;
      const isCrisisRisk =
        column.key === "latestRiskLevel" &&
        ["HIGH", "CRITICAL"].includes(normalizeRiskLevel(row.latestRiskLevel));
      const color =
        isCrisis || isCrisisRisk
          ? [0.7, 0.15, 0.28]
          : value === "—"
            ? [0.62, 0.66, 0.7]
            : [0.12, 0.14, 0.18];
      if (column.align === "right") {
        const approx = Math.max(0, column.width - String(value).length * 4.1 - 4);
        addTextAt(value, x + approx, y - 11, 7, Boolean(isCrisis || isCrisisRisk), color);
      } else {
        addTextAt(value, x, y - 11, 7, Boolean(isCrisis || isCrisisRisk), color);
      }
      x += column.width;
    });
    y -= rowH;
  };

  const beginPage = (isFirstPage) => {
    commands = [];
    pages.push(commands);
    y = pageHeight - margin;
    drawHeaderBand();
    if (isFirstPage) {
      drawKeyMetrics();
      addTextAt(
        "Student users only. Journal text, messages, private notes, and counselor names are excluded. Risk policy: HIGH / LOW / NONE (Crisis = HIGH/CRITICAL; Distressed = LOW).",
        margin,
        y,
        7.5,
        false,
        [0.4, 0.44, 0.48],
      );
      y -= 14;
    }
    drawTableHeader();
  };

  const ensureSpace = (requiredHeight) => {
    if (y - requiredHeight < bottomMargin) {
      beginPage(false);
    }
  };

  beginPage(true);

  if (!rows.length) {
    addTextAt("No data for this range.", margin, y - 8, 10);
  } else {
    rows.forEach((row, index) => {
      ensureSpace(18);
      drawDataRow(row, index);
    });
  }

  // Stamp confidential footer + page numbers on every page
  const totalPages = pages.length;
  pages.forEach((pageCommands, pageIndex) => {
    const footerY = 18;
    pageCommands.push("0.55 0.12 0.22 rg");
    pageCommands.push(
      `BT /F1 7 Tf 1 0 0 1 ${margin.toFixed(2)} ${footerY.toFixed(2)} Tm (${escapePdfText(
        "Confidential Guidance & Counseling Report — For Authorized School Personnel Only",
      )}) Tj ET`,
    );
    const pageLabel = `Page ${pageIndex + 1} of ${totalPages}`;
    const pageX = pageWidth - margin - pageLabel.length * 4.2;
    pageCommands.push("0.35 0.38 0.42 rg");
    pageCommands.push(
      `BT /F1 7 Tf 1 0 0 1 ${pageX.toFixed(2)} ${footerY.toFixed(2)} Tm (${escapePdfText(pageLabel)}) Tj ET`,
    );
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
          One row per student user. Distressed = LOW; Crisis = HIGH/CRITICAL. Journal content, insights, admin users,
          and counselor names are excluded.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 whitespace-nowrap border-b border-slate-100 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.12)]"
              >
                Identity
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-600">
                Program
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-600">
                Location
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Entries
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Flags
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Crisis
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Distressed
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Declined
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Contacted
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-600">
                Sessions
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-600">
                Top Concern
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-600">
                Highest Risk
              </th>
              <th scope="col" className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-5 py-10 text-center text-slate-500">
                  Loading student report...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => {
                const riskLabel = getShortRiskLabel(row.latestRiskLevel);
                const statusLabel = row.reportStatus || "No entries";
                return (
                  <tr key={row.studentNumber || row.email || row.fullName} className="group hover:bg-slate-50/80">
                    <td className="sticky left-0 z-10 max-w-[280px] border-b border-slate-100 bg-white px-4 py-3 shadow-[2px_0_6px_-2px_rgba(15,23,42,0.10)] group-hover:bg-slate-50">
                      <div className="flex items-start gap-3">
                        <StudentAvatar
                          className="mt-0.5 h-9 w-9 rounded-full text-[11px]"
                          fullName={row.fullName}
                          profilePictureUrl={row.profilePictureUrl}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{row.fullName || "—"}</div>
                          <div className="truncate text-xs font-medium text-slate-500">
                            {row.studentNumber || "No student number"}
                          </div>
                          <div className="truncate text-xs text-slate-400">{row.email || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-700">
                      {row.program || "—"}
                    </td>
                    <td className="max-w-[200px] border-b border-slate-100 px-4 py-3 text-slate-600">
                      <div className="truncate" title={formatLocation(row)}>
                        {formatLocation(row)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={Number(row.entriesInRange || 0) === 0 ? "font-normal text-slate-300" : ""}>
                        {formatCountOrDash(row.entriesInRange)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={Number(row.flagsInRange || 0) === 0 ? "font-normal text-slate-300" : ""}>
                        {formatCountOrDash(row.flagsInRange)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold">
                      <span
                        className={
                          Number(row.highRiskFlags || 0) === 0
                            ? "font-normal text-slate-300"
                            : "text-rose-700"
                        }
                      >
                        {formatCountOrDash(row.highRiskFlags)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={getDistressedCount(row) === 0 ? "font-normal text-slate-300" : "text-amber-700"}>
                        {formatCountOrDash(getDistressedCount(row))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={Number(row.declinedSupport || 0) === 0 ? "font-normal text-slate-300" : ""}>
                        {formatCountOrDash(row.declinedSupport)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={Number(row.contactedSupport || 0) === 0 ? "font-normal text-slate-300" : ""}>
                        {formatCountOrDash(row.contactedSupport)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">
                      <span className={Number(row.counselingSessions || 0) === 0 ? "font-normal text-slate-300" : ""}>
                        {formatCountOrDash(row.counselingSessions)}
                      </span>
                    </td>
                    <td className="max-w-[160px] border-b border-slate-100 px-4 py-3 text-slate-700">
                      <div className="truncate">{row.topConcern || "—"}</div>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRiskBadgeClasses(
                          row.latestRiskLevel,
                        )}`}
                      >
                        {riskLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusPillClasses(
                          statusLabel,
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={13} className="px-5 py-10 text-center text-slate-500">
                  No data for this range
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
  const today = getManilaTodayIso();
  const [rangeKey, setRangeKey] = useState("30d");
  const [customRange, setCustomRange] = useState({ startDate: today, endDate: today });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [programFilter, setProgramFilter] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [errorMessage, setErrorMessage] = useState("");

  const studentRows = useMemo(
    () => (Array.isArray(analytics?.reports?.students) ? analytics.reports.students : []),
    [analytics],
  );
  const programOptions = useMemo(() => {
    const values = new Set();
    for (const row of studentRows) {
      const program = String(row?.program || "").trim();
      if (program) values.add(program);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [studentRows]);
  const filteredStudentRows = useMemo(
    () =>
      applyClientFilters(studentRows, {
        flaggedOnly,
        programFilter,
        riskLevelFilter,
      }),
    [studentRows, flaggedOnly, programFilter, riskLevelFilter],
  );
  const totals = useMemo(
    () =>
      filteredStudentRows.reduce(
        (acc, row) => ({
          entries: acc.entries + Number(row.entriesInRange || 0),
          flags: acc.flags + Number(row.flagsInRange || 0),
          sessions: acc.sessions + Number(row.counselingSessions || 0),
          crisisFlags: acc.crisisFlags + Number(row.highRiskFlags || 0),
        }),
        { entries: 0, flags: 0, sessions: 0, crisisFlags: 0 },
      ),
    [filteredStudentRows],
  );
  const cardSessions = Number(analytics?.cards?.counselingSessions?.value ?? totals.sessions);
  const hasClientRowFilters =
    flaggedOnly ||
    Boolean(programFilter) ||
    (Boolean(riskLevelFilter) && riskLevelFilter !== "all");
  const displaySessions = hasClientRowFilters ? totals.sessions : cardSessions;

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
    if (nextRangeKey === "custom") {
      if (!customRange.startDate || !customRange.endDate || customRange.startDate > customRange.endDate) {
        setErrorMessage("Choose a valid custom date range before applying the filter.");
        return;
      }
    }
    void loadAnalytics(nextRangeKey, customRange);
  }

  function handleCustomApply() {
    if (!customRange.startDate || !customRange.endDate || customRange.startDate > customRange.endDate) {
      setErrorMessage("Choose a valid custom date range before applying the filter.");
      return;
    }
    setRangeKey("custom");
    void loadAnalytics("custom", customRange);
  }

  async function getAnalyticsForCurrentFilters() {
    if (rangeKey === "custom") {
      if (!customRange.startDate || !customRange.endDate || customRange.startDate > customRange.endDate) {
        throw new Error("Choose a valid custom date range before exporting.");
      }
    }

    const currentStartDate = analytics?.filters?.startDate || "";
    const currentEndDate = analytics?.filters?.endDate || "";
    const currentRangeKey = analytics?.filters?.rangeKey;
    const sameRange =
      rangeKey === "custom"
        ? currentRangeKey === "custom" &&
          currentStartDate === customRange.startDate &&
          currentEndDate === customRange.endDate
        : currentRangeKey === rangeKey;

    if (analytics && sameRange) {
      return analytics;
    }

    const data = await fetchAdminAnalytics({
      range: rangeKey,
      startDate: rangeKey === "custom" ? customRange.startDate : undefined,
      endDate: rangeKey === "custom" ? customRange.endDate : undefined,
    });
    setAnalytics(data);
    return data;
  }

  async function handleExportCsv() {
    try {
      setIsExportingCsv(true);
      const currentAnalytics = await getAnalyticsForCurrentFilters();
      const rawRows = Array.isArray(currentAnalytics?.reports?.students) ? currentAnalytics.reports.students : [];
      const rows = applyClientFilters(rawRows, {
        flaggedOnly,
        programFilter,
        riskLevelFilter,
      });
      const filters = currentAnalytics?.filters || {};
      setErrorMessage("");
      downloadFile(
        `student-report-${filters.startDate || today}-to-${filters.endDate || today}.csv`,
        buildStudentReportCsv(rows, filters),
        "text/csv;charset=utf-8;",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleExportPdf() {
    try {
      setIsExportingPdf(true);
      const currentAnalytics = await getAnalyticsForCurrentFilters();
      const rawRows = Array.isArray(currentAnalytics?.reports?.students) ? currentAnalytics.reports.students : [];
      const rows = applyClientFilters(rawRows, {
        flaggedOnly,
        programFilter,
        riskLevelFilter,
      });
      const filters = currentAnalytics?.filters || {};
      const exportTotals = rows.reduce(
        (acc, row) => ({
          entries: acc.entries + Number(row.entriesInRange || 0),
          flags: acc.flags + Number(row.flagsInRange || 0),
          sessions: acc.sessions + Number(row.counselingSessions || 0),
          crisisFlags: acc.crisisFlags + Number(row.highRiskFlags || 0),
        }),
        { entries: 0, flags: 0, sessions: 0, crisisFlags: 0 },
      );
      const sessionsValue = Number(
        currentAnalytics?.cards?.counselingSessions?.value ?? exportTotals.sessions,
      );
      setErrorMessage("");
      const pdf = createStudentReportPdf({
        rows,
        filters,
        summary: {
          students: rows.length,
          entries: exportTotals.entries,
          flags: exportTotals.flags,
          sessions: sessionsValue,
          crisisFlags: exportTotals.crisisFlags,
        },
      });
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
                  min={customRange.startDate || undefined}
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
              disabled={loading || isExportingCsv || isExportingPdf || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExportingCsv ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || isExportingPdf || isExportingCsv || !analytics}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExportingPdf ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Report Range</div>
            <div className="mt-1 font-semibold text-slate-900">
              {analytics?.filters?.startDate || "--"} to {analytics?.filters?.endDate || "--"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Student Rows</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(filteredStudentRows.length)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Entries in Range</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(totals.entries)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Flags in Range</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(totals.flags)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-slate-500">Counseling Sessions</div>
            <div className="mt-1 font-semibold text-slate-900">{formatNumber(displaySessions)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick filters</span>
            <button
              type="button"
              onClick={() => setFlaggedOnly((value) => !value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                flaggedOnly
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Flagged / At-Risk
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk level</span>
            {[
              { key: "all", label: "All" },
              { key: "crisis", label: "Crisis" },
              { key: "distressed", label: "Distressed" },
              { key: "none", label: "None" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRiskLevelFilter(option.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  riskLevelFilter === option.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[180px] flex-col gap-1 text-sm text-slate-600">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</span>
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">All programs</option>
                {programOptions.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
            </label>

            <div className="ml-auto text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-800">{formatNumber(filteredStudentRows.length)}</span> of{" "}
              <span className="font-semibold text-slate-800">{formatNumber(studentRows.length)}</span> students
            </div>
          </div>
        </div>

        <StudentReportTable rows={filteredStudentRows} loading={loading} />
      </div>
    </Layout>
  );
}

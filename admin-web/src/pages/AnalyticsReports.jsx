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

const CONCERN_COLORS = ["#4D8FEF", "#9B6EF3", "#39C493", "#F6B84E"];
const RISK_COLORS = {
  critical: "#FF5D5D",
  high: "#F59E0B",
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function buildLinePath(values, width, height) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (Number(value || 0) / max) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values, width, height) {
  if (!values.length) return "";
  const line = buildLinePath(values, width, height);
  if (!line) return "";
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

function formatTooltipLines(lines) {
  return lines.filter(Boolean).join("\n");
}

function buildStackedAreas(seriesList, width, height) {
  const pointCount = Math.max(...seriesList.map((series) => series.values.length), 0);
  if (!pointCount) return [];

  const totals = Array.from({ length: pointCount }, (_, index) =>
    seriesList.reduce((sum, series) => sum + Number(series.values[index] || 0), 0),
  );
  const maxTotal = Math.max(...totals, 1);
  const stepX = pointCount > 1 ? width / (pointCount - 1) : width;
  const cumulative = Array(pointCount).fill(0);

  return seriesList.map((series) => {
    const topPoints = [];
    const bottomPoints = [];

    for (let index = 0; index < pointCount; index += 1) {
      const value = Number(series.values[index] || 0);
      const x = index * stepX;
      const bottomValue = cumulative[index];
      const topValue = bottomValue + value;
      const topY = height - (topValue / maxTotal) * (height - 16) - 8;
      const bottomY = height - (bottomValue / maxTotal) * (height - 16) - 8;
      topPoints.push(`${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${topY.toFixed(2)}`);
      bottomPoints.unshift(`L ${x.toFixed(2)} ${bottomY.toFixed(2)}`);
      cumulative[index] = topValue;
    }

    return `${topPoints.join(" ")} ${bottomPoints.join(" ")} Z`;
  });
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

  const journalSeries = analytics?.charts?.journalEntryVolume || [];
  const journalValues = journalSeries.map((item) => Number(item.value || 0));
  const journalPath = buildLinePath(journalValues, 660, 240);
  const journalArea = buildAreaPath(journalValues, 660, 240);
  const journalMax = Math.max(...journalValues, 1);
  const journalPoints = journalValues.map((value, index) => ({
    x: journalValues.length > 1 ? (660 / (journalValues.length - 1)) * index : 330,
    y: 240 - (Number(value || 0) / journalMax) * (240 - 12) - 6,
    value,
    label: journalSeries[index]?.label || "",
  }));
  const concernSeries = analytics?.charts?.concernTrends?.series || [];
  const concernAreaPaths = buildStackedAreas(concernSeries, 280, 170);
  const counselorWorkload = analytics?.charts?.counselorWorkload || [];
  const counselorMax = Math.max(...counselorWorkload.map((item) => Number(item.value || 0)), 1);
  const riskTrendSeries = analytics?.charts?.atRiskStudentTrends?.series || [];
  const criticalSeries = riskTrendSeries.find((item) => item.key === "critical")?.values || [];
  const highSeries = riskTrendSeries.find((item) => item.key === "high")?.values || [];
  const riskMax = Math.max(...criticalSeries, ...highSeries, 1);
  const criticalPath = buildLinePath(criticalSeries, 280, 170);
  const highPath = buildLinePath(highSeries, 280, 170);
  const resolutionRates = analytics?.charts?.resolutionRates || [];

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

        <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-[1.35rem] font-semibold text-slate-900">Journal Entry Volume Over Time</h3>
            <p className="mt-1 text-sm text-slate-500">Total journal entries for the current month</p>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500">Loading live chart data...</div>
          ) : journalSeries.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="relative h-[280px]">
                  <svg viewBox="0 0 700 250" className="h-full w-full">
                    {[0, 1, 2, 3].map((row) => (
                      <line
                        key={row}
                        x1="0"
                        y1={20 + row * 55}
                        x2="660"
                        y2={20 + row * 55}
                        stroke="#D8E0EC"
                        strokeDasharray="4 5"
                      />
                    ))}
                    <path d={journalArea} fill="rgba(16,185,129,0.16)" transform="translate(20 0)" />
                    <path d={journalPath} fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" transform="translate(20 0)" />
                    {journalPoints.map((point, index) => (
                      <circle key={journalSeries[index]?.isoDate || index} cx={point.x + 20} cy={point.y} r="5" fill="#059669">
                        <title>{`${point.label}: ${formatNumber(point.value)} entries`}</title>
                      </circle>
                    ))}
                  </svg>
                </div>
                <div className="mt-3 grid gap-3 text-xs font-semibold text-slate-500" style={{ gridTemplateColumns: `repeat(${journalSeries.length}, minmax(0, 1fr))` }}>
                  {journalSeries.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="text-center">
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">No journal entry volume available for this range.</div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-[1.2rem] font-semibold text-slate-900">Concern Trends Over Time</h3>
            <p className="mt-1 text-sm text-slate-500">Stacked view of primary concerns</p>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading concern trends...</div>
            ) : concernSeries.length ? (
              <>
                <div className="mt-6">
                  <svg viewBox="0 0 300 190" className="h-[230px] w-full">
                    {[0, 1, 2, 3].map((row) => (
                      <line
                        key={row}
                        x1="0"
                        y1={20 + row * 40}
                        x2="280"
                        y2={20 + row * 40}
                        stroke="#D8E0EC"
                        strokeDasharray="4 5"
                      />
                    ))}
                    {concernAreaPaths.map((path, index) => (
                      <path
                        key={concernSeries[index]?.key || index}
                        d={path}
                        fill={CONCERN_COLORS[index % CONCERN_COLORS.length]}
                        opacity="0.68"
                        transform="translate(10 6)"
                      />
                    ))}
                    {(analytics?.charts?.concernTrends?.labels || []).map((label, index, labels) => {
                      const width = labels.length > 1 ? 280 / labels.length : 280;
                      const x = index * width + 10;
                      const tooltip = formatTooltipLines([
                        label,
                        ...concernSeries.map((series) => `${series.label}: ${formatNumber(series.values[index] || 0)}`),
                      ]);
                      return (
                        <rect key={label} x={x} y="0" width={width} height="186" fill="transparent">
                          <title>{tooltip}</title>
                        </rect>
                      );
                    })}
                  </svg>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                  {(analytics?.charts?.concernTrends?.labels || []).map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-4">
                  {concernSeries.map((series, index) => (
                    <div key={series.key} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CONCERN_COLORS[index % CONCERN_COLORS.length] }} />
                      {series.label.toLowerCase().replace(/\s*\/\s*/g, " ")}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">No concern data available for this range.</div>
            )}
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-[1.2rem] font-semibold text-slate-900">Counselor Workload</h3>
            <p className="mt-1 text-sm text-slate-500">Active cases assigned per role</p>

            <div className="mt-8 space-y-6">
              {loading ? (
                <div className="text-center text-sm text-slate-500">Loading counselor workload...</div>
              ) : counselorWorkload.length ? (
                counselorWorkload.map((counselor) => (
                  <div key={counselor.label} className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <div className="text-sm text-slate-500">{counselor.label}</div>
                    <div>
                      <div className="h-5 rounded-full bg-slate-100" title={`${counselor.label}: ${formatNumber(counselor.value)} assigned cases`}>
                        <div
                          className="h-5 rounded-full bg-[#20C08D]"
                          style={{ width: `${Math.max(10, (Number(counselor.value || 0) / counselorMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-slate-500">No counselor workload data available.</div>
              )}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-[1.2rem] font-semibold text-slate-900">At-Risk Student Trends</h3>
            <p className="mt-1 text-sm text-slate-500">Weekly tracking of high and critical severity cases</p>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading risk trends...</div>
            ) : (
              <>
                <div className="mt-6">
                  <svg viewBox="0 0 300 190" className="h-[220px] w-full">
                    {[0, 1, 2, 3].map((row) => (
                      <line
                        key={row}
                        x1="0"
                        y1={20 + row * 40}
                        x2="280"
                        y2={20 + row * 40}
                        stroke="#D8E0EC"
                        strokeDasharray="4 5"
                      />
                    ))}
                    <path d={highPath} fill="none" stroke={RISK_COLORS.high} strokeWidth="3" transform="translate(10 6)" />
                    <path d={criticalPath} fill="none" stroke={RISK_COLORS.critical} strokeWidth="3" transform="translate(10 6)" />
                    {highSeries.map((value, index) => {
                      const x = highSeries.length > 1 ? (280 / (highSeries.length - 1)) * index + 10 : 150;
                      const y = 176 - (Number(value || 0) / riskMax) * 154;
                      return (
                        <circle key={`high-${index}`} cx={x} cy={y} r="4" fill="white" stroke={RISK_COLORS.high} strokeWidth="2.5">
                          <title>{`${analytics?.charts?.atRiskStudentTrends?.labels?.[index] || `W${index + 1}`}: ${formatNumber(value)} high-risk cases`}</title>
                        </circle>
                      );
                    })}
                    {criticalSeries.map((value, index) => {
                      const x = criticalSeries.length > 1 ? (280 / (criticalSeries.length - 1)) * index + 10 : 150;
                      const y = 176 - (Number(value || 0) / riskMax) * 154;
                      return (
                        <circle key={`critical-${index}`} cx={x} cy={y} r="4" fill="white" stroke={RISK_COLORS.critical} strokeWidth="2.5">
                          <title>{`${analytics?.charts?.atRiskStudentTrends?.labels?.[index] || `W${index + 1}`}: ${formatNumber(value)} critical cases`}</title>
                        </circle>
                      );
                    })}
                  </svg>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                  {(analytics?.charts?.atRiskStudentTrends?.labels || []).map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#FF5D5D]" />
                    Critical
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                    High Risk
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-[1.2rem] font-semibold text-slate-900">Response Within Target Time</h3>
            <p className="mt-1 text-sm text-slate-500">How many tagged risk cases got a counselor response within the target hours.</p>

            <div className="mt-8 space-y-6">
              {loading ? (
                <div className="text-center text-sm text-slate-500">Loading resolution rates...</div>
              ) : resolutionRates.length ? (
                <>
                  {resolutionRates.map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm text-slate-700">
                          {item.label} ({item.targetLabel})
                        </div>
                        <div className={`text-sm font-semibold ${item.color === "amber" ? "text-amber-500" : "text-emerald-600"}`}>
                          {item.value}%
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100" title={`${item.label}: ${item.value}% met ${item.targetLabel}`}>
                        <div
                          className={`h-3 rounded-full ${item.color === "amber" ? "bg-amber-500" : "bg-[#20C08D]"}`}
                          style={{ width: `${Math.max(0, Math.min(100, Number(item.value || 0)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                    This is a monitoring metric for response speed. It is helpful for counselor follow-up, but it is not required for basic scheduling to work.
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-slate-500">No resolution data available.</div>
              )}
            </div>
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

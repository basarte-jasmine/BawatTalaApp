import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Download,
  Mail,
  PhoneCall,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Layout from "../components/Layout";
import {
  fetchAdminAnalytics,
  fetchAdminDashboardSummary,
  fetchAdminRiskFlags,
} from "../lib/admin-api";

const SUMMARY_CARD_DEFS = [
  {
    key: "flagged",
    title: "Flagged Entries",
    icon: AlertTriangle,
  },
  {
    key: "students",
    title: "Total Students",
    icon: Users,
  },
  {
    key: "entries",
    title: "Total Entries",
    icon: Activity,
  },
  {
    key: "futureMessages",
    title: "Future Me Messages",
    icon: Mail,
  },
  {
    key: "scheduled",
    title: "Scheduled Today",
    icon: CalendarIcon,
  },
  {
    key: "muniAccuracy",
    title: "Muni Feedback",
    icon: CheckCircle2,
    valueType: "percent",
  },
];

const ANALYTICS_CARD_DEFS = [
  {
    key: "averageEntriesPerStudent",
    title: "Avg Entries/Student",
    icon: Activity,
    valueType: "decimal",
  },
  {
    key: "counselingSessions",
    title: "Counseling Sessions",
    icon: CheckCircle2,
    valueType: "number",
  },
];

const RANGE_OPTIONS = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

const RISK_COLORS = {
  crisis: "#FF5D5D",
  distressed: "#F59E0B",
};
const CONSULTATION_VOLUME_CATEGORY_DEFS = [
  { label: "Personal problems", sources: ["Personal problems"] },
  { label: "Mental health", sources: ["Mental health"] },
  { label: "Career guidance", sources: ["Career guidance"] },
  { label: "Financial", sources: ["Financial guidance", "Financial"] },
  { label: "Burnout / Exhaustion", sources: ["Burnout / Exhaustion", "Burnout/Exhaustion"] },
  { label: "Academic problems", sources: ["Academic problems"] },
  { label: "Peer relationship", sources: ["Peer relationship", "Peer"] },
  { label: "Family relationship", sources: ["Family relationship", "Family"] },
  { label: "Romantic relationship", sources: ["Romantic relationship", "Romantic"] },
  { label: "Anxiety", sources: ["Anxiety"] },
  { label: "Stress", sources: ["Stress"] },
  { label: "Bullying", sources: ["Bullying"] },
  { label: "Adjustment", sources: ["Adjustment"] },
  { label: "Others", sources: ["Others"] },
];
const PRIMARY_STUDENT_CONCERN_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#64748b",
  "#f43f5e",
  "#14b8a6",
  "#84cc16",
  "#10b981",
  "#f59e0b",
  "#475569",
  "#7c3aed",
  "#06b6d4",
  "#0f766e",
  "#be185d",
  "#0369a1",
];

function MetricCard({ item, onSelect }) {
  const Icon = item.icon;
  const DeltaIcon = item.direction === "down" ? ArrowDownRight : item.direction === "up" ? ArrowUpRight : null;
  const isAmber = item.tone === "amber";
  const isGreen = item.tone === "green";
  const chipClassName =
    isAmber
      ? "bg-amber-50 text-amber-700 border border-amber-200/70"
      : isGreen
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
        : "bg-slate-100/80 text-slate-600 border border-slate-200/60";
  const iconBoxClassName =
    isAmber
      ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60"
      : isGreen
        ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60"
        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60";
  const cardBaseClass =
    "bt-card flex flex-col justify-between gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4.5 sm:p-5 text-left shadow-sm transition-all duration-200";
  const cardInteractiveClass = onSelect
    ? "hover:border-emerald-300 hover:shadow-md cursor-pointer"
    : "";
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon ? (
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBoxClassName}`}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <h3 className="truncate text-sm font-semibold text-slate-700" title={item.title}>
            {item.title}
          </h3>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 pt-1">
        <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{item.value}</div>
        <div className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${chipClassName}`}>
          {DeltaIcon ? <DeltaIcon className="h-3.5 w-3.5" /> : null}
          <span>{item.delta}</span>
        </div>
      </div>
    </>
  );

  if (!onSelect) {
    return <div className={`${cardBaseClass} ${cardInteractiveClass}`} data-export-block="true">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item.title)}
      className={`${cardBaseClass} ${cardInteractiveClass}`}
      data-export-block="true"
    >
      {content}
    </button>
  );
}

function EmptyState({ children = "No live data available yet." }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function formatMetricValue(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatMetricDecimal(value) {
  return Number(value || 0).toFixed(1);
}

function mapMetricTone(key, direction) {
  if (key === "flagged") {
    return direction === "down" ? "green" : "amber";
  }
  if (direction === "up") return "green";
  if (direction === "down") return "gray";
  return "gray";
}

function buildLinePath(values, width, height, maxOverride) {
  if (!values.length) return "";
  const max = Math.max(Number(maxOverride || 0), ...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (Number(value || 0) / max) * (height - 22);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function DonutChart({
  data,
  size = 260,
  strokeWidth = 26,
  centerValue,
  centerLabel = "Total Valid",
  onSelect,
}) {
  const viewBoxSize = 320;
  const center = viewBoxSize / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  let progress = 0;

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="h-[280px] w-full">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#DCFCE7" strokeWidth={strokeWidth} />
        {data.map((item) => {
          const fraction = item.value / total;
          const dasharray = `${fraction * circumference} ${circumference}`;
          const dashoffset = -progress * circumference;
          progress += fraction;
          return (
            <circle
              key={item.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${center} ${center})`}
              className={onSelect ? "cursor-pointer" : ""}
              onClick={onSelect ? () => onSelect(item.label) : undefined}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-emerald-800">{centerValue || total.toLocaleString()}</span>
        <span className="text-xs font-semibold text-gray-500">{centerLabel}</span>
      </div>
    </div>
  );
}

function ChartLegend({ data, onSelect, className = "mx-auto w-full max-w-[300px]" }) {
  return (
    <div className={`mt-2 grid gap-2 text-sm text-gray-700 ${className}`}>
      {data.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={onSelect ? () => onSelect(item.label) : undefined}
          className="grid grid-cols-[14px_1fr_auto] items-center gap-2 rounded-lg px-1 py-1 text-left"
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="min-w-0 truncate">{item.label}</span>
          <span className="font-black text-gray-900">{item.value.toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}

function buildChartAxis(maxValue) {
  const max = Math.max(1, Number(maxValue || 0));
  const roughStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, niceNormalized * magnitude);
  const fittedMax = step * Math.ceil(max / step);
  const axisMax = fittedMax / step < 3 ? step * 3 : fittedMax;

  return {
    axisMax,
    guides: Array.from({ length: Math.round(axisMax / step) + 1 }, (_, index) => axisMax - index * step),
  };
}

function buildJournalEntriesAxis(maxValue) {
  const max = Math.max(0, Math.ceil(Number(maxValue || 0)));

  if (max < 8) {
    const axisMax = max + 1;
    return {
      axisMax,
      guides: Array.from({ length: axisMax + 1 }, (_, index) => axisMax - index),
    };
  }

  return buildChartAxis(max);
}

function getChartTickIndexes(pointCount, maxTickCount = 8) {
  if (pointCount <= 0) return [];
  if (pointCount <= maxTickCount) return Array.from({ length: pointCount }, (_, index) => index);

  const lastIndex = pointCount - 1;
  const interval = Math.ceil(lastIndex / (maxTickCount - 1));
  const indexes = [];

  for (let index = 0; index < lastIndex; index += interval) {
    indexes.push(index);
  }

  indexes.push(lastIndex);
  return indexes;
}

function JournalEntriesGraph({ data, onSelect }) {
  const width = 760;
  const height = 360;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 44;
  const padBottom = 64;
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 0);
  const { axisMax, guides } = buildJournalEntriesAxis(max);
  const tickIndexes = new Set(getChartTickIndexes(data.length));
  const points = data.map((item, index) => {
    const x = padLeft + (index * (width - padLeft - padRight)) / Math.max(1, data.length - 1);
    const y = padTop + ((axisMax - item.value) * (height - padTop - padBottom)) / axisMax;
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index, items) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = items[index - 1];
      const midX = (previous.x + point.x) / 2;
      return `C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <div className="h-[360px] w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        {guides.map((guide) => {
          const y = padTop + ((axisMax - guide) * (height - padTop - padBottom)) / axisMax;
          return (
            <g key={guide}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E5E7EB" strokeDasharray="3 5" />
              <text x={padLeft - 12} y={y + 4} textAnchor="end" className="fill-[#6B7280] text-[12px] font-medium">
                {guide}
              </text>
            </g>
          );
        })}
        <text
          x="18"
          y={(height - padBottom + padTop) / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${(height - padBottom + padTop) / 2})`}
          className="fill-[#334155] text-[13px] font-semibold"
        >
          Number of Entries
        </text>
        <path d={linePath} fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill="#16a34a"
              stroke="white"
              strokeWidth="2"
              className={onSelect ? "cursor-pointer" : ""}
              onClick={onSelect ? () => onSelect(`Journal Entries: ${point.label}`) : undefined}
            />
            <text
              x={point.x}
              y={Math.max(12, point.y - 10)}
              textAnchor="middle"
              className="fill-[#065f46] text-[16px] font-black"
            >
              {point.value.toLocaleString()}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          tickIndexes.has(index) ? (
            <g key={`tick-${point.isoDate || point.label}`}>
              <line
                x1={point.x}
                y1={height - padBottom}
                x2={point.x}
                y2={height - padBottom + 5}
                stroke="#94A3B8"
              />
              <text
                x={point.x}
                y={height - padBottom + 24}
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                className="fill-[#334155] text-[12px] font-semibold"
              >
                {point.label}
              </text>
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function ActiveUsageGraph({ data, onSelect }) {
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sortedData.map((item) => item.value), 1);
  const width = 760;
  const height = 360;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 42;
  const padBottom = 94;
  const { axisMax, guides } = buildChartAxis(max);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const slotWidth = plotWidth / Math.max(1, sortedData.length);
  const barWidth = Math.min(72, Math.max(36, slotWidth * 0.58));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[380px] w-full">
        {guides.map((guide) => {
          const y = padTop + ((axisMax - guide) * plotHeight) / axisMax;
          return (
            <g key={guide}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E5E7EB" strokeDasharray="3 5" />
              <text x={padLeft - 12} y={y + 4} textAnchor="end" className="fill-[#64748B] text-[12px] font-semibold">
                {guide}
              </text>
            </g>
          );
        })}
        <text
          x="18"
          y={padTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${padTop + plotHeight / 2})`}
          className="fill-[#334155] text-[13px] font-semibold"
        >
          Students
        </text>
        {sortedData.map((item, index) => {
          const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (Number(item.value || 0) / axisMax) * plotHeight;
          const y = padTop + plotHeight - barHeight;
          const labelX = x + barWidth / 2;
          const shortLabel = String(item.label || "").replace(/^BS/i, "").trim() || item.label;

          return (
            <g
              key={item.key}
              className={onSelect ? "cursor-pointer" : ""}
              onClick={onSelect ? () => onSelect(`Program Distribution: ${item.label}`) : undefined}
            >
              <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} rx="8" fill={item.color} />
              <text x={labelX} y={Math.max(16, y - 9)} textAnchor="middle" className="fill-[#134611] text-[14px] font-black">
                {item.value.toLocaleString()}
              </text>
              <text
                x={labelX}
                y={height - padBottom + 38}
                textAnchor="end"
                transform={`rotate(-38 ${labelX} ${height - padBottom + 38})`}
                className="fill-[#334155] text-[12px] font-black"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StudentDemographicsChart({ data, onSelect }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={onSelect ? () => onSelect(`Student Demographics: ${item.label}`) : undefined}
          className="grid w-full grid-cols-[120px,1fr,72px] items-center gap-3 text-left"
        >
          <span className="min-w-0 truncate text-sm font-medium text-gray-500">{item.label}</span>
          <div className="h-4 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2E7D32] to-[#66BB6A]"
              style={{ width: `${Math.max(12, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-sm font-semibold text-gray-700">{item.value}</span>
        </button>
      ))}
    </div>
  );
}

function ConcernThemesChart({ data }) {
  const sortedData = [...data]
    .map((item, index) => ({
      ...item,
      color: item.color || PRIMARY_STUDENT_CONCERN_COLORS[index % PRIMARY_STUDENT_CONCERN_COLORS.length] || "#10B981",
    }))
    .sort((a, b) => b.value - a.value || Number(a.order || 0) - Number(b.order || 0));
  const max = Math.max(...sortedData.map((item) => item.value), 1);
  const width = 980;
  const height = 380;
  const padLeft = 70;
  const padRight = 28;
  const padTop = 42;
  const padBottom = 102;
  const { axisMax, guides } = buildChartAxis(max);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const slotWidth = plotWidth / Math.max(1, sortedData.length);
  const barWidth = Math.min(58, Math.max(26, slotWidth * 0.72));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[400px] w-full">
        {guides.map((guide) => {
          const y = padTop + ((axisMax - guide) * plotHeight) / axisMax;
          return (
            <g key={guide}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E5E7EB" strokeDasharray="3 5" />
              <text x={padLeft - 14} y={y + 4} textAnchor="end" className="fill-[#64748B] text-[13px] font-semibold">
                {guide}
              </text>
            </g>
          );
        })}
        <text
          x="18"
          y={padTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${padTop + plotHeight / 2})`}
          className="fill-[#334155] text-[14px] font-semibold"
        >
          Count
        </text>

        {sortedData.map((item, index) => {
          const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (Number(item.value || 0) / axisMax) * plotHeight;
          const y = padTop + plotHeight - barHeight;
          const labelX = x + barWidth / 2;
          const barColor = item.color || PRIMARY_STUDENT_CONCERN_COLORS[index % PRIMARY_STUDENT_CONCERN_COLORS.length] || "#10B981";
          const shortLabel = item.label
            .replace("Personal Growth / Epiphanies", "Personal Growth")
            .replace("Gratitude / Appreciation", "Gratitude")
            .replace("Hobbies & Interests", "Hobbies")
            .replace("Travel & Adventure", "Travel")
            .replace("Spirituality / Faith", "Spirituality")
            .replace("Burnout / Exhaustion", "Burnout")
            .replace("Academic problems", "Academic")
            .replace("Peer relationship", "Peer")
            .replace("Family relationship", "Family")
            .replace("Romantic relationship", "Romantic")
            .replace("Career guidance", "Career")
            .replace("Mental health", "Mental")
            .replace("Personal problems", "Personal")
            .replace("Financial", "Financial");

          return (
            <g key={item.key || item.label || index}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx="8"
                fill={barColor}
              />
              <text x={labelX} y={Math.max(16, y - 8)} textAnchor="middle" className="fill-[#334155] text-[15px] font-black">
                {item.value.toLocaleString()}
              </text>
              <text
                x={labelX}
                y={height - padBottom + 42}
                textAnchor="end"
                transform={`rotate(-42 ${labelX} ${height - padBottom + 42})`}
                className="fill-[#111827] text-[12px] font-black"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ConsultationVolumeByCategoryPanel({ analytics, loading, periodLabel = "this period" }) {
  const data = buildConsultationVolumeCategoryData(analytics?.charts?.consultationVolumeByCategory || []);
  const hasData = data.some((item) => item.value > 0);
  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading consultation categories...</div>;
  }

  if (!hasData) {
    return <div className="py-16 text-center text-sm text-slate-500">No consultation category data available for {periodLabel}.</div>;
  }

  return <ConcernThemesChart data={data} />;
}

function CounselorWorkloadPanel({ analytics, loading }) {
  const workload = analytics?.charts?.counselorWorkload || [];
  const max = Math.max(...workload.map((item) => Number(item.value || 0)), 1);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading counselor workload...</div>;
  }

  if (!workload.length) {
    return <div className="py-16 text-center text-sm text-slate-500">No counselor workload data available.</div>;
  }

  return (
    <div className="space-y-6">
      {workload.map((counselor) => (
        <div key={counselor.key || counselor.label} className="grid grid-cols-[180px_1fr_52px] items-center gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-700">{counselor.label}</div>
            <div className="text-xs text-slate-400">{counselor.role || "Counselor"}</div>
          </div>
          <div>
            <div className="h-5 rounded-full bg-slate-100">
              <div
                className={`h-5 rounded-full ${counselor.supportType === "PEER" ? "bg-[#4D8FEF]" : "bg-[#20C08D]"}`}
                style={{ width: `${Math.max(10, (Number(counselor.value || 0) / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="text-right text-sm font-bold text-slate-700">{formatMetricValue(counselor.value)}</div>
        </div>
      ))}
    </div>
  );
}

function AtRiskTrendsPanel({ analytics, loading }) {
  const labels = analytics?.charts?.atRiskStudentTrends?.labels || [];
  const series = analytics?.charts?.atRiskStudentTrends?.series || [];
  const crisisSeries =
    series.find((item) => item.key === "crisis")?.values ||
    series.find((item) => item.key === "critical")?.values ||
    [];
  const distressedSeries =
    series.find((item) => item.key === "distressed")?.values ||
    series.find((item) => item.key === "high")?.values ||
    [];
  const pointCount = Math.max(labels.length, crisisSeries.length, distressedSeries.length, 1);
  const chartLabels = Array.from({ length: pointCount }, (_, index) => labels[index] || `W${index + 1}`);
  const maxValue = Math.max(...crisisSeries, ...distressedSeries, 1);
  const { axisMax, guides } = buildChartAxis(maxValue);
  const width = 520;
  const height = 260;
  const padLeft = 54;
  const padRight = 24;
  const padTop = 28;
  const padBottom = 48;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const xForIndex = (index) => padLeft + (index * plotWidth) / Math.max(1, pointCount - 1);
  const yForValue = (value) => padTop + ((axisMax - Number(value || 0)) * plotHeight) / axisMax;
  const toPoints = (values) =>
    Array.from({ length: pointCount }, (_, index) => ({
      label: chartLabels[index],
      value: Number(values[index] || 0),
      x: xForIndex(index),
      y: yForValue(values[index] || 0),
    }));
  const crisisPoints = toPoints(crisisSeries);
  const distressedPoints = toPoints(distressedSeries);
  const toPath = (points) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading risk trends...</div>;
  }

  if (!crisisSeries.length && !distressedSeries.length) {
    return <div className="py-16 text-center text-sm text-slate-500">No at-risk trend data available.</div>;
  }

  return (
    <>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-h-[260px] min-w-[520px]">
          {guides.map((guide) => {
            const y = yForValue(guide);
            return (
              <g key={guide}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#D8E0EC" strokeDasharray="4 6" />
                <text x={padLeft - 12} y={y + 4} textAnchor="end" className="fill-[#64748b] text-[12px] font-semibold">
                  {guide}
                </text>
              </g>
            );
          })}
          <path d={toPath(distressedPoints)} fill="none" stroke={RISK_COLORS.distressed} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath(crisisPoints)} fill="none" stroke={RISK_COLORS.crisis} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {distressedPoints.map((point) => (
            <circle
              key={`distressed-${point.label}`}
              cx={point.x}
              cy={point.y}
              r="6"
              fill="white"
              stroke={RISK_COLORS.distressed}
              strokeWidth="3"
            />
          ))}
          {crisisPoints.map((point) => (
            <circle
              key={`crisis-${point.label}`}
              cx={point.x}
              cy={point.y}
              r="6"
              fill="white"
              stroke={RISK_COLORS.crisis}
              strokeWidth="3"
            />
          ))}
          {chartLabels.map((label, index) => (
            <text key={label} x={xForIndex(index)} y={height - 16} textAnchor="middle" className="fill-[#64748b] text-[13px] font-semibold">
              {label}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#FF5D5D]" />
          Crisis / Critical Need
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
          Distressed / Needs Support
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-600" style={{ gridTemplateColumns: `repeat(${pointCount}, minmax(0, 1fr))` }}>
        {chartLabels.map((label, index) => (
          <div key={`summary-${label}`} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
            <div className="font-bold text-slate-700">{label}</div>
            <div className="mt-1 text-red-500">Crisis: {formatMetricValue(crisisSeries[index] || 0)}</div>
            <div className="text-amber-600">Distressed: {formatMetricValue(distressedSeries[index] || 0)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ResponseTargetPanel({ analytics, loading }) {
  const resolutionRates = analytics?.charts?.resolutionRates || [];

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading resolution rates...</div>;
  }

  if (!resolutionRates.length) {
    return <div className="py-16 text-center text-sm text-slate-500">No resolution data available.</div>;
  }

  return (
    <div className="space-y-6">
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
          <div className="h-3 rounded-full bg-slate-100">
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
    </div>
  );
}

function MoodTrendsChart({ series, onSelect }) {
  const width = 980;
  const height = 360;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 42;
  const padBottom = 88;
  const rankedData = [...series]
    .map((item) => ({
      ...item,
      value: (Array.isArray(item.values) ? item.values : []).reduce((sum, value) => sum + Number(value || 0), 0),
    }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...rankedData.map((item) => item.value), 1);
  const { axisMax, guides } = buildChartAxis(max);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const slotWidth = plotWidth / Math.max(1, rankedData.length);
  const barWidth = Math.min(58, Math.max(24, slotWidth * 0.72));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[380px] w-full">
        {guides.map((guide) => {
          const y = padTop + ((axisMax - guide) * plotHeight) / axisMax;
          return (
            <g key={guide}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E5E7EB" strokeDasharray="3 5" />
              <text x={padLeft - 14} y={y + 4} textAnchor="end" className="fill-[#64748B] text-[13px] font-semibold">
                {guide}
              </text>
            </g>
          );
        })}
        <text
          x="18"
          y={padTop + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${padTop + plotHeight / 2})`}
          className="fill-[#334155] text-[14px] font-semibold"
        >
          Number of Check-ins
        </text>

        {rankedData.map((item, index) => {
          const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (Number(item.value || 0) / axisMax) * plotHeight;
          const y = padTop + plotHeight - barHeight;
          const labelX = x + barWidth / 2;

          return (
            <g
              key={item.key}
              className={onSelect ? "cursor-pointer" : ""}
              onClick={onSelect ? () => onSelect(`Emotion Trend: ${item.label}`) : undefined}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx="10"
                fill={item.color}
              />
              <text x={labelX} y={Math.max(16, y - 8)} textAnchor="middle" className="fill-[#064e3b] text-[17px] font-black">
                {item.value.toLocaleString()}
              </text>
              <text
                x={labelX}
                y={height - padBottom + 32}
                textAnchor="end"
                transform={`rotate(-42 ${labelX} ${height - padBottom + 32})`}
                className="fill-[#111827] text-[14px] font-black"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>

    </div>
  );
}

function toChartKey(value, index = 0) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `series_${index + 1}`;
}

function withColors(data, colors) {
  return (Array.isArray(data) ? data : []).map((item, index) => ({
    ...item,
    key: item.key || toChartKey(item.label, index),
    color: item.color || colors[index % colors.length],
  }));
}

function getCurrentMonthAnalyticsParams(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return {
    range: "custom",
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

function getRangeQueryParams(nextRangeKey, nextCustomRange = {}) {
  return {
    range: nextRangeKey,
    startDate: nextRangeKey === "custom" ? nextCustomRange.startDate : undefined,
    endDate: nextRangeKey === "custom" ? nextCustomRange.endDate : undefined,
  };
}

function getPageStylesText() {
  const isRuleInstance = (rule, constructorName) => {
    const RuleConstructor = window[constructorName];
    return typeof RuleConstructor === "function" && rule instanceof RuleConstructor;
  };

  const serializeRule = (rule) => {
    if (
      isRuleInstance(rule, "CSSImportRule") ||
      isRuleInstance(rule, "CSSFontFaceRule") ||
      /url\(\s*['"]?(?!data:)/i.test(rule.cssText || "")
    ) {
      return "";
    }

    if ("cssRules" in rule) {
      const nestedRules = Array.from(rule.cssRules || [])
        .map(serializeRule)
        .filter(Boolean)
        .join("\n");
      if (!nestedRules) return "";

      if (isRuleInstance(rule, "CSSMediaRule")) {
        return `@media ${rule.conditionText} {\n${nestedRules}\n}`;
      }
      if (isRuleInstance(rule, "CSSSupportsRule")) {
        return `@supports ${rule.conditionText} {\n${nestedRules}\n}`;
      }
    }

    return rule.cssText || "";
  };

  return Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules || [])
          .map(serializeRule)
          .join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Dashboard snapshot image could not be prepared."));
    image.src = src;
  });
}

function serializeDashboardSnapshotContent(clone) {
  const container = document.createElement("div");
  const style = document.createElement("style");

  container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  style.textContent = `
    ${getPageStylesText()}
    * { box-sizing: border-box; }
    *, ::before, ::after { font-family: Arial, Helvetica, sans-serif !important; }
    body { margin: 0; background: #ffffff; }
    [data-export-ignore='true'] { display: none !important; }
  `;
  container.appendChild(style);
  container.appendChild(clone);

  return new XMLSerializer().serializeToString(container);
}

function hideExportIgnoredNodes(element) {
  const ignored = Array.from(element.querySelectorAll("[data-export-ignore='true']"));
  const previous = ignored.map((node) => node.getAttribute("style"));
  ignored.forEach((node) => {
    node.style.display = "none";
  });
  return () => {
    ignored.forEach((node, index) => {
      const previousStyle = previous[index];
      if (previousStyle === null) node.removeAttribute("style");
      else node.setAttribute("style", previousStyle);
    });
  };
}

function replaceLiveCanvasesWithImages(liveRoot, cloneRoot) {
  const liveCanvases = liveRoot.querySelectorAll("canvas");
  const cloneCanvases = cloneRoot.querySelectorAll("canvas");
  liveCanvases.forEach((liveCanvas, index) => {
    const cloneCanvas = cloneCanvases[index];
    if (!cloneCanvas) return;
    try {
      const image = document.createElement("img");
      image.setAttribute("alt", liveCanvas.getAttribute("aria-label") || "Chart");
      image.setAttribute("src", liveCanvas.toDataURL("image/png"));
      const computed = window.getComputedStyle(liveCanvas);
      image.style.width = computed.width;
      image.style.height = computed.height;
      image.style.display = computed.display === "inline" ? "inline-block" : computed.display;
      image.style.maxWidth = "100%";
      cloneCanvas.replaceWith(image);
    } catch {
      // Keep the cloned canvas rather than dropping chart layout.
    }
  });
}

function inlineLiveImages(liveRoot, cloneRoot) {
  const liveImages = liveRoot.querySelectorAll("img");
  const cloneImages = cloneRoot.querySelectorAll("img");
  liveImages.forEach((liveImage, index) => {
    const cloneImage = cloneImages[index];
    if (!cloneImage) return;
    if (String(liveImage.src || "").startsWith("data:")) {
      cloneImage.setAttribute("src", liveImage.src);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = liveImage.naturalWidth || liveImage.width || 1;
      canvas.height = liveImage.naturalHeight || liveImage.height || 1;
      const context = canvas.getContext("2d");
      context.drawImage(liveImage, 0, 0);
      cloneImage.setAttribute("src", canvas.toDataURL("image/png"));
    } catch {
      // Keep the original src if the image cannot be rasterized.
    }
  });
}

function prepareDashboardSnapshotClone(liveRoot, clone) {
  clone.querySelectorAll("[data-export-ignore='true']").forEach((node) => node.remove());
  inlineLiveImages(liveRoot, clone);
  replaceLiveCanvasesWithImages(liveRoot, clone);
  clone.querySelectorAll("iframe, video").forEach((node) => {
    const placeholder = document.createElement("div");
    placeholder.style.width = `${node.offsetWidth || 0}px`;
    placeholder.style.height = `${node.offsetHeight || 0}px`;
    node.replaceWith(placeholder);
  });
}

function collectExportBlocks(root) {
  const candidates = Array.from(root.querySelectorAll("[data-export-block], .bt-card"));
  const blocks = candidates.filter((node) => !candidates.some((other) => other !== node && other.contains(node)));
  const rootRect = root.getBoundingClientRect();
  return blocks
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top - rootRect.top + root.scrollTop,
        left: rect.left - rootRect.left + root.scrollLeft,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((block) => block.width > 2 && block.height > 2)
    .sort((a, b) => a.top - b.top || a.left - b.left);
}

function mergeOverlappingExportBlocks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    const bottom = block.top + block.height;
    const previous = merged[merged.length - 1];
    if (previous && block.top < previous.bottom - 8) {
      previous.top = Math.min(previous.top, block.top);
      previous.bottom = Math.max(previous.bottom, bottom);
      return;
    }
    merged.push({ top: block.top, bottom });
  });
  return merged;
}

function paginateExportSnapshot(totalHeight, blocks, maxContentHeight) {
  const zones = mergeOverlappingExportBlocks(blocks);
  const pages = [];
  let y = 0;

  while (y < totalHeight - 0.5) {
    const remaining = totalHeight - y;
    if (remaining <= 1) break;

    const tallZone = zones.find((zone) => Math.abs(zone.top - y) <= 16 && zone.bottom - Math.min(zone.top, y) > maxContentHeight);
    if (tallZone) {
      pages.push({ top: y, bottom: tallZone.bottom, fit: true });
      y = tallZone.bottom;
      continue;
    }

    const limit = Math.min(y + maxContentHeight, totalHeight);
    let breakAt = limit;
    const crossing = zones.find((zone) => breakAt > zone.top + 1 && breakAt < zone.bottom - 1);
    if (crossing) {
      if (crossing.top <= y + 1) {
        pages.push({ top: y, bottom: crossing.bottom, fit: true });
        y = crossing.bottom;
        continue;
      }
      breakAt = crossing.top;
    }

    const snapBottoms = zones.map((zone) => zone.bottom).filter((bottom) => bottom > y + 32 && bottom <= breakAt + 0.5);
    if (snapBottoms.length) {
      breakAt = Math.max(...snapBottoms);
    }

    if (breakAt <= y + 8) {
      breakAt = Math.min(y + maxContentHeight, totalHeight);
    }

    pages.push({ top: y, bottom: breakAt, fit: false });
    y = breakAt;
  }

  return pages.length ? pages : [{ top: 0, bottom: totalHeight, fit: false }];
}

async function rasterizeCloneToCanvas(clone, width, height, scale) {
  clone.style.width = `${width}px`;
  clone.style.maxWidth = "none";
  clone.style.background = "#ffffff";

  const snapshotContent = serializeDashboardSnapshotContent(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/1999/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        ${snapshotContent}
      </foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function captureElementCanvas(element) {
  const restoreIgnored = hideExportIgnoredNodes(element);
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const width = Math.ceil(element.scrollWidth);
    const height = Math.ceil(element.scrollHeight);
    const blocks = collectExportBlocks(element);
    const scale = 2;
    const clone = element.cloneNode(true);
    prepareDashboardSnapshotClone(element, clone);
    const canvas = await rasterizeCloneToCanvas(clone, width, height, scale);
    canvas.__overviewExportMeta = { scale, cssWidth: width, cssHeight: height, blocks };
    canvas.__overviewPageBreaks = blocks.map((block) => Math.ceil((block.top + block.height) * scale));
    return canvas;
  } finally {
    restoreIgnored();
  }
}

async function captureElementCanvasAttached(element) {
  const restoreIgnored = hideExportIgnoredNodes(element);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-14000px;top:0;background:#ffffff;pointer-events:none;z-index:-1;";
  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const width = Math.ceil(element.scrollWidth);
    const height = Math.ceil(element.scrollHeight);
    const blocks = collectExportBlocks(element);
    const clone = element.cloneNode(true);
    prepareDashboardSnapshotClone(element, clone);
    clone.style.width = `${width}px`;
    host.appendChild(clone);
    document.body.appendChild(host);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const canvas = await rasterizeCloneToCanvas(clone, width, Math.ceil(clone.scrollHeight || height), 2);
    canvas.__overviewExportMeta = {
      scale: 2,
      cssWidth: width,
      cssHeight: Math.ceil(clone.scrollHeight || height),
      blocks,
    };
    return canvas;
  } finally {
    restoreIgnored();
    host.remove();
  }
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createPdfFromCanvas(canvas, pageBreaksOrOptions = []) {
  const options = Array.isArray(pageBreaksOrOptions) ? { pageBreaks: pageBreaksOrOptions } : pageBreaksOrOptions || {};
  const meta = canvas.__overviewExportMeta || {};
  const scale = Number(meta.scale || canvas.height / Math.max(meta.cssHeight || canvas.height, 1)) || 1;
  const cssHeight = Number(meta.cssHeight || canvas.height / scale);
  const rangeLabel = escapePdfText(options.rangeLabel || options.todayLabel || "Selected range");
  const blocks = Array.isArray(meta.blocks) && meta.blocks.length
    ? meta.blocks
    : (options.pageBreaks || canvas.__overviewPageBreaks || []).map((breakPoint, index, items) => {
        const previous = index === 0 ? 0 : items[index - 1];
        return { top: previous / scale, height: (breakPoint - previous) / scale, width: 1, left: 0 };
      });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const headerBand = 36;
  const footerBand = 22;
  const imageWidth = pageWidth - margin * 2;
  const contentHeightPdf = pageHeight - margin * 2 - headerBand - footerBand;
  const maxCssHeight = Math.max(120, (contentHeightPdf * canvas.width) / imageWidth / scale);
  const pages = paginateExportSnapshot(cssHeight, blocks, maxCssHeight);

  const slices = pages.map((page) => {
    const sourceY = Math.max(0, Math.round(page.top * scale));
    const sourceBottom = Math.min(canvas.height, Math.round(page.bottom * scale));
    const sourceHeight = Math.max(1, sourceBottom - sourceY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sourceHeight;
    const context = sliceCanvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    let drawWidth = imageWidth;
    let drawHeight = imageWidth * (sourceHeight / canvas.width);
    if (page.fit || drawHeight > contentHeightPdf) {
      const fitScale = contentHeightPdf / drawHeight;
      drawWidth *= fitScale;
      drawHeight *= fitScale;
    }

    return {
      width: sliceCanvas.width,
      height: sliceCanvas.height,
      bytes: dataUrlToBytes(sliceCanvas.toDataURL("image/jpeg", 0.95)),
      drawWidth,
      drawHeight,
      drawX: margin + (imageWidth - drawWidth) / 2,
    };
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
  const appendBytes = (bytes) => {
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const appendObject = (id, contentParts) => {
    offsets[id] = byteOffset;
    appendString(`${id} 0 obj\n`);
    contentParts.forEach((part) => {
      if (typeof part === "string") appendString(part);
      else appendBytes(part);
    });
    appendString("\nendobj\n");
  };

  appendString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = slices.map((_, index) => 5 + index * 3);
  appendObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  appendObject(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);
  appendObject(3, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]);
  appendObject(4, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]);

  slices.forEach((slice, index) => {
    const pageId = 5 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const drawY = pageHeight - margin - headerBand - slice.drawHeight;
    const headerY = pageHeight - margin - 8;
    const footerY = margin + 6;
    const pageLabel = `Page ${index + 1} of ${slices.length}`;
    const headerTitle = "Bawat Tala Overview";
    const content = [
      `BT /F2 10 Tf 1 0 0 1 ${margin.toFixed(2)} ${headerY.toFixed(2)} Tm (${headerTitle}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 ${margin.toFixed(2)} ${(headerY - 12).toFixed(2)} Tm (${rangeLabel}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 ${(pageWidth - margin - 70).toFixed(2)} ${headerY.toFixed(2)} Tm (${escapePdfText(pageLabel)}) Tj ET`,
      `q`,
      `${slice.drawWidth.toFixed(2)} 0 0 ${slice.drawHeight.toFixed(2)} ${slice.drawX.toFixed(2)} ${drawY.toFixed(2)} cm`,
      `/${imageName} Do`,
      `Q`,
      `BT /F1 8 Tf 1 0 0 1 ${margin.toFixed(2)} ${footerY.toFixed(2)} Tm (${rangeLabel}  |  ${escapePdfText(pageLabel)}) Tj ET`,
    ].join("\n");

    appendObject(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    appendObject(contentId, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
    appendObject(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${slice.width} /Height ${slice.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.bytes.length} >>\nstream\n`,
      slice.bytes,
      "\nendstream",
    ]);
  });

  const xrefOffset = byteOffset;
  const maxObjectId = 4 + slices.length * 3;
  appendString(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxObjectId; id += 1) {
    appendString(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  appendString(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/[\\()]/g, "\\$&")
    .replace(/\s+/g, " ")
    .trim();
}

function createOverviewReportPdf({
  activeUsageSeries,
  analyticsCards,
  analyticsOverview,
  barangayConcernData,
  genderData,
  journalEntriesData,
  moodTrendData,
  primaryConcernsData,
  riskSignalCards,
  sentimentDistributionData,
  summaryCards,
  todayLabel,
}) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const bottomMargin = 44;
  const pages = [];
  let commands = [];
  let y = pageHeight - margin;

  const beginPage = () => {
    commands = [];
    y = pageHeight - margin;
    pages.push(commands);
  };
  const addText = (text, x = margin, size = 10, bold = false) => {
    commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  };
  const addRule = () => {
    commands.push(`${margin} ${(y - 8).toFixed(2)} m ${pageWidth - margin} ${(y - 8).toFixed(2)} l S`);
    y -= 20;
  };
  const ensureSpace = (required = 40) => {
    if (y - required < bottomMargin) beginPage();
  };
  const addWrappedText = (text, x = margin, size = 10, bold = false, maxChars = 96) => {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      if (nextLine.length > maxChars) {
        ensureSpace(16);
        addText(line, x, size, bold);
        y -= size + 5;
        line = word;
      } else {
        line = nextLine;
      }
    }
    if (line) {
      ensureSpace(16);
      addText(line, x, size, bold);
      y -= size + 5;
    }
  };
  const addSection = (title) => {
    ensureSpace(42);
    y -= 8;
    addText(title, margin, 14, true);
    y -= 10;
    addRule();
  };
  const addMetricRows = (cards) => {
    for (const item of cards) {
      ensureSpace(22);
      const delta = item.delta && item.delta !== "--" ? ` (${item.delta})` : "";
      addText(`${item.title}: ${item.value}${delta}`, margin, 11);
      y -= 18;
    }
  };
  const addChartRows = (title, rows, valueFormatter = (item) => item.value) => {
    if (!rows?.length) return;
    addSection(title);
    rows.slice(0, 12).forEach((item) => {
      const label = item.label || item.name || item.key || "Item";
      addWrappedText(`${label}: ${valueFormatter(item)}`, margin, 10, false, 92);
    });
  };

  beginPage();
  addText("Bawat Tala Overview Dashboard", margin, 20, true);
  y -= 24;
  addText(todayLabel, margin, 11);
  y -= 16;
  addRule();

  addSection("Dashboard Metrics");
  addMetricRows([...summaryCards, ...analyticsCards]);

  if (riskSignalCards?.length) {
    addSection("Student Support Signals");
    addMetricRows(riskSignalCards);
  }

  addChartRows("Journal Entries Volume", journalEntriesData);
  addChartRows("Gender Distribution", genderData);
  addChartRows("Mood Trends", moodTrendData, (item) =>
    Array.isArray(item.values) ? item.values.reduce((sum, value) => sum + Number(value || 0), 0) : item.value,
  );
  addChartRows("Active Usage By Course Year", activeUsageSeries, (item) =>
    Object.entries(item)
      .filter(([key]) => !["color", "key", "label", "name"].includes(key))
      .map(([key, value]) => `${key} ${value}`)
      .join(", "),
  );
  addChartRows("Primary Student Concerns", primaryConcernsData);
  addChartRows("Sentiment Distribution", sentimentDistributionData);
  addChartRows("Top Concerns By Barangay", barangayConcernData, (item) =>
    item.percent !== undefined ? `${item.value} (${item.percent}%)` : item.value,
  );

  const consultationVolumeData = buildConsultationVolumeCategoryData(analyticsOverview?.charts?.consultationVolumeByCategory || []);
  const counselorWorkloadData = analyticsOverview?.charts?.counselorWorkload || [];
  const atRiskLabels = analyticsOverview?.charts?.atRiskStudentTrends?.labels || [];
  const atRiskSeries = analyticsOverview?.charts?.atRiskStudentTrends?.series || [];
  const atRiskRows = atRiskLabels.map((label, index) => ({
    label,
    value: atRiskSeries.map((item) => `${item.label || item.key}: ${Number(item.values?.[index] || 0)}`).join(", "),
  }));
  addChartRows("Consultation Volume by Category", consultationVolumeData);
  addChartRows("Counselor Workload", counselorWorkloadData);
  addChartRows("At-Risk Student Trends", atRiskRows);

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

  appendString("%PDF-1.4\n");
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
  appendString(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

function drawRoundRect(context, x, y, width, height, radius = 16) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - resolvedRadius, y + height);
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function fillRoundRect(context, x, y, width, height, radius, fillStyle, strokeStyle = null) {
  drawRoundRect(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = nextLine;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => {
    context.fillText(item, x, y + index * lineHeight);
  });
  return lines.length * lineHeight;
}

function getNumericValue(item) {
  if (Array.isArray(item?.values)) {
    return item.values.reduce((sum, value) => sum + Number(value || 0), 0);
  }

  const rawValue = item?.value ?? item?.count;
  if (rawValue === undefined || rawValue === null) {
    return Object.entries(item || {}).reduce((sum, [key, value]) => {
      if (["color", "key", "label", "name", "role", "supportType", "targetLabel"].includes(key)) {
        return sum;
      }
      const numericValue = Number(value || 0);
      return Number.isFinite(numericValue) ? sum + numericValue : sum;
    }, 0);
  }

  const parsedValue = typeof rawValue === "number" ? rawValue : Number(String(rawValue).replace(/,/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function drawPanel(context, { x, y, width, height, title, subtitle }) {
  fillRoundRect(context, x, y, width, height, 18, "#ffffff", "#dbe7d2");
  context.fillStyle = "#134611";
  context.font = "700 24px Arial, Helvetica, sans-serif";
  context.fillText(title, x + 28, y + 42);
  if (subtitle) {
    context.fillStyle = "#5f7a5f";
    context.font = "500 15px Arial, Helvetica, sans-serif";
    context.fillText(subtitle, x + 28, y + 68);
  }
}

function drawEmptyChartState(context, x, y, width, height, label = "No live data available yet.") {
  fillRoundRect(context, x, y, width, height, 14, "#f8fafc", "#e2e8f0");
  context.fillStyle = "#64748b";
  context.font = "600 17px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.fillText(label, x + width / 2, y + height / 2);
  context.textAlign = "left";
}

function drawMetricCards(context, cards, x, y, width) {
  const gap = 18;
  const columns = 4;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = 136;

  cards.forEach((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + column * (cardWidth + gap);
    const cardY = y + row * (cardHeight + gap);
    const accent =
      card.tone === "amber"
        ? "#f59e0b"
        : card.tone === "green"
          ? "#229365"
          : card.direction === "down"
            ? "#64748b"
            : "#3e8914";

    fillRoundRect(context, cardX, cardY, cardWidth, cardHeight, 18, "#ffffff", "#dbe7d2");
    fillRoundRect(context, cardX + 22, cardY + 22, 42, 42, 13, `${accent}22`);
    context.fillStyle = accent;
    context.beginPath();
    context.arc(cardX + 43, cardY + 43, 8, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#334155";
    context.font = "700 16px Arial, Helvetica, sans-serif";
    drawWrappedCanvasText(context, card.title, cardX + 78, cardY + 36, cardWidth - 104, 19, 2);

    context.fillStyle = "#111827";
    context.font = "800 38px Arial, Helvetica, sans-serif";
    context.fillText(String(card.value ?? "--"), cardX + 22, cardY + 108);

    context.fillStyle = accent;
    context.font = "700 15px Arial, Helvetica, sans-serif";
    context.textAlign = "right";
    context.fillText(String(card.delta ?? "--"), cardX + cardWidth - 22, cardY + 108);
    context.textAlign = "left";
  });

  return y + Math.ceil(cards.length / columns) * cardHeight + (Math.ceil(cards.length / columns) - 1) * gap;
}

function drawVerticalBarChart(context, data, x, y, width, height, options = {}) {
  const items = (Array.isArray(data) ? data : [])
    .map((item) => ({ ...item, value: getNumericValue(item) }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, options.limit || 10);
  if (!items.length) {
    drawEmptyChartState(context, x, y, width, height);
    return;
  }

  const left = x + 56;
  const right = x + width - 22;
  const top = y + 18;
  const bottom = y + height - 72;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const max = Math.max(...items.map(getNumericValue), 1);

  context.strokeStyle = "#d8e0ec";
  context.lineWidth = 1;
  context.fillStyle = "#64748b";
  context.font = "700 13px Arial, Helvetica, sans-serif";
  for (let index = 0; index <= 4; index += 1) {
    const guide = Math.round((max * index) / 4);
    const guideY = bottom - (plotHeight * index) / 4;
    context.beginPath();
    context.moveTo(left, guideY);
    context.lineTo(right, guideY);
    context.stroke();
    context.fillText(String(guide), x + 12, guideY + 4);
  }

  const slot = plotWidth / items.length;
  const barWidth = Math.min(54, slot * 0.64);
  items.forEach((item, index) => {
    const value = getNumericValue(item);
    const barHeight = Math.max(4, (value / max) * plotHeight);
    const barX = left + index * slot + (slot - barWidth) / 2;
    const barY = bottom - barHeight;
    const color = item.color || options.color || "#229365";
    fillRoundRect(context, barX, barY, barWidth, barHeight, 10, color);

    context.fillStyle = "#134611";
    context.font = "800 14px Arial, Helvetica, sans-serif";
    context.textAlign = "center";
    context.fillText(formatMetricValue(value), barX + barWidth / 2, barY - 8);

    const label = String(item.label || item.name || item.key || "").replace(/\s*\/\s*/g, "/");
    context.save();
    context.translate(barX + barWidth / 2, bottom + 18);
    context.rotate(-Math.PI / 5);
    context.fillStyle = "#334155";
    context.font = "700 12px Arial, Helvetica, sans-serif";
    context.fillText(label.slice(0, 18), 0, 0);
    context.restore();
    context.textAlign = "left";
  });
}

function drawHorizontalBars(context, data, x, y, width, height, options = {}) {
  const items = (Array.isArray(data) ? data : [])
    .map((item) => ({ ...item, value: getNumericValue(item) }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, options.limit || 8);
  if (!items.length) {
    drawEmptyChartState(context, x, y, width, height);
    return;
  }

  const max = Math.max(...items.map(getNumericValue), 1);
  const rowHeight = Math.min(42, height / items.length);

  items.forEach((item, index) => {
    const rowY = y + index * rowHeight;
    const label = String(item.label || item.name || item.key || "Item");
    const value = getNumericValue(item);
    const percent = Math.max(0.04, value / max);

    context.fillStyle = "#334155";
    context.font = "700 14px Arial, Helvetica, sans-serif";
    context.fillText(label.slice(0, 36), x, rowY + 17);
    context.fillStyle = "#64748b";
    context.font = "700 13px Arial, Helvetica, sans-serif";
    context.textAlign = "right";
    context.fillText(formatMetricValue(value), x + width, rowY + 17);
    context.textAlign = "left";

    fillRoundRect(context, x, rowY + 25, width, 10, 8, "#edf4e9");
    fillRoundRect(context, x, rowY + 25, width * percent, 10, 8, item.color || options.color || "#229365");
  });
}

function drawDonutCanvasChart(context, data, x, y, size) {
  const items = (Array.isArray(data) ? data : []).map((item) => ({ ...item, value: getNumericValue(item) }));
  if (!items.length) {
    drawEmptyChartState(context, x, y, size + 220, size);
    return;
  }

  const totalValue = items.reduce((sum, item) => sum + getNumericValue(item), 0);
  const total = Math.max(1, totalValue);
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  let angle = -Math.PI / 2;

  context.lineWidth = 34;
  context.beginPath();
  context.strokeStyle = "#dcfce7";
  context.arc(centerX, centerY, size / 2 - 22, 0, Math.PI * 2);
  context.stroke();

  items.forEach((item, index) => {
    const value = getNumericValue(item);
    if (value <= 0) return;
    const nextAngle = angle + (value / total) * Math.PI * 2;
    context.beginPath();
    context.strokeStyle = item.color || PRIMARY_STUDENT_CONCERN_COLORS[index % PRIMARY_STUDENT_CONCERN_COLORS.length];
    context.arc(centerX, centerY, size / 2 - 22, angle, nextAngle);
    context.stroke();
    angle = nextAngle;
  });

  context.fillStyle = "#134611";
  context.font = "800 34px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.fillText(formatMetricValue(totalValue), centerX, centerY + 10);
  context.textAlign = "left";

  items.slice(0, 5).forEach((item, index) => {
    const legendY = y + 28 + index * 34;
    fillRoundRect(context, x + size + 34, legendY - 12, 18, 18, 6, item.color || PRIMARY_STUDENT_CONCERN_COLORS[index]);
    context.fillStyle = "#334155";
    context.font = "700 15px Arial, Helvetica, sans-serif";
    context.fillText(`${item.label}: ${formatMetricValue(getNumericValue(item))}`, x + size + 62, legendY + 3);
  });
}

function drawRiskLineChart(context, trendData, x, y, width, height) {
  const labels = trendData?.labels || [];
  const series = trendData?.series || [];
  const crisisValues =
    series.find((item) => item.key === "crisis")?.values ||
    series.find((item) => item.key === "critical")?.values ||
    [];
  const distressedValues =
    series.find((item) => item.key === "distressed")?.values ||
    series.find((item) => item.key === "high")?.values ||
    [];
  const pointCount = Math.max(labels.length, crisisValues.length, distressedValues.length, 0);

  if (!pointCount) {
    drawEmptyChartState(context, x, y, width, height);
    return;
  }

  const chartLabels = Array.from({ length: pointCount }, (_, index) => labels[index] || `W${index + 1}`);
  const values = [...crisisValues, ...distressedValues].map(Number);
  const max = Math.max(...values, 1);
  const left = x + 46;
  const right = x + width - 22;
  const top = y + 22;
  const bottom = y + height - 48;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const xForIndex = (index) => left + (index * plotWidth) / Math.max(1, pointCount - 1);
  const yForValue = (value) => bottom - (Number(value || 0) / max) * plotHeight;

  context.strokeStyle = "#d8e0ec";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const guideY = bottom - (plotHeight * index) / 4;
    context.beginPath();
    context.moveTo(left, guideY);
    context.lineTo(right, guideY);
    context.stroke();
  }

  const drawLine = (lineValues, color) => {
    context.beginPath();
    lineValues.forEach((value, index) => {
      const px = xForIndex(index);
      const py = yForValue(value);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.strokeStyle = color;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();

    lineValues.forEach((value, index) => {
      context.beginPath();
      context.fillStyle = "#ffffff";
      context.strokeStyle = color;
      context.lineWidth = 4;
      context.arc(xForIndex(index), yForValue(value), 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  };

  drawLine(distressedValues, RISK_COLORS.distressed);
  drawLine(crisisValues, RISK_COLORS.crisis);

  context.fillStyle = "#64748b";
  context.font = "700 13px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  chartLabels.forEach((label, index) => {
    context.fillText(label, xForIndex(index), bottom + 28);
  });
  context.textAlign = "left";
}

function drawSupportSignalCards(context, cards, x, y, width, height) {
  const gap = 16;
  const cardHeight = (height - gap * 2) / 3;
  const tones = [
    { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
    { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
    { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  ];

  cards.forEach((card, index) => {
    const tone = tones[index] || tones[2];
    const cardY = y + index * (cardHeight + gap);
    fillRoundRect(context, x, cardY, width, cardHeight, 16, tone.bg, tone.border);
    context.fillStyle = tone.text;
    context.font = "800 18px Arial, Helvetica, sans-serif";
    context.fillText(card.title, x + 22, cardY + 34);
    context.fillStyle = tone.text;
    context.font = "800 38px Arial, Helvetica, sans-serif";
    context.textAlign = "right";
    context.fillText(String(card.value ?? "--"), x + width - 24, cardY + 58);
    context.textAlign = "left";
  });
}

function createOverviewDashboardCanvas({
  activeUsageSeries,
  analyticsCards,
  analyticsOverview,
  barangayConcernData,
  genderData,
  journalEntriesData,
  moodTrendData,
  primaryConcernsData,
  riskSignalCards,
  sentimentDistributionData,
  studentDemographicLocations,
  summaryCards,
  todayLabel,
  rangeLabel,
}) {
  const scale = 2;
  const width = 1400;
  const margin = 64;
  const contentWidth = width - margin * 2;
  const gap = 28;
  const panelHalfWidth = (contentWidth - gap) / 2;
  const consultationVolumeData = buildConsultationVolumeCategoryData(analyticsOverview?.charts?.consultationVolumeByCategory || []);
  const counselorWorkloadData = analyticsOverview?.charts?.counselorWorkload || [];
  const atRiskTrendData = analyticsOverview?.charts?.atRiskStudentTrends || {};
  const responseRateData = analyticsOverview?.charts?.resolutionRates || [];
  const height = 5600;
  const pageBreaks = [];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);

  context.fillStyle = "#f4f6ef";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#134611";
  context.font = "900 46px Arial, Helvetica, sans-serif";
  context.fillText("Overview & Analytics", margin, 82);
  context.fillStyle = "#5f7a5f";
  context.font = "600 19px Arial, Helvetica, sans-serif";
  context.fillText(`Bawat Tala Overview Dashboard - ${todayLabel}`, margin, 118);

  let y = 158;
  y = drawMetricCards(context, [...summaryCards, ...analyticsCards], margin, y, contentWidth) + 44;

  context.fillStyle = "#134611";
  context.font = "900 30px Arial, Helvetica, sans-serif";
  context.fillText("Activity and Engagement Overview", margin, y);
  fillRoundRect(context, margin + 430, y - 16, 70, 7, 8, "#b7e4c7");
  y += 28;

  drawPanel(context, {
    x: margin,
    y,
    width: panelHalfWidth,
    height: 440,
    title: "Journal Entries Volume",
    subtitle: "Total journal entries per week",
  });
  drawVerticalBarChart(context, journalEntriesData, margin + 28, y + 92, panelHalfWidth - 56, 306, { color: "#229365" });

  drawPanel(context, {
    x: margin + panelHalfWidth + gap,
    y,
    width: panelHalfWidth,
    height: 440,
    title: "Student Gender Demographics",
    subtitle: "Student profile distribution",
  });
  drawDonutCanvasChart(context, genderData, margin + panelHalfWidth + gap + 44, y + 112, 230);
  y += 440 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: contentWidth,
    height: 450,
    title: "Student Emotion Trends",
    subtitle: "Total emotion check-ins recorded, ranked highest to lowest",
  });
  drawVerticalBarChart(context, moodTrendData, margin + 28, y + 92, contentWidth - 56, 312, { limit: 10 });
  y += 450 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: contentWidth,
    height: 360,
    title: "Sentiment Distribution",
    subtitle: "Overall emotional tone from Muni sentiment analysis",
  });
  drawDonutCanvasChart(context, sentimentDistributionData, margin + 360, y + 92, 210);
  y += 360 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Student Demographics by Location",
    subtitle: "Distribution by submitted location",
  });
  drawHorizontalBars(context, studentDemographicLocations, margin + 28, y + 96, panelHalfWidth - 56, 246, { color: "#3e8914" });

  drawPanel(context, {
    x: margin + panelHalfWidth + gap,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Student Distribution by Program",
    subtitle: "Enrolled students grouped by program",
  });
  drawHorizontalBars(context, activeUsageSeries, margin + panelHalfWidth + gap + 28, y + 96, panelHalfWidth - 56, 246, {
    color: "#229365",
  });
  y += 390 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: contentWidth,
    height: 450,
    title: "Primary Student Concerns",
    subtitle: "Derived from the most frequently occurring journal tags",
  });
  drawVerticalBarChart(context, primaryConcernsData, margin + 28, y + 92, contentWidth - 56, 312, { limit: 12 });
  y += 450 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Top Concerns by Barangay",
    subtitle: "Most active barangays based on journal entries",
  });
  drawHorizontalBars(context, barangayConcernData, margin + 28, y + 96, panelHalfWidth - 56, 246, { color: "#229365" });

  drawPanel(context, {
    x: margin + panelHalfWidth + gap,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Support Signals",
    subtitle: "Entries that may need faster response",
  });
  drawSupportSignalCards(context, riskSignalCards, margin + panelHalfWidth + gap + 28, y + 96, panelHalfWidth - 56, 246);
  y += 390 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: contentWidth,
    height: 450,
    title: "Consultation Volume by Category",
    subtitle: `Concerns addressed in scheduled appointments for ${rangeLabel || todayLabel || "this period"}`,
  });
  drawVerticalBarChart(context, consultationVolumeData, margin + 28, y + 92, contentWidth - 56, 312, { limit: 12 });
  y += 450 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Counselor Workload",
    subtitle: `Confirmed/completed sessions for ${rangeLabel || todayLabel || "this period"} (one count per booking)`,
  });
  drawHorizontalBars(context, counselorWorkloadData, margin + 28, y + 96, panelHalfWidth - 56, 246, { color: "#20c08d" });

  drawPanel(context, {
    x: margin + panelHalfWidth + gap,
    y,
    width: panelHalfWidth,
    height: 390,
    title: "Response Within Target Time",
    subtitle: "Counselor response speed for tagged risk cases",
  });
  drawHorizontalBars(
    context,
    responseRateData.map((item) => ({ ...item, value: Number(item.value || 0), label: `${item.label} (${item.targetLabel})` })),
    margin + panelHalfWidth + gap + 28,
    y + 96,
    panelHalfWidth - 56,
    246,
    { color: "#20c08d" },
  );
  y += 390 + gap;
  pageBreaks.push(y * scale);

  drawPanel(context, {
    x: margin,
    y,
    width: contentWidth,
    height: 390,
    title: "At-Risk Student Trends",
    subtitle: "Weekly tracking of high and critical severity cases",
  });
  drawRiskLineChart(context, atRiskTrendData, margin + 28, y + 96, contentWidth - 56, 240);

  y += 390 + margin;

  const outputCanvas = document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d");
  const renderedHeight = Math.min(height, Math.ceil(y));
  outputCanvas.width = canvas.width;
  outputCanvas.height = renderedHeight * scale;
  outputContext.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height, 0, 0, outputCanvas.width, outputCanvas.height);
  outputCanvas.__overviewPageBreaks = pageBreaks.filter((breakPoint) => breakPoint < outputCanvas.height - 80);
  const cssBreaks = [...pageBreaks.map((breakPoint) => breakPoint / scale), renderedHeight];
  const visualBlocks = [];
  let previousBreak = 0;
  cssBreaks.forEach((point) => {
    if (point > previousBreak + 8) {
      visualBlocks.push({ top: previousBreak, height: point - previousBreak, width, left: 0 });
      previousBreak = point;
    }
  });
  outputCanvas.__overviewExportMeta = {
    scale,
    cssWidth: width,
    cssHeight: renderedHeight,
    blocks: visualBlocks,
  };

  return outputCanvas;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildConcernCategoryData(data, definitions) {
  const countsByLabel = new Map(
    (Array.isArray(data) ? data : []).map((item) => [String(item.label || "").trim(), Number(item.value || 0)]),
  );

  return definitions.map((definition, index) => {
    const value = definition.sources.reduce((sum, source) => sum + Number(countsByLabel.get(source) || 0), 0);
    return {
      key: toChartKey(definition.label, index),
      label: definition.label,
      order: index,
      value,
      color: PRIMARY_STUDENT_CONCERN_COLORS[index % PRIMARY_STUDENT_CONCERN_COLORS.length],
    };
  }).sort((a, b) => b.value - a.value || a.order - b.order);
}

function buildConsultationVolumeCategoryData(data) {
  return buildConcernCategoryData(data, CONSULTATION_VOLUME_CATEGORY_DEFS);
}

export default function Overview({ onLogout, session }) {
  const navigate = useNavigate();
  const overviewExportRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
  const todayIso = getCurrentMonthAnalyticsParams().endDate;
  const [rangeKey, setRangeKey] = useState("30d");
  const [customRange, setCustomRange] = useState({ startDate: todayIso, endDate: todayIso });
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [riskFlags, setRiskFlags] = useState([]);
  const [riskFlagsError, setRiskFlagsError] = useState("");
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRangeBoundOverview() {
      const params = getRangeQueryParams(rangeKey, customRange);
      try {
        setSummaryLoading(true);
        setAnalyticsLoading(true);
        const [summaryData, analyticsData] = await Promise.all([
          fetchAdminDashboardSummary(params),
          fetchAdminAnalytics(params),
        ]);
        if (!isMounted) return;
        setDashboardSummary(summaryData);
        setSummaryError("");
        setAnalyticsOverview(analyticsData);
        setAnalyticsError("");
      } catch (error) {
        if (!isMounted) return;
        setDashboardSummary(null);
        setSummaryError(error instanceof Error ? error.message : "Failed to load dashboard summary.");
        setAnalyticsError(error instanceof Error ? error.message : "Failed to load overview analytics.");
      } finally {
        if (isMounted) {
          setSummaryLoading(false);
          setAnalyticsLoading(false);
        }
      }
    }

    loadRangeBoundOverview();
    return () => {
      isMounted = false;
    };
  }, [rangeKey]);

  async function loadAnalyticsRange(nextRangeKey, nextCustomRange = customRange) {
    const params = getRangeQueryParams(nextRangeKey, nextCustomRange);
    try {
      setSummaryLoading(true);
      setAnalyticsLoading(true);
      const [summaryData, analyticsData] = await Promise.all([
        fetchAdminDashboardSummary(params),
        fetchAdminAnalytics(params),
      ]);
      setDashboardSummary(summaryData);
      setSummaryError("");
      setAnalyticsOverview(analyticsData);
      setAnalyticsError("");
    } catch (error) {
      setDashboardSummary(null);
      setSummaryError(error instanceof Error ? error.message : "Failed to load dashboard summary.");
      setAnalyticsError(error instanceof Error ? error.message : "Failed to load overview analytics.");
    } finally {
      setSummaryLoading(false);
      setAnalyticsLoading(false);
    }
  }

  function handleRangeChange(nextRangeKey) {
    setRangeKey(nextRangeKey);
  }

  function handleCustomDateChange(field, value) {
    setCustomRange((current) => ({ ...current, [field]: value }));
  }

  function handleCustomRangeApply() {
    if (!customRange.startDate || !customRange.endDate || customRange.startDate > customRange.endDate) {
      setAnalyticsError("Choose a valid custom date range before applying the filter.");
      return;
    }
    void loadAnalyticsRange("custom", customRange);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadRiskFlags() {
      try {
        const data = await fetchAdminRiskFlags();
        if (!isMounted) return;
        setRiskFlags(Array.isArray(data?.entries) ? data.entries : []);
        setRiskFlagsError("");
      } catch (error) {
        if (!isMounted) return;
        setRiskFlagsError(error instanceof Error ? error.message : "Failed to load flagged entries.");
      }
    }

    loadRiskFlags();
    return () => {
      isMounted = false;
    };
  }, []);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(now);
  const selectedRangeRows = Array.isArray(analyticsOverview?.reports?.students)
    ? analyticsOverview.reports.students
    : [];
  const selectedRangeTotals = selectedRangeRows.reduce(
    (totals, row) => ({
      entries: totals.entries + Number(row.entriesInRange || 0),
      flags: totals.flags + Number(row.flagsInRange || 0),
      crisis: totals.crisis + Number(row.highRiskFlags || 0),
      distressed: totals.distressed + Number(row.mediumRiskFlags || 0),
      contacted: totals.contacted + Number(row.contactedSupport || 0),
    }),
    { entries: 0, flags: 0, crisis: 0, distressed: 0, contacted: 0 },
  );
  const selectedRangeLabel = analyticsOverview?.filters
    ? `${analyticsOverview.filters.startDate} to ${analyticsOverview.filters.endDate}`
    : "Loading selected range...";
  const hasScheduledInRange =
    dashboardSummary?.cards?.scheduledInRange !== undefined && dashboardSummary?.cards?.scheduledInRange !== null;
  const isTodayOnlyRange =
    rangeKey === "today" ||
    (rangeKey === "custom" && customRange.startDate === customRange.endDate && customRange.startDate === todayIso);
  const scheduledCardSource =
    !isTodayOnlyRange && hasScheduledInRange
      ? dashboardSummary.cards.scheduledInRange
      : dashboardSummary?.cards?.scheduledToday;
  const summaryCards = SUMMARY_CARD_DEFS.map((item) => {
    const isRangeMetric = item.key === "flagged" || item.key === "entries";
    const cardLoading = isRangeMetric ? analyticsLoading : summaryLoading;
    const source =
      item.key === "flagged"
        ? {
            value: selectedRangeTotals.flags,
            direction: "neutral",
            percentageText: "Selected range",
          }
        : item.key === "students"
          ? dashboardSummary?.cards?.totalStudents
          : item.key === "entries"
            ? {
                value: selectedRangeTotals.entries,
                direction: "neutral",
                percentageText: "Selected range",
              }
            : item.key === "futureMessages"
              ? dashboardSummary?.cards?.futureSelfMessages
              : item.key === "scheduled"
                ? scheduledCardSource
                : dashboardSummary?.cards?.muniAccuracy;
    const direction = source?.direction || "neutral";
    const hasValue = source?.value !== undefined && source?.value !== null;

    return {
      ...item,
      title:
        item.key === "scheduled" && !isTodayOnlyRange && hasScheduledInRange ? "Scheduled in Range" : item.title,
      value: cardLoading
        ? "--"
        : hasValue
          ? item.valueType === "percent"
            ? `${formatMetricValue(source.value)}%`
            : formatMetricValue(source.value)
          : "--",
      delta: cardLoading ? "--" : source?.percentageText || "--",
      direction: cardLoading || !hasValue ? "neutral" : direction,
      tone: cardLoading || !hasValue ? "gray" : mapMetricTone(item.key, direction),
    };
  });
  const analyticsCards = ANALYTICS_CARD_DEFS.map((item) => {
    const source = analyticsOverview?.cards?.[item.key];
    const hasValue = source?.value !== undefined && source?.value !== null;
    const deltaValue = Number(source?.deltaValue || 0);
    const direction =
      item.key === "averageEntriesPerStudent"
        ? deltaValue >= 0
          ? "up"
          : "down"
        : source?.direction || "neutral";

    return {
      ...item,
      title: source?.label || item.title,
      value: analyticsLoading
        ? "--"
        : hasValue
          ? item.valueType === "decimal"
            ? formatMetricDecimal(source.value)
            : formatMetricValue(source.value)
          : "--",
      delta: analyticsLoading
        ? "--"
        : hasValue
          ? item.key === "averageEntriesPerStudent"
            ? `${deltaValue >= 0 ? "+" : ""}${formatMetricDecimal(deltaValue)}`
            : source?.percentageText || "--"
          : "--",
      direction: analyticsLoading || !hasValue ? "neutral" : direction,
      tone: analyticsLoading || !hasValue ? "gray" : mapMetricTone(item.key, direction),
    };
  });
  const journalEntriesData =
    analyticsOverview?.charts?.journalEntryVolume?.length > 0 ? analyticsOverview.charts.journalEntryVolume : [];
  const genderData =
    dashboardSummary?.charts?.genderDistribution?.length > 0
      ? withColors(dashboardSummary.charts.genderDistribution, ["#3E8914", "#3DA35D", "#A7F3D0"])
      : [];
  const moodTrendData =
    dashboardSummary?.charts?.moodTrends?.series?.length > 0
      ? withColors(
          dashboardSummary.charts.moodTrends.series,
          ["#FDBA58", "#FFD616", "#97CFDA", "#78C6A3", "#F0A0B8", "#B895C8", "#A7B4C6", "#7EA9D9", "#F19137", "#E86686"],
        )
      : [];
  const sentimentDistributionData =
    dashboardSummary?.charts?.sentimentDistribution?.length > 0
      ? withColors(dashboardSummary.charts.sentimentDistribution, ["#22C55E", "#64748B", "#EF4444", "#F59E0B"])
      : [];
  const hasSentimentDistributionData = sentimentDistributionData.some((item) => Number(item.value || 0) > 0);
  const studentDemographicLocations =
    dashboardSummary?.charts?.studentDemographics?.locations?.length > 0
      ? dashboardSummary.charts.studentDemographics.locations
      : [];
  const activeUsageSeries =
    dashboardSummary?.charts?.activeUsageByCourseYear?.series?.length > 0
      ? withColors(dashboardSummary.charts.activeUsageByCourseYear.series, ["#3E8914", "#3DA35D", "#96E072", "#134611"])
      : [];
  const primaryConcernsData = withColors(
    (analyticsOverview?.charts?.concernTrends?.series || [])
      .map((item) => ({
        ...item,
        value: Array.isArray(item.values) ? item.values.reduce((sum, value) => sum + Number(value || 0), 0) : 0,
      }))
      .sort((a, b) => b.value - a.value),
    PRIMARY_STUDENT_CONCERN_COLORS,
  );
  const hasPrimaryConcernData = primaryConcernsData.some((item) => item.value > 0);
  const barangayConcernData =
    dashboardSummary?.charts?.topConcernsByBarangay?.length > 0
      ? dashboardSummary.charts.topConcernsByBarangay.map((item, index, items) => ({
          ...item,
          percent: items[0]?.value ? Math.round((item.value / items[0].value) * 100) : 0,
        }))
      : [];
  const crisisSignalCount = analyticsOverview
    ? selectedRangeTotals.crisis
    : riskFlags.filter((entry) => ["HIGH", "CRITICAL"].includes(String(entry.riskLevel || "").toUpperCase())).length;
  const distressedSignalCount = analyticsOverview
    ? selectedRangeTotals.distressed
    : riskFlags.filter((entry) => ["LOW", "MEDIUM", "MODERATE"].includes(String(entry.riskLevel || "").toUpperCase())).length;
  const contactedSignalCount = analyticsOverview
    ? selectedRangeTotals.contacted
    : riskFlags.filter((entry) => String(entry.supportResponse || "").toUpperCase() === "CONTACTED").length;
  const handleSummaryCardSelect = (cardTitle) => {
    if (cardTitle === "Flagged Entries") {
      navigate("/flagged");
      return;
    }
    if (cardTitle === "Scheduled Today") {
      navigate("/appointments");
    }
  };

  const handleExportPdf = async () => {
    if (!overviewExportRef.current || isExportingPdf) return;
    if (summaryLoading || analyticsLoading) {
      window.alert("Please wait for the dashboard charts to finish loading before exporting the PDF.");
      return;
    }

    const reportStartDate = analyticsOverview?.filters?.startDate || todayIso;
    const reportEndDate = analyticsOverview?.filters?.endDate || todayIso;
    const reportPdfOptions = {
      activeUsageSeries,
      analyticsCards,
      analyticsOverview,
      barangayConcernData,
      genderData,
      journalEntriesData,
      moodTrendData,
      primaryConcernsData,
      riskSignalCards: [
        { title: "Crisis / Critical Need", value: riskFlagsError ? "--" : formatMetricValue(crisisSignalCount) },
        { title: "Distressed / Needs Support", value: riskFlagsError ? "--" : formatMetricValue(distressedSignalCount) },
        { title: "Contacted Support", value: riskFlagsError ? "--" : formatMetricValue(contactedSignalCount) },
      ],
      sentimentDistributionData,
      studentDemographicLocations,
      summaryCards,
      todayLabel: `${todayLabel} | Analytics range: ${reportStartDate} to ${reportEndDate}`,
      rangeLabel: selectedRangeLabel && selectedRangeLabel !== "Loading selected range..."
        ? selectedRangeLabel
        : `${reportStartDate} to ${reportEndDate}`,
    };

    try {
      setIsExportingPdf(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      let pdfBlob;
      const pdfPageOptions = {
        rangeLabel: `Analytics range: ${reportStartDate} to ${reportEndDate}`,
        todayLabel: reportPdfOptions.todayLabel,
      };
      try {
        const canvas = await captureElementCanvas(overviewExportRef.current);
        pdfBlob = createPdfFromCanvas(canvas, pdfPageOptions);
      } catch (snapshotError) {
        console.warn("Dashboard snapshot export failed; retrying full-page visual capture.", snapshotError);
        try {
          const retryCanvas = await captureElementCanvasAttached(overviewExportRef.current);
          pdfBlob = createPdfFromCanvas(retryCanvas, pdfPageOptions);
        } catch (retryError) {
          console.warn("Attached visual capture failed; using painted dashboard snapshot.", retryError);
          try {
            const visualCanvas = createOverviewDashboardCanvas(reportPdfOptions);
            pdfBlob = createPdfFromCanvas(visualCanvas, pdfPageOptions);
          } catch (visualError) {
            console.warn("Visual dashboard PDF renderer failed; using data PDF last resort.", visualError);
            pdfBlob = createOverviewReportPdf(reportPdfOptions);
          }
        }
      }
      downloadBlob(pdfBlob, `overview-dashboard-${reportStartDate}-to-${reportEndDate}.pdf`);
    } catch (error) {
      console.error("Overview dashboard PDF export failed:", error);
      window.alert(error instanceof Error ? error.message : "Failed to export overview dashboard PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <Layout
      title="Overview & Analytics"
      subtitle="Monitor daily engagement, demographics, and student support signals."
      onLogout={onLogout}
      session={session}
    >
      <div ref={overviewExportRef} className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {summaryError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Dashboard summary failed to load: {summaryError}
          </div>
        ) : null}
        {riskFlagsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Flagged entries preview failed to load: {riskFlagsError}
          </div>
        ) : null}
        {analyticsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Overview analytics failed to load: {analyticsError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3" data-export-block="true">
          <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleRangeChange(option.key)}
                aria-pressed={rangeKey === option.key}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  rangeKey === option.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {rangeKey === "custom" ? (
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="date"
                aria-label="Analytics start date"
                value={customRange.startDate}
                max={todayIso}
                onChange={(event) => handleCustomDateChange("startDate", event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
              />
              <input
                type="date"
                aria-label="Analytics end date"
                value={customRange.endDate}
                min={customRange.startDate || undefined}
                max={todayIso}
                onChange={(event) => handleCustomDateChange("endDate", event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
              />
              <button
                type="button"
                onClick={handleCustomRangeApply}
                disabled={analyticsLoading}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                Apply
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/appointments")}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            <CalendarIcon className="h-4 w-4 text-emerald-600" />
            {todayLabel}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf || summaryLoading || analyticsLoading}
            data-export-ignore="true"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            {isExportingPdf ? "Exporting..." : summaryLoading || analyticsLoading ? "Preparing Charts..." : "Export to PDF"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-export-block="true">
          {summaryCards.map((item) => (
            <MetricCard key={item.key} item={item} onSelect={handleSummaryCardSelect} />
          ))}
          {analyticsCards.map((item) => (
            <MetricCard key={item.key} item={item} />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2" data-export-block="true">
          <h2 className="font-display text-2xl font-black text-slate-900">Activity and Engagement Overview</h2>
          <span className="h-1 w-12 rounded-full bg-emerald-200" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
          <Card
            title="Journal Entries Volume"
            subtitle={`Journal entries from ${selectedRangeLabel}`}
            className="relative min-h-[485px] rounded-2xl border-admin-border"
          >
            <Activity className="absolute right-6 top-7 h-5 w-5 text-emerald-600" />
            {journalEntriesData.length ? (
              <JournalEntriesGraph data={journalEntriesData} />
            ) : (
              <EmptyState>No journal entry volume data available yet.</EmptyState>
            )}
          </Card>

          <Card
            title="Student Gender Demographics"
            subtitle="Student profile distribution"
            className="min-h-[485px] rounded-2xl border-admin-border"
          >
            {genderData.length ? (
              <>
                <DonutChart
                  data={genderData}
                  centerValue={genderData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                />
                <ChartLegend data={genderData} />
              </>
            ) : (
              <EmptyState>No student gender data available yet.</EmptyState>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6">
          <Card
            title={`Student Emotion Trends (${selectedRangeLabel})`}
            subtitle="Total emotion check-ins recorded, ranked highest to lowest"
            className="min-h-[520px] rounded-2xl border-admin-border"
          >
            {moodTrendData.length ? (
              <MoodTrendsChart series={moodTrendData} />
            ) : (
              <EmptyState>No emotion trend data available yet.</EmptyState>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6">
          <Card
            title="Sentiment Distribution"
            subtitle="Overall emotional tone detected from completed journal summaries"
            className="rounded-2xl border-admin-border"
          >
            {hasSentimentDistributionData ? (
              <div className="mx-auto flex w-full max-w-[720px] flex-col items-center justify-center gap-5 py-3 lg:flex-row lg:gap-8">
                <div className="w-full max-w-[320px] shrink-0 lg:w-[320px]">
                  <DonutChart
                    data={sentimentDistributionData}
                    centerValue={sentimentDistributionData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    centerLabel="Analyzed"
                  />
                </div>
                <ChartLegend data={sentimentDistributionData} className="w-full max-w-[260px] shrink-0 lg:mx-0" />
              </div>
            ) : (
              <EmptyState>No sentiment analysis data available yet.</EmptyState>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
          <Card title="Student Demographics by Location" subtitle="Distribution by submitted location">
            {studentDemographicLocations.length ? (
              <StudentDemographicsChart data={studentDemographicLocations} />
            ) : (
              <EmptyState>No student demographic data available yet.</EmptyState>
            )}
          </Card>

          <Card title="Student Distribution by Program" subtitle="Enrolled students grouped by program">
            {activeUsageSeries.length ? (
              <ActiveUsageGraph data={activeUsageSeries} />
            ) : (
              <EmptyState>No program distribution data available yet.</EmptyState>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6">
          <Card
            title="Primary Student Concerns"
            subtitle="Derived from the most frequently occurring journal tags."
          >
            {hasPrimaryConcernData ? (
              <ConcernThemesChart data={primaryConcernsData} />
            ) : (
              <EmptyState>No primary concern data available yet.</EmptyState>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Top Concerns by Barangay" subtitle="Most active barangays based on submitted journal entries">
            {barangayConcernData.length ? (
              <div className="space-y-4">
                {barangayConcernData.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="group -mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-2 text-left"
                  >
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {item.label}
                      </span>
                      <span className="font-medium text-gray-500">{item.value} entries</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${item.percent}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState>No barangay concern data available yet.</EmptyState>
            )}
          </Card>

          <Card title="Support Signals" subtitle="Snapshot of entries that may need faster response">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => navigate("/flagged")}
                className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-left transition hover:border-red-200"
              >
                <div>
                  <div className="text-sm font-semibold text-red-700">Crisis / Critical Need</div>
                  <div className="mt-1 text-sm text-red-500">Live entries marked high or critical risk</div>
                </div>
                <div className="text-2xl font-bold text-red-700">
                  {riskFlagsError ? "--" : formatMetricValue(crisisSignalCount)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate("/flagged")}
                className="flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-left transition hover:border-amber-200"
              >
                <div>
                  <div className="text-sm font-semibold text-amber-700">Distressed / Needs Support</div>
                  <div className="mt-1 text-sm text-amber-600">Live entries marked as needing support</div>
                </div>
                <div className="text-2xl font-bold text-amber-700">
                  {riskFlagsError ? "--" : formatMetricValue(distressedSignalCount)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate("/flagged")}
                className="flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-200"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">Contacted support</div>
                    <div className="mt-1 text-sm text-emerald-600">Live flagged entries with counselor contact recorded</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-700">
                  {riskFlagsError ? "--" : formatMetricValue(contactedSignalCount)}
                </div>
              </button>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card
            title="Consultation Volume by Category"
            subtitle={`Concerns addressed in scheduled appointments for ${selectedRangeLabel}`}
          >
            <ConsultationVolumeByCategoryPanel analytics={analyticsOverview} loading={analyticsLoading} periodLabel="this period" />
          </Card>

          <Card title="Counselor Workload" subtitle={`Confirmed/completed sessions for ${selectedRangeLabel} (one count per booking)`}>
            <CounselorWorkloadPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="At-Risk Student Trends" subtitle="Weekly tracking of high and critical severity cases">
            <AtRiskTrendsPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>

          <Card
            title="Response Within Target Time"
            subtitle="How many tagged risk cases got a counselor response within the target hours."
          >
            <ResponseTargetPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>
        </div>

      </div>
    </Layout>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Download,
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
    key: "scheduled",
    title: "Scheduled Today",
    icon: CalendarIcon,
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

const RISK_COLORS = {
  crisis: "#FF5D5D",
  distressed: "#F59E0B",
};
const PRIMARY_STUDENT_CONCERN_DEFS = [
  { label: "Gratitude / Appreciation", sources: ["Gratitude / Appreciation"] },
  { label: "Hobbies & Interests", sources: ["Hobbies & Interests"] },
  { label: "Travel & Adventure", sources: ["Travel & Adventure"] },
  { label: "Personal Growth / Epiphanies", sources: ["Personal Growth / Epiphanies"] },
  { label: "Spirituality / Faith", sources: ["Spirituality / Faith"] },
  { label: "Personal problems", sources: ["Personal problems"] },
  { label: "Mental health", sources: ["Mental health"] },
  { label: "Career guidance", sources: ["Career guidance"] },
  { label: "Financial", sources: ["Financial guidance", "Financial"] },
  { label: "Burnout / Exhaustion", sources: ["Burnout / Exhaustion", "Burnout/Exhaustion"] },
  { label: "Academic problems", sources: ["Academic problems"] },
  { label: "Peer relationship", sources: ["Peer", "Peer relationship"] },
  { label: "Family relationship", sources: ["Family", "Family relationship"] },
  { label: "Romantic relationship", sources: ["Romantic", "Romantic relationship"] },
  { label: "Anxiety", sources: ["Anxiety"] },
  { label: "Stress", sources: ["Stress"] },
  { label: "Bullying", sources: ["Bullying"] },
  { label: "Adjustment", sources: ["Adjustment"] },
  { label: "Others", sources: ["Others"] },
];
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
  const chipClassName =
    item.tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : item.tone === "gray"
        ? "bg-gray-100 text-gray-600"
        : "bg-emerald-50 text-emerald-600";
  const className = `rounded-xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-colors ${
    onSelect ? "hover:border-emerald-200" : ""
  }`;
  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon
            className={`h-4 w-4 ${
              item.tone === "amber" ? "text-amber-500" : item.tone === "gray" ? "text-emerald-700" : "text-emerald-600"
            }`}
          />
          {item.title}
        </h3>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-gray-900">{item.value}</div>
        <div className={`flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chipClassName}`}>
          {DeltaIcon ? <DeltaIcon className="mr-1 h-3 w-3" /> : null}
          {item.delta}
        </div>
      </div>
    </>
  );

  if (!onSelect) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item.title)}
      className={className}
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

function JournalEntriesGraph({ data, onSelect }) {
  const width = 760;
  const height = 340;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 44;
  const padBottom = 56;
  const max = Math.max(...data.map((item) => item.value), 1);
  const { axisMax, guides } = buildChartAxis(max);
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
      </svg>
      <div
        className="-mt-1 grid gap-2 pl-[68px] pr-6 text-center text-sm font-black text-slate-800"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
      >
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
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
  const sortedData = [...data].sort((a, b) => b.value - a.value || Number(a.order || 0) - Number(b.order || 0));
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
            <g key={item.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx="8"
                fill={item.color}
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

function ConsultationVolumeByCategoryPanel({ analytics, loading }) {
  const data = buildConsultationVolumeCategoryData(analytics?.charts?.consultationVolumeByCategory || []);
  const hasData = data.some((item) => item.value > 0);
  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading consultation categories...</div>;
  }

  if (!hasData) {
    return <div className="py-16 text-center text-sm text-slate-500">No consultation category data available for this month.</div>;
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

function getPageStylesText() {
  return Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules || [])
          .map((rule) => rule.cssText)
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
    body { margin: 0; background: #ffffff; }
    [data-export-ignore='true'] { display: none !important; }
  `;
  container.appendChild(style);
  container.appendChild(clone);

  return new XMLSerializer().serializeToString(container);
}

async function captureElementCanvas(element) {
  const width = Math.ceil(element.scrollWidth);
  const height = Math.ceil(element.scrollHeight);
  const clone = element.cloneNode(true);
  clone.querySelectorAll("[data-export-ignore='true']").forEach((node) => node.remove());
  clone.style.width = `${width}px`;
  clone.style.maxWidth = "none";
  clone.style.background = "#ffffff";

  const snapshotContent = serializeDashboardSnapshotContent(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        ${snapshotContent}
      </foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadImage(svgUrl);
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
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

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createPdfFromCanvas(canvas) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const imageWidth = pageWidth - margin * 2;
  const sliceHeight = Math.floor((canvas.width / imageWidth) * (pageHeight - margin * 2));
  const slices = [];

  for (let y = 0; y < canvas.height; y += sliceHeight) {
    const currentHeight = Math.min(sliceHeight, canvas.height - y);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentHeight;
    const context = sliceCanvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(canvas, 0, y, canvas.width, currentHeight, 0, 0, canvas.width, currentHeight);
    slices.push({
      width: sliceCanvas.width,
      height: sliceCanvas.height,
      bytes: dataUrlToBytes(sliceCanvas.toDataURL("image/jpeg", 0.92)),
    });
  }

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
  const pageIds = slices.map((_, index) => 3 + index * 3);
  appendObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  appendObject(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);

  slices.forEach((slice, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const drawHeight = imageWidth * (slice.height / slice.width);
    const drawY = pageHeight - margin - drawHeight;
    const imageName = `Im${index + 1}`;
    const content = `q\n${imageWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${margin} ${drawY.toFixed(2)} cm\n/${imageName} Do\nQ`;

    appendObject(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    appendObject(contentId, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
    appendObject(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${slice.width} /Height ${slice.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.bytes.length} >>\nstream\n`,
      slice.bytes,
      "\nendstream",
    ]);
  });

  const xrefOffset = byteOffset;
  const maxObjectId = 2 + slices.length * 3;
  appendString(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxObjectId; id += 1) {
    appendString(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  appendString(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
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

function buildPrimaryStudentConcernData(data) {
  return buildConcernCategoryData(data, PRIMARY_STUDENT_CONCERN_DEFS);
}

function buildConsultationVolumeCategoryData(data) {
  return buildConcernCategoryData(data, CONSULTATION_VOLUME_CATEGORY_DEFS);
}

export default function Overview({ onLogout, session }) {
  const navigate = useNavigate();
  const overviewExportRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
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

    async function loadDashboardSummary() {
      try {
        setSummaryLoading(true);
        const data = await fetchAdminDashboardSummary();
        if (!isMounted) return;
        setDashboardSummary(data);
        setSummaryError("");
      } catch (error) {
        if (!isMounted) return;
        setDashboardSummary(null);
        setSummaryError(error instanceof Error ? error.message : "Failed to load dashboard summary.");
      } finally {
        if (isMounted) {
          setSummaryLoading(false);
        }
      }
    }

    loadDashboardSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalyticsOverview() {
      try {
        setAnalyticsLoading(true);
        const data = await fetchAdminAnalytics(getCurrentMonthAnalyticsParams());
        if (!isMounted) return;
        setAnalyticsOverview(data);
        setAnalyticsError("");
      } catch (error) {
        if (!isMounted) return;
        setAnalyticsError(error instanceof Error ? error.message : "Failed to load overview analytics.");
      } finally {
        if (isMounted) {
          setAnalyticsLoading(false);
        }
      }
    }

    loadAnalyticsOverview();
    return () => {
      isMounted = false;
    };
  }, []);

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
  const summaryCards = SUMMARY_CARD_DEFS.map((item) => {
    const source =
      item.key === "flagged"
        ? dashboardSummary?.cards?.flaggedEntries
        : item.key === "students"
          ? dashboardSummary?.cards?.totalStudents
          : item.key === "entries"
            ? dashboardSummary?.cards?.totalEntries
            : dashboardSummary?.cards?.scheduledToday;
    const direction = source?.direction || "neutral";
    const hasValue = source?.value !== undefined && source?.value !== null;

    return {
      ...item,
      value: summaryLoading ? "--" : hasValue ? formatMetricValue(source.value) : "--",
      delta: summaryLoading ? "--" : source?.percentageText || "--",
      direction: summaryLoading || !hasValue ? "neutral" : direction,
      tone: summaryLoading || !hasValue ? "gray" : mapMetricTone(item.key, direction),
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
    dashboardSummary?.charts?.journalEntries?.length > 0 ? dashboardSummary.charts.journalEntries : [];
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
  const studentDemographicLocations =
    dashboardSummary?.charts?.studentDemographics?.locations?.length > 0
      ? dashboardSummary.charts.studentDemographics.locations
      : [];
  const activeUsageSeries =
    dashboardSummary?.charts?.activeUsageByCourseYear?.series?.length > 0
      ? withColors(dashboardSummary.charts.activeUsageByCourseYear.series, ["#3E8914", "#3DA35D", "#96E072", "#134611"])
      : [];
  const primaryConcernsData =
    dashboardSummary?.charts?.primaryConcerns?.length > 0
      ? buildPrimaryStudentConcernData(dashboardSummary.charts.primaryConcerns)
      : [];
  const hasPrimaryConcernData = primaryConcernsData.some((item) => item.value > 0);
  const barangayConcernData =
    dashboardSummary?.charts?.topConcernsByBarangay?.length > 0
      ? dashboardSummary.charts.topConcernsByBarangay.map((item, index, items) => ({
          ...item,
          percent: items[0]?.value ? Math.round((item.value / items[0].value) * 100) : 0,
        }))
      : [];
  const crisisSignalCount = riskFlags.filter((entry) =>
    ["HIGH", "CRITICAL"].includes(String(entry.riskLevel || "").toUpperCase()),
  ).length;
  const distressedSignalCount = riskFlags.filter((entry) =>
    ["LOW", "MEDIUM", "MODERATE"].includes(String(entry.riskLevel || "").toUpperCase()),
  ).length;
  const contactedSignalCount = riskFlags.filter(
    (entry) => String(entry.supportResponse || "").toUpperCase() === "CONTACTED",
  ).length;
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

    try {
      setIsExportingPdf(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const canvas = await captureElementCanvas(overviewExportRef.current);
      const pdfBlob = createPdfFromCanvas(canvas);
      const todayIso = getCurrentMonthAnalyticsParams(now).endDate;
      downloadBlob(pdfBlob, `overview-dashboard-${todayIso}.pdf`);
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
      <div ref={overviewExportRef} className="mx-auto max-w-[1200px] space-y-6 bg-white pb-12">
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

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/appointments")}
            className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            <CalendarIcon className="h-4 w-4 text-emerald-600" />
            {todayLabel}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            data-export-ignore="true"
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            {isExportingPdf ? "Exporting..." : "Export to PDF"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <MetricCard key={item.key} item={item} onSelect={handleSummaryCardSelect} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {analyticsCards.map((item) => (
            <MetricCard key={item.key} item={item} />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <h2 className="font-display text-2xl font-black text-slate-900">Activity and Engagement Overview</h2>
          <span className="h-1 w-12 rounded-full bg-emerald-200" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
          <Card
            title="Journal Entries Volume"
            subtitle="Total journal entries per week (current month)"
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
            title="Student Emotion Trends (Current Month)"
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
                className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-left"
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
                className="flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-left"
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
                className="flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-left"
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
            subtitle="Current month only - total count of concerns addressed in scheduled appointments"
          >
            <ConsultationVolumeByCategoryPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>

          <Card title="Counselor Workload" subtitle="Active cases assigned per role">
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

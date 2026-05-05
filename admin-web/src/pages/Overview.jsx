import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock3,
  MapPin,
  PhoneCall,
  User,
  Users,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Layout from "../components/Layout";
import {
  fetchAdminAnalytics,
  fetchAdminAppointmentsOverview,
  fetchAdminDashboardSummary,
  fetchAdminRiskFlags,
  fetchAdminRoleAssignments,
} from "../lib/admin-api";
import { getRiskLevelLabel } from "../lib/risk-labels";
import Modal from "../components/Modal";

const SUMMARY_CARD_DEFS = [
  {
    key: "flagged",
    title: "Flagged Entries",
    fallbackValue: 25,
    icon: AlertTriangle,
  },
  {
    key: "students",
    title: "Total Students",
    fallbackValue: 1245,
    icon: Users,
  },
  {
    key: "entries",
    title: "Total Entries",
    fallbackValue: 184,
    icon: Activity,
  },
  {
    key: "scheduled",
    title: "Scheduled Today",
    fallbackValue: 12,
    icon: CalendarIcon,
  },
];

const ANALYTICS_CARD_DEFS = [
  {
    key: "averageEntriesPerStudent",
    title: "Avg Entries/Student",
    fallbackValue: 0,
    icon: Activity,
    valueType: "decimal",
  },
  {
    key: "counselingSessions",
    title: "Counseling Sessions",
    fallbackValue: 0,
    icon: CheckCircle2,
    valueType: "number",
  },
];

const CONCERN_COLORS = ["#4D8FEF", "#9B6EF3", "#39C493", "#F6B84E"];
const RISK_COLORS = {
  crisis: "#FF5D5D",
  distressed: "#F59E0B",
};

const GENDER_DATA = [
  { label: "Male", value: 487, color: "#3E8914" },
  { label: "Female", value: 552, color: "#3DA35D" },
  { label: "Prefer not to say", value: 83, color: "#A7F3D0" },
];

const MOOD_TREND_SERIES = [
  {
    key: "excitement",
    label: "Excitement",
    color: "#FDBA58",
    values: [11, 13, 15, 12, 14, 18, 17],
  },
  {
    key: "joy",
    label: "Joy",
    color: "#FFD616",
    values: [40, 36, 31, 27, 33, 46, 49],
  },
  {
    key: "contentment",
    label: "Contentment",
    color: "#97CFDA",
    values: [20, 22, 25, 18, 25, 19, 16],
  },
  {
    key: "relief",
    label: "Relief",
    color: "#78C6A3",
    values: [15, 17, 19, 16, 18, 15, 14],
  },
  {
    key: "embarrassment",
    label: "Embarrassment",
    color: "#F0A0B8",
    values: [5, 6, 8, 9, 7, 5, 4],
  },
  {
    key: "guilt",
    label: "Guilt",
    color: "#B895C8",
    values: [6, 7, 9, 11, 8, 6, 5],
  },
  {
    key: "disappointment",
    label: "Disappointment",
    color: "#A7B4C6",
    values: [9, 11, 15, 19, 13, 10, 9],
  },
  {
    key: "sadness",
    label: "Sadness",
    color: "#7EA9D9",
    values: [14, 15, 20, 25, 18, 12, 10],
  },
  {
    key: "anxiety",
    label: "Anxiety",
    color: "#F19137",
    values: [10, 12, 18, 23, 14, 10, 8],
  },
  {
    key: "anger",
    label: "Anger",
    color: "#E86686",
    values: [8, 9, 11, 10, 9, 7, 6],
  },
];

const MOOD_TREND_LABELS = ["Oct 1", "Oct 5", "Oct 10", "Oct 15", "Oct 20", "Oct 25", "Oct 30"];

const STUDENT_DEMOGRAPHICS = [
  { label: "San Antonio", value: 128, female: 53, male: 41, nonBinary: 4, undisclosed: 2 },
  { label: "Poblacion", value: 113, female: 47, male: 36, nonBinary: 5, undisclosed: 3 },
  { label: "San Jose", value: 86, female: 34, male: 29, nonBinary: 3, undisclosed: 2 },
  { label: "Rosario", value: 77, female: 29, male: 23, nonBinary: 2, undisclosed: 1 },
  { label: "San Juan", value: 61, female: 24, male: 19, nonBinary: 2, undisclosed: 1 },
  { label: "Manggahan", value: 49, female: 18, male: 16, nonBinary: 1, undisclosed: 1 },
];

const DEMOGRAPHIC_SPLIT = [
  { label: "Female", value: 189, color: "#2E7D32" },
  { label: "Male", value: 164, color: "#43A047" },
  { label: "Non-binary", value: 17, color: "#66BB6A" },
  { label: "Prefer not to say", value: 10, color: "#A5D6A7" },
];

const PRIMARY_CONCERNS = [
  { label: "Academic problems", value: 12, color: "#1B5E20" },
  { label: "Anxiety", value: 10, color: "#2E7D32" },
  { label: "Stress", value: 8, color: "#43A047" },
  { label: "Interpersonal relationships", value: 6, color: "#66BB6A" },
  { label: "Mental health", value: 5, color: "#558B2F" },
  { label: "Career guidance", value: 4, color: "#7CB342" },
  { label: "Financial guidance", value: 3, color: "#8BC34A" },
  { label: "Bullying", value: 2, color: "#A5D6A7" },
  { label: "Others", value: 1, color: "#C5E1A5" },
];

const BARANGAY_DATA = [
  { label: "Malanday", value: 142, percent: 85 },
  { label: "Karuhatan", value: 116, percent: 69 },
  { label: "Gen T De Leon", value: 94, percent: 54 },
  { label: "Marulas", value: 73, percent: 42 },
];

const JOURNAL_ENTRIES_DATA = [
  { label: "Week 1", value: 392 },
  { label: "Week 2", value: 304 },
  { label: "Week 3", value: 548 },
  { label: "Week 4", value: 447 },
  { label: "Week 5", value: 623 },
  { label: "Week 6", value: 801 },
  { label: "Week 7", value: 712 },
];

const ACTIVE_USAGE_GROUPS = [
  { label: "1st Year", BSIT: 118, BSPSY: 96, BSED: 149, BSCE: 182 },
  { label: "2nd Year", BSIT: 101, BSPSY: 82, BSED: 128, BSCE: 160 },
  { label: "3rd Year", BSIT: 87, BSPSY: 71, BSED: 109, BSCE: 145 },
  { label: "4th Year", BSIT: 76, BSPSY: 62, BSED: 97, BSCE: 137 },
];

const ACTIVE_USAGE_SERIES = [
  { key: "BSIT", label: "BS Information Technology", color: "#3E8914" },
  { key: "BSPSY", label: "BS Psychology", color: "#3DA35D" },
  { key: "BSED", label: "BSEd English", color: "#96E072" },
  { key: "BSCE", label: "BS Civil Engineering", color: "#134611" },
];

const ACTIVE_USAGE_PROGRAM_DATA = ACTIVE_USAGE_SERIES.map((item) => ({
  ...item,
  value: ACTIVE_USAGE_GROUPS.reduce((sum, group) => sum + Number(group[item.key] || 0), 0),
}));

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

function formatTooltipLines(lines) {
  return lines.filter(Boolean).join("\n");
}

function buildStackedAreas(seriesList, width, height) {
  const pointCount = Math.max(...seriesList.map((series) => (Array.isArray(series.values) ? series.values.length : 0)), 0);
  if (!pointCount) return [];

  const totals = Array.from({ length: pointCount }, (_, index) =>
    seriesList.reduce((sum, series) => sum + Number(series.values?.[index] || 0), 0),
  );
  const maxTotal = Math.max(...totals, 1);
  const stepX = pointCount > 1 ? width / (pointCount - 1) : width;
  const cumulative = Array(pointCount).fill(0);

  return seriesList.map((series) => {
    const topPoints = [];
    const bottomPoints = [];

    for (let index = 0; index < pointCount; index += 1) {
      const value = Number(series.values?.[index] || 0);
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

function DonutChart({
  data,
  size = 220,
  strokeWidth = 24,
  centerValue,
  centerLabel = "Total Valid",
  onSelect,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  let progress = 0;

  return (
    <div className="relative w-full" style={{ height: size, maxWidth: size, marginInline: "auto" }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ECFDF5" strokeWidth={strokeWidth} />
        {data.map((item) => {
          const fraction = item.value / total;
          const dasharray = `${fraction * circumference} ${circumference}`;
          const dashoffset = -progress * circumference;
          progress += fraction;
          return (
            <circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className={onSelect ? "cursor-pointer" : ""}
              onClick={onSelect ? () => onSelect(item.label) : undefined}
            >
              <title>{`${item.label}: ${item.value.toLocaleString()}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-gray-900">{centerValue || total.toLocaleString()}</span>
        <span className="text-xs text-gray-500">{centerLabel}</span>
      </div>
    </div>
  );
}

function ChartLegend({ data, onSelect, className = "justify-center" }) {
  return (
    <div className={`mt-3 flex flex-wrap gap-4 text-xs text-gray-600 ${className}`}>
      {data.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={onSelect ? () => onSelect(item.label) : undefined}
          title={`${item.label}: ${item.value.toLocaleString()}`}
          className="flex items-center gap-1.5 rounded-full px-1 py-0.5 hover:bg-gray-50"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function JournalEntriesGraph({ data, onSelect }) {
  const width = 760;
  const height = 300;
  const padX = 24;
  const padTop = 14;
  const padBottom = 34;
  const max = Math.max(...data.map((item) => item.value), 1);
  const guides = [0, 200, 400, 600, 800];
  const points = data.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, data.length - 1);
    const y = padTop + ((max - item.value) * (height - padTop - padBottom)) / max;
    return { ...item, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? padX} ${height - padBottom} L ${points[0]?.x ?? padX} ${height - padBottom} Z`;

  return (
    <div className="h-[300px] w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="journalEntriesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {guides.map((guide) => {
          const y = padTop + ((max - guide) * (height - padTop - padBottom)) / max;
          return (
            <g key={guide}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
              <text x="2" y={y + 4} className="fill-[#6B7280] text-[12px] font-medium">
                {guide}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#journalEntriesFill)" />
        <path d={linePath} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
        {points.map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#059669"
            className={onSelect ? "cursor-pointer" : ""}
            onClick={onSelect ? () => onSelect(`Journal Entries: ${point.label}`) : undefined}
          >
            <title>{`${point.label}: ${point.value.toLocaleString()} entries`}</title>
          </circle>
        ))}
      </svg>
      <div
        className="mt-3 grid gap-2 text-center text-xs font-semibold text-gray-500"
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
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="h-[250px] w-full">
      <div
        className="grid h-full gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
      >
        {data.map((item) => (
          <div key={item.key} className="flex flex-col items-center">
            <div className="flex h-full w-full items-end justify-center">
              <button
                key={item.key}
                type="button"
                onClick={onSelect ? () => onSelect(`Program Distribution: ${item.label}`) : undefined}
                title={`${item.label}: ${item.value.toLocaleString()} students`}
                className="w-full max-w-[28px] rounded-t-[6px]"
                style={{
                  height: `${Math.max(10, (item.value / max) * 100)}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="mt-3 text-center text-sm font-semibold text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
        {data.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
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
          title={`${item.label}: ${item.value.toLocaleString()} students`}
          className="grid w-full grid-cols-[92px,1fr,72px] items-center gap-3 text-left"
        >
          <span className="text-sm font-medium text-gray-500">{item.label}</span>
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
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sortedData.map((item) => item.value), 1);

  return (
    <div className="space-y-5">
      {sortedData.map((item, index) => (
        <div key={item.label} className="space-y-2" title={`${item.label}: ${item.value.toLocaleString()} tags`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm font-semibold text-emerald-900">
              {`${index + 1}. ${item.label}`}
            </div>
            <div className="shrink-0 text-sm font-bold text-emerald-900">{item.value.toLocaleString()}</div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#D8EDBF]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(10, (item.value / max) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConcernTrendsPanel({ analytics, loading }) {
  const labels = analytics?.charts?.concernTrends?.labels || [];
  const series = analytics?.charts?.concernTrends?.series || [];
  const areaPaths = buildStackedAreas(series, 280, 170);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading concern trends...</div>;
  }

  if (!series.length) {
    return <div className="py-16 text-center text-sm text-slate-500">No concern data available for this range.</div>;
  }

  return (
    <>
      <div className="mt-2">
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
          {areaPaths.map((path, index) => (
            <path
              key={series[index]?.key || index}
              d={path}
              fill={CONCERN_COLORS[index % CONCERN_COLORS.length]}
              opacity="0.68"
              transform="translate(10 6)"
            />
          ))}
          {labels.map((label, index, items) => {
            const width = items.length > 1 ? 280 / items.length : 280;
            const x = index * width + 10;
            const tooltip = formatTooltipLines([
              label,
              ...series.map((item) => `${item.label}: ${formatMetricValue(item.values?.[index] || 0)}`),
            ]);
            return (
              <rect key={label} x={x} y="0" width={width} height="186" fill="transparent">
                <title>{tooltip}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div
        className="grid gap-2 text-xs text-slate-500"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
      >
        {labels.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4">
        {series.map((item, index) => (
          <div key={item.key} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CONCERN_COLORS[index % CONCERN_COLORS.length] }} />
            {item.label.toLowerCase().replace(/\s*\/\s*/g, " ")}
          </div>
        ))}
      </div>
    </>
  );
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
        <div key={counselor.label} className="grid grid-cols-[140px_1fr] items-center gap-4">
          <div className="text-sm text-slate-500">{counselor.label}</div>
          <div>
            <div className="h-5 rounded-full bg-slate-100" title={`${counselor.label}: ${formatMetricValue(counselor.value)} assigned cases`}>
              <div
                className="h-5 rounded-full bg-[#20C08D]"
                style={{ width: `${Math.max(10, (Number(counselor.value || 0) / max) * 100)}%` }}
              />
            </div>
          </div>
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
  const riskMax = Math.max(...crisisSeries, ...distressedSeries, 1);
  const crisisPath = buildLinePath(crisisSeries, 280, 170);
  const distressedPath = buildLinePath(distressedSeries, 280, 170);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading risk trends...</div>;
  }

  if (!crisisSeries.length && !distressedSeries.length) {
    return <div className="py-16 text-center text-sm text-slate-500">No at-risk trend data available.</div>;
  }

  return (
    <>
      <div className="mt-2">
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
          <path d={distressedPath} fill="none" stroke={RISK_COLORS.distressed} strokeWidth="3" transform="translate(10 6)" />
          <path d={crisisPath} fill="none" stroke={RISK_COLORS.crisis} strokeWidth="3" transform="translate(10 6)" />
          {distressedSeries.map((value, index) => {
            const x = distressedSeries.length > 1 ? (280 / (distressedSeries.length - 1)) * index + 10 : 150;
            const y = 176 - (Number(value || 0) / riskMax) * 154;
            return (
              <circle key={`distressed-${index}`} cx={x} cy={y} r="4" fill="white" stroke={RISK_COLORS.distressed} strokeWidth="2.5">
                <title>{`${labels[index] || `W${index + 1}`}: ${formatMetricValue(value)} distressed / needs support cases`}</title>
              </circle>
            );
          })}
          {crisisSeries.map((value, index) => {
            const x = crisisSeries.length > 1 ? (280 / (crisisSeries.length - 1)) * index + 10 : 150;
            const y = 176 - (Number(value || 0) / riskMax) * 154;
            return (
              <circle key={`crisis-${index}`} cx={x} cy={y} r="4" fill="white" stroke={RISK_COLORS.crisis} strokeWidth="2.5">
                <title>{`${labels[index] || `W${index + 1}`}: ${formatMetricValue(value)} crisis / critical need cases`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div
        className="grid gap-2 text-xs text-slate-500"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
      >
        {labels.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#FF5D5D]" />
          Crisis / Critical Need
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
          Distressed / Needs Support
        </div>
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
    </div>
  );
}

function MoodTrendsChart({ labels, series, onSelect }) {
  const width = 480;
  const height = 290;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 42;
  const max = Math.max(...series.flatMap((item) => item.values), 1);
  const guides = [0, 15, 30, 45, 60];

  const buildPoints = (values) =>
    values.map((value, index) => {
      const x = padLeft + (index * (width - padLeft - padRight)) / Math.max(1, values.length - 1);
      const y = padTop + ((max - value) * (height - padTop - padBottom)) / max;
      return { value, x, y, label: labels[index] };
    });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[290px] w-full">
        {guides.map((guide) => {
          const y = padTop + ((max - guide) * (height - padTop - padBottom)) / max;
          return (
            <g key={guide}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
              <text x="8" y={y + 4} className="fill-[#64748B] text-[12px] font-medium">
                {guide}
              </text>
            </g>
          );
        })}

        {series.map((item) => {
          const points = buildPoints(item.values);
          const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

          return (
            <g key={item.key}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" />
              {points.map((point) => (
                <circle
                  key={`${item.key}-${point.label}`}
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill="white"
                  stroke={item.color}
                  strokeWidth="3"
                  className={onSelect ? "cursor-pointer" : ""}
                  onClick={onSelect ? () => onSelect(`Emotion Trend: ${item.label} / ${point.label}`) : undefined}
                >
                  <title>{`${item.label} on ${point.label}: ${point.value.toLocaleString()} check-ins`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <div
        className="mt-2 grid gap-2 text-center text-xs font-semibold text-gray-500"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
      >
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {series.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={onSelect ? () => onSelect(`Emotion Trend: ${item.label}`) : undefined}
            title={item.label}
            className="flex items-center gap-2 rounded-full px-1 py-0.5 text-gray-600 hover:bg-gray-50"
          >
            <span className="h-3.5 w-3.5 rounded-full border border-gray-300" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppointmentCard({ item, onClick, onSelect }) {
  const toneClasses =
    item.tone === "red"
      ? {
          card: "border-red-100 bg-red-50/70",
          badge: "bg-red-100 text-red-600",
          icon: "text-red-500",
        }
      : {
          card: "border-gray-100 bg-white",
          badge: "bg-slate-100 text-slate-600",
          icon: "text-blue-500",
        };

  return (
    <button
      type="button"
      onClick={onClick || (onSelect ? () => onSelect(`Appointment: ${item.student}`) : undefined)}
      title={`${item.student} - ${item.time} - ${item.type}`}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:border-emerald-200 ${toneClasses.card}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Clock3 className={`h-5 w-5 ${toneClasses.icon}`} />
          {item.time}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses.badge}`}>{item.type}</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <User className="h-4 w-4" />
          </span>
          <span className="font-medium text-gray-700">{item.student}</span>
        </div>
      </div>
      {item.note ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-slate-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item.note}</span>
        </div>
      ) : null}
      {item.concernTag ? (
        <div className="mt-3">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {item.concernTag}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function getInitials(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "TM";
}

function TeamMemberCard({ item, onClick }) {
  const statusClasses =
    String(item.status || "").toUpperCase() === "PENDING"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : item.isActive
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.fullName} - ${item.roleLabel}`}
      className="w-full rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-slate-100"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {item.profilePictureUrl ? (
            <img
              src={item.profilePictureUrl}
              alt={item.fullName}
              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              {getInitials(item.fullName)}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{item.fullName}</div>
            <div className="truncate text-sm text-slate-500">{item.email}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses}`}>
          {item.status}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{item.roleLabel}</span>
        <span className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm">
          {item.department}
        </span>
      </div>
    </button>
  );
}

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function normalizeProgramLabel(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper.length <= 4 ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
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

function normalizeConcernThemeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Others";
  if (normalized.includes("academic")) return "Academic problems";
  if (normalized.includes("anxiety")) return "Anxiety";
  if (normalized.includes("stress") || normalized.includes("burnout") || normalized.includes("exhaust")) return "Stress";
  if (normalized.includes("peer")) return "Peer";
  if (normalized.includes("family")) return "Family";
  if (normalized.includes("romantic")) return "Romantic";
  if (normalized.includes("relationship")) return "Interpersonal relationships";
  if (normalized.includes("career")) return "Career guidance";
  if (normalized.includes("financial")) return "Financial guidance";
  if (normalized.includes("mental")) return "Mental health";
  if (normalized.includes("bully")) return "Bullying";
  if (normalized.includes("adjust")) return "Adjustment";
  if (normalized.includes("personal")) return "Personal problems";
  return "Others";
}

function getConcernTagFromEvent(event) {
  const text = `${event?.title || ""} ${event?.description || ""}`;
  return normalizeConcernThemeLabel(text);
}

function formatAppointmentTime(value) {
  if (!value) return "Time TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBA";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatAppointmentDateLabel(value) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

function toManilaIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function FlaggedEntriesModal({ entries, isOpen, onClose, onReviewAll }) {
  const flaggedEntries = Array.isArray(entries) ? entries : [];
  const crisisCount = flaggedEntries.filter((entry) => ["HIGH", "CRITICAL"].includes(String(entry.riskLevel || "").toUpperCase())).length;
  const declinedCount = flaggedEntries.filter((entry) => entry.supportResponse === "DECLINED").length;
  const contactedCount = flaggedEntries.filter((entry) => entry.supportResponse === "CONTACTED").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-red-50 p-3 text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">Flagged Entries</h2>
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-red-600">
                {crisisCount} Crisis / Critical Need
              </span>
              {declinedCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                  {declinedCount} Declined contact
                </span>
              ) : null}
              {contactedCount > 0 ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  {contactedCount} Contacted
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Crisis-level journal entries and support responses captured from the student help prompt
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {flaggedEntries.length ? (
            flaggedEntries.map((entry) => {
              const isHighRisk = ["HIGH", "CRITICAL"].includes(String(entry.riskLevel || "").toUpperCase());
              const declinedSupport = entry.supportResponse === "DECLINED";
              const contactedSupport = entry.supportResponse === "CONTACTED";
              const concernLabel =
                entry.adminFlagReason || entry.summary || getRiskLevelLabel(entry.riskLevel);

              return (
                <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-4">
                      <span
                        className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
                          isHighRisk
                            ? "bg-red-500"
                            : declinedSupport
                              ? "bg-amber-500"
                              : contactedSupport
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-lg font-semibold leading-7 text-slate-900">
                          {entry.fullName || entry.studentNumber}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                          <span className="truncate">{normalizeProgramLabel(entry.program) || "Program unavailable"}</span>
                          <span className="text-slate-300">&bull;</span>
                          <span>{entry.studentNumber}</span>
                          {entry.entryDate ? (
                            <>
                              <span className="text-slate-300">&bull;</span>
                              <span>{entry.entryDate}</span>
                            </>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                              isHighRisk ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                          {getRiskLevelLabel(entry.riskLevel)}
                          </span>
                          {declinedSupport ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                              Declined contact
                            </span>
                          ) : null}
                          {contactedSupport ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                              Contacted support
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 max-w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700">
                          <span className="break-words">{concernLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm leading-6 text-slate-400">
                      {formatRelativeTime(entry.supportResponseAt || entry.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No flagged students found right now.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onReviewAll}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F44343] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#e23939]"
        >
          Review All Flagged Entries
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </Modal>
  );
}

export default function Overview({ onLogout, session }) {
  const navigate = useNavigate();
  const [calendarTab, setCalendarTab] = useState("my");
  const [now, setNow] = useState(() => new Date());
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [riskFlags, setRiskFlags] = useState([]);
  const [riskFlagsError, setRiskFlagsError] = useState("");
  const [flaggedModalOpen, setFlaggedModalOpen] = useState(false);
  const [appointmentItems, setAppointmentItems] = useState([]);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [roleMembers, setRoleMembers] = useState([]);
  const [rolesError, setRolesError] = useState("");
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

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
        const data = await fetchAdminDashboardSummary();
        if (!isMounted) return;
        setDashboardSummary(data);
        setSummaryError("");
      } catch (error) {
        if (!isMounted) return;
        setSummaryError(error instanceof Error ? error.message : "Failed to load dashboard summary.");
      }
    }

    loadDashboardSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAppointments() {
      try {
        const todayIso = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const supportType = calendarTab === "peer" ? "PEER" : "GUIDANCE";
        const data = await fetchAdminAppointmentsOverview(todayIso, supportType);
        if (!isMounted) return;

        const sessionEmail = String(session?.email || "").trim().toLowerCase();
        const myCounselorId =
          calendarTab === "my"
            ? (Array.isArray(data?.counselors) ? data.counselors : []).find(
                (item) => String(item.email || "").trim().toLowerCase() === sessionEmail,
              )?.id || ""
            : "";
        const items = (Array.isArray(data?.appointments) ? data.appointments : [])
          .filter((appointment) => (calendarTab === "my" ? appointment.counselorId === myCounselorId : true))
          .sort((a, b) => String(a.slotTime || "").localeCompare(String(b.slotTime || "")))
          .map((appointment) => ({
            concernTag: appointment.concern || "Others",
            note: appointment.studentNote || appointment.program || "",
            route: calendarTab === "peer" ? "/peer-counselors" : "/appointments",
            student: appointment.studentName || appointment.studentNumber || "(No student)",
            time: appointment.slotLabel || appointment.slotTime || "",
            tone:
              ["Anxiety", "Stress", "Bullying", "Mental health"].includes(appointment.concern)
                ? "red"
                : "blue",
            type: appointment.concern || "Others",
          }));

        setAppointmentItems(items);
        setAppointmentsError("");
      } catch (error) {
        if (!isMounted) return;
        setAppointmentsError(error instanceof Error ? error.message : "Failed to load appointments.");
        setAppointmentItems([]);
      }
    }

    loadAppointments();
    return () => {
      isMounted = false;
    };
  }, [calendarTab, session?.email]);

  useEffect(() => {
    let isMounted = true;

    async function loadRolePreview() {
      try {
        const data = await fetchAdminRoleAssignments();
        if (!isMounted) return;
        setRoleMembers(Array.isArray(data?.members) ? data.members.slice(0, 6) : []);
        setRolesError("");
      } catch (error) {
        if (!isMounted) return;
        setRoleMembers([]);
        setRolesError(error instanceof Error ? error.message : "Failed to load team members.");
      }
    }

    loadRolePreview();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalyticsOverview() {
      try {
        setAnalyticsLoading(true);
        const data = await fetchAdminAnalytics({ range: "30d" });
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

    return {
      ...item,
      value: formatMetricValue(source?.value ?? item.fallbackValue),
      delta: source?.percentageText || "0%",
      direction,
      tone: mapMetricTone(item.key, direction),
    };
  });
  const analyticsCards = ANALYTICS_CARD_DEFS.map((item) => {
    const source = analyticsOverview?.cards?.[item.key];
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
        : item.valueType === "decimal"
          ? formatMetricDecimal(source?.value ?? item.fallbackValue)
          : formatMetricValue(source?.value ?? item.fallbackValue),
      delta: analyticsLoading
        ? "--"
        : item.key === "averageEntriesPerStudent"
          ? `${deltaValue >= 0 ? "+" : ""}${formatMetricDecimal(deltaValue)}`
          : source?.percentageText || "0%",
      direction: analyticsLoading ? "neutral" : direction,
      tone: analyticsLoading ? "gray" : mapMetricTone(item.key, direction),
    };
  });
  const journalEntriesData =
    dashboardSummary?.charts?.journalEntries?.length > 0 ? dashboardSummary.charts.journalEntries : JOURNAL_ENTRIES_DATA;
  const genderData =
    dashboardSummary?.charts?.genderDistribution?.length > 0
      ? withColors(dashboardSummary.charts.genderDistribution, ["#3E8914", "#3DA35D", "#A7F3D0"])
      : GENDER_DATA;
  const moodTrendData =
    dashboardSummary?.charts?.moodTrends?.series?.length > 0
      ? withColors(
          dashboardSummary.charts.moodTrends.series,
          ["#FFD616", "#97CFDA", "#7EA9D9", "#F19137", "#E86686", "#B895C8", "#FDBA58", "#A7B4C6", "#8FA7DB", "#D68A5C"],
        )
      : MOOD_TREND_SERIES;
  const moodTrendLabels =
    dashboardSummary?.charts?.moodTrends?.labels?.length > 0 ? dashboardSummary.charts.moodTrends.labels : MOOD_TREND_LABELS;
  const studentDemographicLocations =
    dashboardSummary?.charts?.studentDemographics?.locations?.length > 0
      ? dashboardSummary.charts.studentDemographics.locations
      : STUDENT_DEMOGRAPHICS;
  const studentDemographicSplit =
    dashboardSummary?.charts?.studentDemographics?.genderSplit?.length > 0
      ? withColors(dashboardSummary.charts.studentDemographics.genderSplit, ["#2E7D32", "#43A047", "#A5D6A7"])
      : DEMOGRAPHIC_SPLIT;
  const activeUsageSeries =
    dashboardSummary?.charts?.activeUsageByCourseYear?.series?.length > 0
      ? withColors(dashboardSummary.charts.activeUsageByCourseYear.series, ["#3E8914", "#3DA35D", "#96E072", "#134611"])
      : ACTIVE_USAGE_PROGRAM_DATA;
  const primaryConcernsData =
    dashboardSummary?.charts?.primaryConcerns?.length > 0
      ? withColors(
          dashboardSummary.charts.primaryConcerns,
          ["#1B5E20", "#2E7D32", "#43A047", "#66BB6A", "#558B2F", "#7CB342", "#8BC34A", "#A5D6A7", "#C5E1A5", "#0F766E", "#0369A1", "#BE185D", "#7C3AED", "#64748B"],
        )
      : PRIMARY_CONCERNS;
  const barangayConcernData =
    dashboardSummary?.charts?.topConcernsByBarangay?.length > 0
      ? dashboardSummary.charts.topConcernsByBarangay.map((item, index, items) => ({
          ...item,
          percent: items[0]?.value ? Math.round((item.value / items[0].value) * 100) : 0,
        }))
      : BARANGAY_DATA;
  const handleSummaryCardSelect = (cardTitle) => {
    if (cardTitle === "Flagged Entries") {
      setFlaggedModalOpen(true);
      return;
    }
    if (cardTitle === "Scheduled Today") {
      navigate("/appointments");
    }
  };

  return (
    <Layout
      title="Overview & Analytics"
      subtitle="Monitor daily engagement, demographics, and student support signals."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {summaryError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Dashboard cards are showing fallback values because live summary data failed to load: {summaryError}
          </div>
        ) : null}
        {riskFlagsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Flagged entries preview failed to load: {riskFlagsError}
          </div>
        ) : null}
        {appointmentsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Appointments failed to load: {appointmentsError}
          </div>
        ) : null}
        {rolesError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Team preview failed to load: {rolesError}
          </div>
        ) : null}
        {analyticsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Overview analytics failed to load: {analyticsError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate("/appointments")}
            className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            <CalendarIcon className="h-4 w-4 text-emerald-600" />
            {todayLabel}
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Journal Entries Volume" subtitle="Total journal entries for the current month" className="lg:col-span-2">
            <JournalEntriesGraph data={journalEntriesData} />
          </Card>

          <Card title="Student Gender Demographics" subtitle="Student profile distribution across submitted records">
            <DonutChart
              data={genderData}
              centerValue={genderData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
            />
            <ChartLegend data={genderData} />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.9fr]">
          <Card title="Student Emotion Trends (Current Month)" subtitle="Daily emotion check-ins recorded from the mobile app this month">
            <MoodTrendsChart labels={moodTrendLabels} series={moodTrendData} />
          </Card>

          <Card title="Student Demographics" subtitle="Distribution by location and gender">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.45fr,0.85fr]">
              <StudentDemographicsChart data={studentDemographicLocations} />
              <div className="flex flex-col justify-center">
                <DonutChart
                  data={studentDemographicSplit}
                  size={180}
                  strokeWidth={18}
                  centerValue={studentDemographicSplit.reduce((sum, item) => sum + item.value, 0)}
                  centerLabel="Tracked students"
                />
                <ChartLegend data={studentDemographicSplit} className="justify-start" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.8fr,1fr]">
          <Card title="Student Distribution by Program" subtitle="Enrolled students grouped by program">
            <ActiveUsageGraph data={activeUsageSeries} />
          </Card>

          <Card title="Top Journal Themes" subtitle="Saved journal tags used for analytics">
            <ConcernThemesChart data={primaryConcernsData} />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Top Concerns by Barangay" subtitle="Most active barangays based on submitted journal entries">
            <div className="space-y-4">
              {barangayConcernData.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  title={`${item.label}: ${item.value.toLocaleString()} entries`}
                  className="group -mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 transition-colors group-hover:text-emerald-700">
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
          </Card>

          <Card title="Support Signals" subtitle="Snapshot of entries that may need faster response">
            <div className="space-y-4">
              <button
                type="button"
                title="High-risk queue"
                className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-red-700">High-risk queue</div>
                  <div className="mt-1 text-sm text-red-500">4 entries need counselor review within the hour</div>
                </div>
                <div className="text-2xl font-bold text-red-700">4</div>
              </button>
              <button
                type="button"
                title="Medium-priority follow-ups"
                className="flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-amber-700">Medium-priority follow-ups</div>
                  <div className="mt-1 text-sm text-amber-600">11 students asked for a counselor check-in this week</div>
                </div>
                <div className="text-2xl font-bold text-amber-700">11</div>
              </button>
              <button
                type="button"
                title="Outbound contacts completed"
                className="flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">Outbound contacts completed</div>
                    <div className="mt-1 text-sm text-emerald-600">8 students were reached by counselors today</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-700">8</div>
              </button>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Concern Trends Over Time" subtitle="Stacked view of primary concerns">
            <ConcernTrendsPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>

          <Card title="Counselor Workload" subtitle="Active cases assigned per role">
            <CounselorWorkloadPanel analytics={analyticsOverview} loading={analyticsLoading} />
          </Card>

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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Schedules & Appointments" subtitle="Today's sessions and related concern tags">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-500">{`Today, ${formatAppointmentDateLabel(now.toISOString())}`}</div>
              <div className="flex flex-wrap rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCalendarTab("my")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    calendarTab === "my" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  My Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarTab("overall")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    calendarTab === "overall" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Overall Admin
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarTab("peer")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                    calendarTab === "peer" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Peer Counselors
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {appointmentItems.length ? (
                appointmentItems.map((item) => (
                  <AppointmentCard key={`${item.time}-${item.student}`} item={item} onClick={() => navigate(item.route || "/appointments")} />
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No appointments scheduled for today.
                </div>
              )}
            </div>
          </Card>

          <Card title="Team Roles" subtitle="Guidance counselors, peer counselors, and their current role status">
            <div className="space-y-4">
              {roleMembers.length ? (
                roleMembers.map((item) => (
                  <TeamMemberCard key={`${item.memberType || "member"}-${item.id}`} item={item} onClick={() => navigate("/roles")} />
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No team members found right now.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate("/roles")}
              title="Manage Roles & Assignments"
              className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Manage Roles & Assignments
            </button>
          </Card>
        </div>

        <FlaggedEntriesModal
          isOpen={flaggedModalOpen}
          onClose={() => setFlaggedModalOpen(false)}
          entries={riskFlags}
          onReviewAll={() => {
            setFlaggedModalOpen(false);
            navigate("/flagged");
          }}
        />

      </div>
    </Layout>
  );
}

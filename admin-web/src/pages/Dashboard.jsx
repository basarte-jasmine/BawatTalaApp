import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { fetchAdminDashboardSummary } from "../lib/admin-api";

const TEMP_GENDER_DATA = [
  { label: "FEMALE", value: 42 },
  { label: "MALE", value: 31 },
  { label: "NON-BINARY", value: 4 },
];
const TEMP_COURSE_DATA = [
  { label: "BS Information Technology", value: 28 },
  { label: "BS Psychology", value: 14 },
  { label: "BSEd English", value: 11 },
  { label: "BS Civil Engineering", value: 9 },
];
const TEMP_ACTIVE_USAGE_DATA = [
  { label: "2026-01", value: 18 },
  { label: "2026-02", value: 24 },
  { label: "2026-03", value: 33 },
  { label: "2026-04", value: 29 },
];
const TEMP_JOURNAL_DATA = [
  { label: "2026-01", value: 84 },
  { label: "2026-02", value: 96 },
  { label: "2026-03", value: 121 },
  { label: "2026-04", value: 109 },
];
const TEMP_BARANGAY_DATA = [
  { label: "Malanday", value: 10 },
  { label: "Karuhatan", value: 9 },
  { label: "Gen. T. de Leon", value: 8 },
  { label: "Marulas", value: 7 },
];

function normalizeCountMap(mapObj = {}) {
  return Object.entries(mapObj)
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value);
}

function DonutChart({ data }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const colors = ["#7226ff", "#f042ff", "#160078", "#010030", "#87f5f5"];
  let progress = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#ececf7" strokeWidth="16" />
        {data.map((item, index) => {
          const share = item.value / total;
          const strokeDasharray = `${share * circumference} ${circumference}`;
          const strokeDashoffset = -progress * circumference;
          progress += share;
          return (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="16"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 70 70)"
              strokeLinecap="round"
            />
          );
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-admin-muted text-[10px] font-bold">
          TOTAL
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-admin-ink text-[16px] font-black">
          {total}
        </text>
      </svg>

      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="max-w-[11rem] truncate text-admin-ink">{item.label}</span>
            <span className="font-black text-admin-ink">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineAreaChart({ data, color = "#7226ff" }) {
  const w = 520;
  const h = 180;
  const pad = 20;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value), 0);

  const points = data
    .map((d, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
      const y = h - pad - ((d.value - min) * (h - pad * 2)) / Math.max(1, max - min);
      return { ...d, x, y };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points.at(-1)?.x || pad},${h - pad} L${points[0]?.x || pad},${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="usageArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#usageArea)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-4 gap-2 text-xs font-semibold text-admin-muted">
        {data.map((d) => (
          <span key={d.label} className="truncate text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ColumnChart({ data, color = "#160078" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid grid-cols-4 gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end rounded-md bg-admin-track p-1">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(8, (item.value / max) * 100)}%`,
                background: `linear-gradient(180deg, ${color}, #010030)`,
              }}
            />
          </div>
          <p className="text-xs font-semibold text-admin-muted">{item.label}</p>
          <p className="text-xs font-black text-admin-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RankBars({ data, accentClass = "bg-admin-brand" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate font-semibold text-admin-ink">
              {idx + 1}. {item.label}
            </span>
            <span className="font-black text-admin-ink">{item.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-admin-track">
            <div
              className={`h-2.5 rounded-full ${accentClass}`}
              style={{ width: `${Math.max(10, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VerticalRankingChart({ data, color = "#7226ff" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.map((item, idx) => (
          <div key={item.label} className="flex flex-col items-center">
            <div className="mb-2 text-xs font-bold text-admin-muted">#{idx + 1}</div>
            <div className="flex h-36 w-full items-end rounded-md bg-white px-2 pb-2">
              <div
                className="w-full rounded-md"
                style={{
                  height: `${Math.max(10, (item.value / max) * 100)}%`,
                  background: `linear-gradient(180deg, ${color} 0%, #010030 100%)`,
                }}
              />
            </div>
            <div className="mt-2 text-center">
              <p className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold text-admin-ink">
                {item.label}
              </p>
              <p className="text-sm font-black text-admin-ink">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    cards: { totalUsers: 0, gender: {}, course: {} },
    charts: { activeUsage: [], journalEntries: [], barangay: [] },
    warnings: { journalEntriesUnavailable: false },
  });

  useEffect(() => {
    let mounted = true;
    async function loadSummary() {
      try {
        setLoading(true);
        const data = await fetchAdminDashboardSummary();
        if (mounted) setSummary(data);
      } catch (requestError) {
        if (mounted) setError(requestError.message || "Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSummary();
    return () => {
      mounted = false;
    };
  }, []);

  const genderData = useMemo(() => normalizeCountMap(summary.cards.gender), [summary.cards.gender]);
  const courseData = useMemo(() => normalizeCountMap(summary.cards.course), [summary.cards.course]);
  const barangayData = useMemo(
    () =>
      (summary.charts.barangay || [])
        .map((entry) => ({ label: entry.label, value: Number(entry.value) || 0 }))
        .sort((a, b) => b.value - a.value),
    [summary.charts.barangay],
  );
  const activeUsageData = useMemo(
    () =>
      (summary.charts.activeUsage || []).map((entry) => ({
        label: entry.label,
        value: Number(entry.value) || 0,
      })),
    [summary.charts.activeUsage],
  );
  const journalEntriesData = useMemo(
    () =>
      (summary.charts.journalEntries || []).map((entry) => ({
        label: entry.label,
        value: Number(entry.value) || 0,
      })),
    [summary.charts.journalEntries],
  );

  const displayGenderData = genderData.length ? genderData : TEMP_GENDER_DATA;
  const displayCourseData = courseData.length ? courseData : TEMP_COURSE_DATA;
  const displayActiveUsageData = activeUsageData.length ? activeUsageData : TEMP_ACTIVE_USAGE_DATA;
  const displayJournalEntriesData = journalEntriesData.length ? journalEntriesData : TEMP_JOURNAL_DATA;
  const displayBarangayData = barangayData.length ? barangayData : TEMP_BARANGAY_DATA;

  const isUsingTempData =
    !genderData.length ||
    !courseData.length ||
    !activeUsageData.length ||
    !journalEntriesData.length ||
    !barangayData.length;

  return (
    <Layout title="Dashboard" subtitle="Analytics Overview" onLogout={onLogout}>
      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="rounded-lg border border-admin-border bg-white p-6 text-sm text-admin-muted">
          Loading dashboard data...
        </p>
      ) : null}
      {!loading && isUsingTempData ? (
        <p className="mb-4 rounded-lg border border-admin-border bg-admin-surface p-3 text-xs text-admin-muted">
          Showing temporary chart data where live data is still empty.
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon="👥" label="How Many Users" value={String(summary.cards.totalUsers || 77)} />
        <StatCard icon="🚻" label="Gender Groups" value={String(displayGenderData.length)} />
        <StatCard icon="🎓" label="Courses" value={String(displayCourseData.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Gender Distribution" subtitle="Donut chart by gender groups">
          <DonutChart data={displayGenderData} />
        </Card>

        <Card title="Course Distribution" subtitle="Vertical ranking chart by course population">
          <VerticalRankingChart data={displayCourseData} color="#f042ff" />
        </Card>

        <Card title="Active Usage" subtitle="Line/area trend per month">
          <LineAreaChart data={displayActiveUsageData} color="#7226ff" />
        </Card>

        <Card title="Journal Entries" subtitle="Column chart per month">
          <ColumnChart data={displayJournalEntriesData} color="#160078" />
          {summary.warnings.journalEntriesUnavailable ? (
            <p className="mt-3 text-xs text-admin-muted">
              Journal table not found yet. This module is placeholder-ready for your data.
            </p>
          ) : null}
        </Card>

        <Card title="Barangay" subtitle="Vertical ranking chart by user count" className="xl:col-span-2">
          <VerticalRankingChart data={displayBarangayData} color="#7226ff" />
        </Card>
      </div>
    </Layout>
  );
}

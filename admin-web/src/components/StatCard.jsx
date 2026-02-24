export default function StatCard({
  icon,
  label,
  value,
  change,
  isPositive = true,
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-admin-surface p-2 text-2xl">{icon}</div>
        {change && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
          >
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>{change}%</span>
          </div>
        )}
      </div>
      <p className="mb-2 text-sm text-admin-muted">{label}</p>
      <h3 className="text-2xl font-black text-admin-ink">{value}</h3>
    </div>
  );
}

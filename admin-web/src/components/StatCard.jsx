export default function StatCard({
  icon,
  label,
  value,
  change,
  isPositive = true,
}) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-primary-yellow rounded-lg text-2xl">{icon}</div>
        {change && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-secondary-rust"}`}
          >
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>{change}%</span>
          </div>
        )}
      </div>
      <p className="text-neutral-600 text-sm mb-2">{label}</p>
      <h3 className="text-2xl font-bold text-neutral-900">{value}</h3>
    </div>
  );
}

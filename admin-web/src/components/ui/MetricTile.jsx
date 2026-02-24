export default function MetricTile({
  label,
  value,
  valueClassName = "text-admin-ink",
  className = "",
}) {
  return (
    <div className={`rounded-xl border border-admin-border bg-admin-surface p-4 ${className}`}>
      <p className="text-xs uppercase tracking-wider text-admin-muted">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

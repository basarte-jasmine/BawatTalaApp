export default function RankBars({
  data,
  barClassName = "bg-gradient-to-r from-admin-purple to-admin-brand",
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-admin-ink">
              {index + 1}. {item.label}
            </span>
            <span className="font-black text-admin-ink">{item.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-admin-track">
            <div
              className={`h-2.5 rounded-full ${barClassName}`}
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VerticalBarGrid({
  data,
  color = "linear-gradient(180deg, #7226ff 0%, #010030 100%)",
  barAreaClassName = "h-36",
  valueClassName = "text-admin-ink",
  labelClassName = "text-admin-muted",
  showRank = false,
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {data.map((item, idx) => (
        <div key={item.label} className="flex flex-col items-center">
          {showRank ? (
            <div className="mb-2 text-xs font-bold text-admin-muted">#{idx + 1}</div>
          ) : null}
          <div className={`mb-2 flex w-full items-end rounded-lg bg-admin-track p-2 ${barAreaClassName}`}>
            <div
              className="w-full rounded-md"
              style={{
                height: `${Math.max(10, (item.value / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <p className={`line-clamp-2 min-h-[2.5rem] text-center text-xs font-semibold ${labelClassName}`}>
            {item.label}
          </p>
          <p className={`text-sm font-black ${valueClassName}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

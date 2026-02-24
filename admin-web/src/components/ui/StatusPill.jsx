const STATUS_CLASSES = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-admin-surface text-admin-ink",
};

export default function StatusPill({ children, tone = "info" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASSES[tone] || STATUS_CLASSES.info}`}>
      {children}
    </span>
  );
}

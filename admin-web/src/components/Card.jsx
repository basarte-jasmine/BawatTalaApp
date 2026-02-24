export default function Card({
  children,
  className = "",
  title,
  subtitle,
  icon,
}) {
  return (
    <div
      className={`rounded-xl border border-admin-border bg-white p-6 shadow-sm transition hover:shadow-md ${className}`}
    >
      {(title || icon) && (
        <div className="mb-4 flex items-start gap-3">
          {icon && (
            <div className="rounded-lg bg-admin-surface p-2 text-xl">
              {icon}
            </div>
          )}
          <div>
            {title && (
              <h3 className="font-semibold text-admin-ink">{title}</h3>
            )}
            {subtitle && <p className="text-sm text-admin-muted">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

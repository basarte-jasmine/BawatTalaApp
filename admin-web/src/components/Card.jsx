export default function Card({
  children,
  className = "",
  title,
  subtitle,
  icon,
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow p-6 ${className}`}
    >
      {(title || icon) && (
        <div className="flex items-start gap-3 mb-4">
          {icon && (
            <div className="p-2 bg-primary-yellow rounded-lg text-xl">
              {icon}
            </div>
          )}
          <div>
            {title && (
              <h3 className="font-semibold text-neutral-900">{title}</h3>
            )}
            {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

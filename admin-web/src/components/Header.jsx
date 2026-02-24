export default function Header({
  title = "Dashboard",
  subtitle = "",
  onMenuToggle,
}) {
  return (
    <header className="border-b border-admin-border bg-white/70 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-sm font-bold text-admin-ink md:hidden"
          aria-label="Open menu"
        >
          Menu
        </button>
        <div>
          <h2 className="font-display text-3xl text-admin-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-admin-muted">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}

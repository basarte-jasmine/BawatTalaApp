export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-admin-frame p-4 md:p-8">
      <div className="mx-auto max-w-5xl rounded-2xl bg-admin-surface p-6 md:p-10 shadow-admin">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-admin-border bg-admin-card px-6 py-8 md:px-8 md:py-10">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-admin-border bg-admin-logo text-2xl font-black text-admin-brand">
              BT
            </div>
            <h1 className="font-display text-4xl leading-tight text-admin-ink">{title}</h1>
            <p className="mt-2 text-sm text-admin-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

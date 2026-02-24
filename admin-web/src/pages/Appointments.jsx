import Layout from "../components/Layout";

const FALLBACK_EMBED_URL =
  "https://calendar.google.com/calendar/embed?src=en.philippines%23holiday%40group.v.calendar.google.com&ctz=Asia%2FManila";

export default function Appointments({ onLogout }) {
  const embedUrl =
    import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL || FALLBACK_EMBED_URL;

  return (
    <Layout
      title="Appointments"
      subtitle="Calendar and schedule management"
      onLogout={onLogout}
    >
      <section className="relative overflow-hidden rounded-3xl border border-admin-border bg-gradient-to-br from-[#efe8ff] via-[#f7f3ff] to-[#e7eeff] p-3 shadow-[0_22px_60px_rgba(16,19,33,0.18)] md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(240,66,255,0.28),transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(114,38,255,0.24),transparent_70%)]" />

        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-border bg-white/95 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_18px_rgba(16,19,33,0.08)] backdrop-blur">
          <div>
            <h3 className="text-lg font-black text-admin-ink">Calendar</h3>
            <p className="text-sm text-admin-muted">
              Manage appointments directly from Google Calendar.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-admin-border bg-white px-4 py-2 text-sm font-semibold text-admin-ink transition hover:-translate-y-[1px] hover:bg-admin-surface"
            >
              Open Google
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-admin-purple via-[#4b1bcf] to-admin-deep px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(22,0,120,0.36)] transition hover:-translate-y-[1px] hover:opacity-95"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#b8c3df] bg-[#dfe5f2] p-[2px] shadow-[0_12px_32px_rgba(16,19,33,0.18)]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(114,38,255,0.25),rgba(240,66,255,0.12),rgba(135,245,245,0.18))]" />
          <div className="relative overflow-hidden rounded-[14px] border border-[#c7d2ea] bg-[#eef1f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <iframe
            title="Bawat Tala Appointments Calendar"
            src={embedUrl}
            style={{ border: 0, minHeight: "620px", height: "74vh" }}
            width="100%"
            frameBorder="0"
            scrolling="no"
          />
          </div>
        </div>
      </section>
    </Layout>
  );
}

import { Bell, Menu, Search } from "lucide-react";
import { useState } from "react";
import Modal from "./Modal";

function getAdminProfile(session) {
  const email = String(session?.email || "").trim().toLowerCase();
  if (email === "basartejasmine@gmail.com") {
    return {
      initials: "JB",
      name: session?.name || "Jasmine Batumbakal",
      role: "Head Counselor",
      pictureUrl: session?.pictureUrl || "",
    };
  }

  const displayName = String(session?.name || "").trim();
  const localPart = email.split("@")[0] || "Counselor";
  const words = (displayName || localPart)
    .split(/[._-]+/)
    .flatMap((part) => part.split(/\s+/))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const name = displayName || words.join(" ") || "Counselor Account";
  const initials = words.slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase() || "CO";
  return {
    initials,
    name,
    role: "Counselor",
    pictureUrl: session?.pictureUrl || "",
  };
}

export default function Header({
  title = "Dashboard",
  subtitle = "",
  onMenuToggle,
  session,
}) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const adminProfile = getAdminProfile(session);

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onMenuToggle}
              className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1 text-sm font-bold text-admin-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm text-admin-muted">Overview</p>
              <h2 className="font-display text-3xl text-admin-ink">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-admin-muted">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex h-12 min-w-0 items-center md:w-[34rem]">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 transition-colors group-hover:text-emerald-600" />
              <input
                type="text"
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                placeholder="Search students, entries, or settings..."
                className="w-full cursor-text rounded-lg border border-gray-200 bg-[#FAFAF9] py-2 pl-10 pr-4 text-sm text-admin-ink transition-all hover:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="flex items-center gap-6 self-end md:self-auto">
              <div className="relative cursor-pointer rounded-full p-2 transition-colors hover:bg-gray-100">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-amber-500" />
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{adminProfile.name}</div>
                  <div className="text-xs font-medium text-emerald-700">{adminProfile.role}</div>
                </div>
                {adminProfile.pictureUrl ? (
                  <img
                    src={adminProfile.pictureUrl}
                    alt={adminProfile.name}
                    className="h-10 w-10 rounded-full border border-gray-200 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-[linear-gradient(135deg,#96E072,#3DA35D)] text-sm font-bold text-white shadow-sm">
                    {adminProfile.initials}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title="Global Search">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Type to search anything..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="py-8 text-center text-sm text-gray-500">
            Start typing to see students, recent entries, and appointments.
          </div>
        </div>
      </Modal>
    </>
  );
}

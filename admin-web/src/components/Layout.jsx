import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useAdminPreferences } from "../lib/admin-preferences";

export default function Layout({ children, title, subtitle, onLogout, session, mainClassName = "bg-[#f4f6ef]" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { preferences } = useAdminPreferences();
  const preferenceClassName = [
    preferences.appearance.compactCards ? "bt-admin-compact" : "",
    preferences.appearance.reduceMotion ? "bt-admin-reduce-motion" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`h-screen overflow-hidden bg-white ${preferenceClassName}`}>
      <div className="flex h-full overflow-hidden bg-white">
        <Sidebar onLogout={onLogout} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        {menuOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header title={title} subtitle={subtitle} onMenuToggle={() => setMenuOpen(true)} session={session} />

          <main className={`min-h-0 flex-1 overflow-y-auto ${mainClassName}`}>
            <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

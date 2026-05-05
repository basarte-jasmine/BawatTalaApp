import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children, title, subtitle, onLogout, session }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-admin-frame p-3 md:p-5">
      <div className="mx-auto flex h-[calc(100vh-24px)] max-w-[1520px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#eef3e8] shadow-admin md:h-[calc(100vh-40px)]">
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

          <main className="min-h-0 flex-1 overflow-y-auto bg-[#f4f6ef]">
            <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

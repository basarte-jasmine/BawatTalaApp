import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children, title, subtitle, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-admin-surface">
      <Sidebar
        onLogout={onLogout}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      ) : null}

      <div className="flex flex-1 flex-col transition-all duration-300 md:ml-64">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuToggle={() => setMenuOpen(true)}
        />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

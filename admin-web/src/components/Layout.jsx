import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children, title, onLogout }) {
  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar onLogout={onLogout} />

      <div className="flex-1 flex flex-col ml-64 transition-all duration-300">
        <Header title={title} />

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

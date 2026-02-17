import { useState } from "react";

export default function Header({ title = "Dashboard" }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Title */}
          <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-neutral-100 rounded-lg transition-colors text-lg">
              🔔
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary-rust rounded-full"></span>
            </button>

            {/* Profile */}
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-lime to-primary-mint rounded-full flex items-center justify-center text-lg">
                👤
              </div>
              <span className="hidden sm:inline text-sm font-medium text-neutral-700">
                Admin
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

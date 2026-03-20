import { useState, useRef, useEffect } from "react";
import { getStatus } from "../utils/index.js";

export default function TopBar({
  isMobile,
  search,
  setSearch,
  syncing,
  onSync,
  onShowAdd,
  filterStatus,
  setFilterStatus,
  uniqueStatuses,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <div
      className={`sticky top-0 z-40 bg-dark-bg border-b border-dark-border flex items-center justify-between ${
        isMobile ? "px-4 py-3 gap-3" : "px-7 py-4 gap-4"
      }`}
    >
      {/* Left: Title + actions */}
      <div className="flex items-center gap-2.5">
        <h1 className={`font-bold text-dark-text tracking-tight ${isMobile ? "text-xl" : "text-2xl"}`}>
          Apps
        </h1>
        <button
          onClick={onShowAdd}
          className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center cursor-pointer border-none text-sm font-bold leading-none"
        >
          +
        </button>
        <button
          onClick={onSync}
          className="text-accent cursor-pointer bg-transparent border-none text-lg font-bold leading-none p-0.5"
          title="More options"
        >
          <span
            className="inline-block"
            style={{ animation: syncing ? "asc-spin 1s linear infinite" : "none" }}
          >
            {syncing ? "\u21bb" : "\u2026"}
          </span>
        </button>
      </div>

      {/* Right: Search + Status filter */}
      <div className="flex items-center gap-3">
        {/* Expandable search */}
        <div className="flex items-center">
          {searchOpen ? (
            <div className="flex items-center gap-2 border border-dark-border rounded-lg px-3 py-1.5 bg-dark-surface">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" className="shrink-0">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                placeholder="Search apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search) setSearchOpen(false); }}
                className="bg-transparent border-none outline-none text-dark-text font-sans text-sm w-40"
              />
              {search && (
                <span
                  onClick={() => { setSearch(""); setSearchOpen(false); }}
                  className="cursor-pointer text-dark-dim text-xs"
                >
                  {"\u2715"}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="bg-transparent border-none cursor-pointer p-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter dropdown */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm text-dark-text bg-transparent border-none cursor-pointer font-sans appearance-none pr-5 py-1 outline-none font-medium"
          >
            <option value="ALL">All Statuses</option>
            {uniqueStatuses.map((st) => (
              <option key={st} value={st}>{getStatus(st).label}</option>
            ))}
          </select>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2.5"
            className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

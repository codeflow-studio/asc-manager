export default function TopBar({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  search,
  setSearch,
  syncing,
  onSync,
  onShowAdd,
}) {
  return (
    <div
      className={`sticky top-0 z-40 bg-dark-bg/85 backdrop-blur-[16px] border-b border-dark-border flex items-center justify-between ${
        isMobile ? "px-3 h-[50px] gap-2" : "px-7 h-[54px] gap-4"
      }`}
    >
      <div className={`flex items-center flex-1 min-w-0 ${isMobile ? "gap-2" : "gap-3"}`}>
        <span
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="cursor-pointer text-lg text-dark-faint p-1.5 select-none shrink-0"
        >
          {"\u2630"}
        </span>
        <div
          className={`flex items-center gap-2 bg-dark-card border border-dark-border rounded-lg px-3.5 py-[7px] flex-1 min-w-0 ${
            isMobile ? "" : "max-w-[300px]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4a55" strokeWidth="2" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder={isMobile ? "Search..." : "Search apps, bundle IDs..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`bg-transparent border-none outline-none text-dark-text font-sans w-full min-w-0 ${
              isMobile ? "text-sm" : "text-[13px]"
            }`}
          />
          {search && (
            <span onClick={() => setSearch("")} className="cursor-pointer text-dark-faint text-xs shrink-0">
              {"\u2715"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onSync}
          className={`rounded-lg text-xs font-semibold bg-[#141418] text-dark-label border border-dark-border-light cursor-pointer font-sans flex items-center gap-1.5 ${
            isMobile ? "px-2.5 py-[7px]" : "px-4 py-[7px]"
          }`}
        >
          <span
            className="inline-block"
            style={{ animation: syncing ? "asc-spin 1s linear infinite" : "none" }}
          >
            {"\u21bb"}
          </span>
          {!isMobile && (syncing ? "Syncing..." : "Sync All")}
        </button>
        {!isMobile && (
          <button
            onClick={onShowAdd}
            className="px-4 py-[7px] rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
          >
            + Add Account
          </button>
        )}
      </div>
    </div>
  );
}

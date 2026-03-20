export default function Sidebar({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  view,
  setView,
  filterAccount,
  setFilterAccount,
  setFilterStatus,
  accounts,
  apps,
  navItems,
  closeSidebarOnMobile,
  onShowAdd,
}) {
  return (
    <div
      className="bg-dark-sidebar border-r border-dark-border flex flex-col shrink-0 overflow-hidden"
      style={
        isMobile
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 51,
              width: 280,
              transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            }
          : {
              width: sidebarOpen ? 256 : 0,
              transition: "width 0.25s ease",
            }
      }
    >
      {/* Logo */}
      <div className="px-[18px] pt-[18px] pb-3.5 border-b border-dark-border flex items-center gap-2.5 min-w-[240px]">
        <div className="w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-accent to-purple flex items-center justify-center text-[17px] font-extrabold text-white">
          A
        </div>
        <div>
          <div className="text-sm font-extrabold tracking-tight">ASC Manager</div>
          <div className="text-[10px] text-dark-ghost font-semibold">Multi-Account Hub</div>
        </div>
        {isMobile && (
          <span
            onClick={() => setSidebarOpen(false)}
            className="ml-auto cursor-pointer text-dark-dim text-lg px-2 py-1"
          >
            {"\u2715"}
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="px-2 py-2.5 flex-1 overflow-y-auto min-w-[240px]">
        <div className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-dark-ghost px-3 pt-3.5 pb-1.5">
          Overview
        </div>
        {navItems.map((n) => {
          const active = view === n.key;
          return (
            <div
              key={n.key}
              onClick={() => {
                setView(n.key);
                setFilterStatus(n.statusFilter);
                setFilterAccount("ALL");
                closeSidebarOnMobile();
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-[13px] font-medium transition-all ${
                active
                  ? "bg-accent-bg text-accent-light border border-accent-border"
                  : "text-dark-muted border border-transparent"
              }`}
            >
              <span className={`text-sm w-5 text-center ${active ? "opacity-100" : "opacity-50"}`}>
                {n.icon}
              </span>
              {n.label}
              <span className={`ml-auto text-[11px] font-bold font-mono ${active ? "text-accent-light" : "text-dark-phantom"}`}>
                {n.count}
              </span>
            </div>
          );
        })}

        <div className="text-[9.5px] font-bold tracking-[0.1em] uppercase text-dark-ghost px-3 pt-5 pb-1.5">
          Accounts
        </div>
        {accounts.map((acc) => {
          const active = filterAccount === acc.name;
          const cnt = apps.filter((a) => a.account === acc.name).length;
          return (
            <div
              key={acc.id}
              onClick={() => {
                setFilterAccount(active ? "ALL" : acc.name);
                setFilterStatus("ALL");
                setView("all");
                closeSidebarOnMobile();
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-[13px] font-medium ${
                active
                  ? "bg-accent-bg text-accent-light border border-accent-border"
                  : "text-dark-muted border border-transparent"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: acc.color }}
              />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{acc.name}</span>
              <span className={`ml-auto text-[11px] font-bold font-mono ${active ? "text-accent-light" : "text-dark-phantom"}`}>
                {cnt}
              </span>
            </div>
          );
        })}
        <div
          onClick={() => { onShowAdd(); closeSidebarOnMobile(); }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-[13px] font-semibold text-accent mt-1"
        >
          <span className="text-base w-5 text-center">+</span>
          Add Account
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-dark-border min-w-[240px]">
        <div className="text-[10px] text-dark-phantom text-center leading-relaxed">
          App Store Connect API v2<br />
          {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
        </div>
      </div>
    </div>
  );
}

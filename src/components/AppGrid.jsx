import Badge from "./Badge.jsx";

export default function AppGrid({ filtered, accounts, onSelectApp, isMobile }) {
  if (filtered.length === 0) {
    return (
      <div className={`text-center text-dark-ghost ${isMobile ? "px-4 py-10" : "px-5 py-[60px]"}`}>
        <div className="text-4xl mb-2.5">{"\ud83d\udd0d"}</div>
        <div className="text-sm font-semibold">No apps found</div>
        <div className="text-xs mt-1 text-dark-phantom">Adjust filters or search query</div>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(340px,1fr))]"}`}>
      {filtered.map((app, idx) => {
        const acct = accounts.find((a) => a.name === app.account);
        return (
          <div
            key={app.id}
            onClick={() => onSelectApp(app)}
            className={`asc-app-card bg-dark-card border border-dark-border rounded-xl flex items-center cursor-pointer transition-all ${
              isMobile ? "px-3.5 py-3 gap-3" : "px-4 py-3.5 gap-3.5"
            }`}
            style={{ animation: `asc-fadein 0.3s ease ${idx * 20}ms both` }}
          >
            <div
              className={`rounded-xl bg-dark-border border border-dark-hover-border flex items-center justify-center shrink-0 ${
                isMobile ? "w-11 h-11 text-xl" : "w-[50px] h-[50px] text-[22px]"
              }`}
            >
              {app.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                {app.name}
              </div>
              <div className="flex items-center gap-2 mt-[5px]">
                <Badge status={app.status} />
                <span className="text-[11px] text-dark-ghost font-mono">
                  {app.platform} {app.version}
                </span>
              </div>
              <div className="flex items-center gap-[5px] mt-[5px]">
                {acct && (
                  <span
                    className="w-[7px] h-[7px] rounded-full"
                    style={{ background: acct.color }}
                  />
                )}
                <span className="text-[11px] text-dark-ghost">{app.account}</span>
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#222228" strokeWidth="2.5" className="shrink-0">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

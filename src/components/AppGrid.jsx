import Badge from "./Badge.jsx";
import AppIcon from "./AppIcon.jsx";

export default function AppGrid({ filtered, accounts, onSelectApp, isMobile }) {
  if (filtered.length === 0) {
    return (
      <div className="text-center text-dark-ghost px-5 py-16">
        <div className="text-sm font-semibold">No apps found</div>
        <div className="text-xs mt-1 text-dark-phantom">Adjust filters or search query</div>
      </div>
    );
  }

  const columns = isMobile ? 1 : 3;
  const rows = [];
  for (let i = 0; i < filtered.length; i += columns) {
    rows.push(filtered.slice(i, i + columns));
  }

  return (
    <div>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx}>
          <div className="border-t border-dark-border" />
          <div
            className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}
            style={{ animation: `asc-fadein 0.3s ease ${rowIdx * 40}ms both` }}
          >
            {row.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app)}
                className="asc-app-card flex items-center gap-4 px-3 cursor-pointer rounded-lg transition-colors"
                style={{ paddingTop: 24, paddingBottom: 24 }}
              >
                <AppIcon app={app} />
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-dark-text truncate">
                    {app.name}
                  </div>
                  <Badge status={app.status} version={app.version} platform={app.platform} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-dark-border" />
    </div>
  );
}

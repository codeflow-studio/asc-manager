import Badge from "./Badge.jsx";
import AppIcon from "./AppIcon.jsx";

export default function AppGrid({ grouped, accounts, onSelectApp, isMobile }) {
  const totalApps = grouped.reduce((sum, g) => sum + g.apps.length, 0);

  if (totalApps === 0) {
    return (
      <div className="text-center text-dark-ghost px-5 py-16">
        <div className="text-sm font-semibold">No apps found</div>
        <div className="text-xs mt-1 text-dark-phantom">Adjust filters or search query</div>
      </div>
    );
  }

  const columns = isMobile ? 1 : 3;

  return (
    <div>
      {grouped.map((group, groupIdx) => {
        const rows = [];
        for (let i = 0; i < group.apps.length; i += columns) {
          rows.push(group.apps.slice(i, i + columns));
        }

        return (
          <div key={group.key}>
            {group.label && (
              <div className={`flex items-center gap-2 px-3 ${groupIdx === 0 ? "pt-3" : "pt-6"} pb-2`}>
                {group.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: group.color }} />
                )}
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-dark-ghost">
                  {group.label}
                </span>
                <span className="text-[11px] font-mono text-dark-phantom ml-1">
                  {group.apps.length}
                </span>
              </div>
            )}

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
          </div>
        );
      })}
      <div className="border-t border-dark-border" />
    </div>
  );
}

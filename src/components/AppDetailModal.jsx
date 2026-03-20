import Badge from "./Badge.jsx";

export default function AppDetailModal({ app, accounts, onClose, isMobile }) {
  if (!app) return null;
  const acct = accounts.find((a) => a.name === app.account);

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/40 backdrop-blur-[8px] flex justify-center z-[100] ${isMobile ? "items-end" : "items-center"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-dark-card border border-dark-border-light w-full overflow-y-auto shadow-[0_32px_64px_rgba(0,0,0,0.15)] ${
          isMobile
            ? "rounded-t-2xl max-w-full max-h-[90vh]"
            : "rounded-2xl max-w-[560px]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-[1]">
          <div className="flex items-center gap-3 min-w-0">
            {app.iconUrl ? (
              <img src={app.iconUrl} alt={app.name} className="w-11 h-11 rounded-xl shrink-0 object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center text-xl shrink-0">
                {app.icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[15px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                {app.name}
              </div>
              <div className="text-[11px] text-dark-dim font-mono mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {app.bundleId}
              </div>
            </div>
          </div>
          <span onClick={onClose} className="cursor-pointer text-dark-dim text-lg px-2 py-1 shrink-0">
            {"\u2715"}
          </span>
        </div>

        {/* Body */}
        <div className={isMobile ? "p-4" : "px-6 py-5"}>
          <div className={`grid gap-2.5 mb-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            {[
              ["Status", <Badge status={app.status} version={app.version} platform={app.platform} />],
              ["Version", <span className="font-mono text-[13px] text-dark-text">{app.version}</span>],
              ["Platform", <span className="text-[11px] font-bold text-accent-light bg-accent-bg px-2 py-0.5 rounded">{app.platform}</span>],
              ["Account", (
                <span className="flex items-center gap-1.5 text-[13px] text-dark-text">
                  {acct && <span className="w-[7px] h-[7px] rounded-full" style={{ background: acct.color }} />}
                  {app.account}
                </span>
              )],
            ].map(([label, val], i) => (
              <div key={i} className="bg-dark-surface rounded-[10px] px-3.5 py-3">
                <div className="text-[10px] text-dark-dim font-bold uppercase tracking-wide mb-2">
                  {label}
                </div>
                {val}
              </div>
            ))}
          </div>

          <div className="bg-dark-surface rounded-[10px] px-4 py-3.5 mb-3">
            <div className="text-[10px] text-dark-dim font-bold uppercase tracking-wide mb-2.5">
              Quick Actions
            </div>
            <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-[repeat(4,auto)]"}`}>
              {["Open in ASC", "TestFlight Builds", "App Analytics", "Manage Versions"].map((a) => (
                <button
                  key={a}
                  className="px-3.5 py-2.5 rounded-lg text-[11.5px] font-semibold bg-dark-surface text-dark-label border border-dark-border-light cursor-pointer font-sans"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-dark-surface rounded-[10px] px-4 py-3.5">
            <div className="text-[10px] text-dark-dim font-bold uppercase tracking-wide mb-2.5">
              API Endpoint
            </div>
            <code className="text-[11px] font-mono text-dark-muted leading-[1.8] break-all">
              GET /v1/apps/{app.id}/appStoreVersions
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

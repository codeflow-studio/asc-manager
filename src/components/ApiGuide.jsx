export default function ApiGuide({ isMobile }) {
  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl ${isMobile ? "mt-5 px-4 py-3.5" : "mt-7 px-[22px] py-[18px]"}`}>
      <div className="text-[13px] font-bold mb-2.5 flex items-center gap-2">
        <span className="text-[15px]">{"\ud83d\udd17"}</span> API Integration
      </div>
      <div className="text-xs text-dark-dim leading-[1.8] mb-3.5">
        Uses <span className="text-accent-light">App Store Connect API v2</span> with JWT (ES256).
        Generate keys: ASC {"\u2192"} Users and Access {"\u2192"} Integrations {"\u2192"} App Store Connect API.
      </div>
      <div className={`bg-dark-surface rounded-lg font-mono text-dark-muted leading-[2] overflow-x-auto ${isMobile ? "p-3 text-[10px]" : "px-4 py-3.5 text-[11px]"}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <span className="text-dark-ghost">// Fetch all apps</span><br />
        <span className="text-purple-accent">GET</span>{" "}
        <span className="text-accent-light">https://api.appstoreconnect.apple.com/v1/apps</span><br />
        <span className="text-dark-ghost">Authorization:</span> Bearer {"<signed_jwt>"}<br /><br />
        <span className="text-dark-ghost">// JWT Claims</span><br />
        {"{ "}
        <span className="text-warning">"iss"</span>: <span className="text-success">"ISSUER_ID"</span>,{" "}
        <span className="text-warning">"iat"</span>: <span className="text-purple-accent">now</span>,{" "}
        <span className="text-warning">"exp"</span>: <span className="text-purple-accent">now+20m</span>,{" "}
        <span className="text-warning">"aud"</span>: <span className="text-success">"appstoreconnect-v1"</span>
        {" }"}
      </div>
    </div>
  );
}

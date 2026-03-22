export default function BuildSelectorModal({ builds, attachedBuild, attaching, attachingBuildId, onAttach, onClose, isMobile }) {
  function formatDate(dateString) {
    if (!dateString) return "\u2014";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function stateLabel(state) {
    switch (state) {
      case "VALID": return "Ready";
      case "PROCESSING": return "Processing";
      case "FAILED": return "Failed";
      case "INVALID": return "Invalid";
      default: return state || "\u2014";
    }
  }

  function stateColor(state) {
    switch (state) {
      case "VALID": return "#34c759";
      case "PROCESSING": return "#ff9500";
      case "FAILED":
      case "INVALID": return "#ff3b30";
      default: return "#8e8e93";
    }
  }

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/40 backdrop-blur-[8px] flex justify-center z-[100] ${isMobile ? "items-end" : "items-center"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "asc-fadein 0.3s ease" }}
        className={`bg-dark-card border border-dark-border-light w-full overflow-y-auto shadow-[0_32px_64px_rgba(0,0,0,0.15)] ${
          isMobile
            ? "rounded-t-2xl max-w-full max-h-[90vh]"
            : "rounded-2xl max-w-[540px] max-h-[85vh]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-[1]">
          <span className="text-[15px] font-bold text-dark-text">Select Build</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-dark-surface flex items-center justify-center cursor-pointer border-none hover:bg-dark-hover transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Build list */}
        <div className={isMobile ? "px-4 py-4" : "px-5 py-5"}>
          {builds.length === 0 ? (
            <div className="text-center py-8 text-dark-ghost">
              <div className="text-xs font-semibold">No builds available</div>
              <div className="text-[11px] text-dark-dim mt-1">Upload a build via Xcode or Transporter</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...builds].sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate)).map((b) => {
                const isAttached = attachedBuild?.id === b.id;
                const isAttaching = attaching && attachingBuildId === b.id;
                const canSelect = b.processingState === "VALID" && !isAttached;

                return (
                  <div key={b.id} className={`rounded-[10px] px-4 py-3 ${isAttached ? "border border-success/30 bg-success/5" : "bg-dark-surface"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-dark-text font-mono">
                          Build {b.version}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: stateColor(b.processingState) }} />
                            <span style={{ color: stateColor(b.processingState) }}>{stateLabel(b.processingState)}</span>
                          </span>
                          <span className="text-[11px] text-dark-dim">{formatDate(b.uploadedDate)}</span>
                          {b.minOsVersion && (
                            <span className="text-[11px] text-dark-dim">Min OS {b.minOsVersion}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isAttached ? (
                          <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-success bg-success/10 border border-success/20">
                            Selected
                          </span>
                        ) : canSelect ? (
                          <button
                            onClick={() => onAttach(b.id)}
                            disabled={attaching}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20 cursor-pointer font-sans hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAttaching ? (
                              <span className="inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
                            ) : "Select"}
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-dark-ghost bg-dark-hover">
                            {stateLabel(b.processingState)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

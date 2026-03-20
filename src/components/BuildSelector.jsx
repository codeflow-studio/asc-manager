export default function BuildSelector({ builds, attachedBuild, loading, attaching, attachingBuildId, error, onAttach }) {
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

  if (loading) {
    return (
      <div className="text-center py-8 text-dark-dim">
        <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
        <div className="text-xs font-semibold mt-1">Loading builds...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <div className="text-xs text-danger font-semibold mb-1">Failed to load builds</div>
        <div className="text-[11px] text-dark-dim">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Attached build card */}
      {attachedBuild && (
        <div className="border border-success/30 bg-success/5 rounded-[10px] px-4 py-3">
          <div className="text-[10px] text-success font-bold uppercase tracking-wide mb-2">Selected Build</div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-dark-text font-mono">
                Build {attachedBuild.version}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[11px] text-dark-dim">{formatDate(attachedBuild.uploadedDate)}</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: stateColor(attachedBuild.processingState) }} />
                  <span style={{ color: stateColor(attachedBuild.processingState) }}>{stateLabel(attachedBuild.processingState)}</span>
                </span>
                {attachedBuild.minOsVersion && (
                  <span className="text-[11px] text-dark-dim">Min OS {attachedBuild.minOsVersion}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Build list */}
      {builds.length === 0 ? (
        <div className="text-center py-8 text-dark-ghost">
          <div className="text-xs font-semibold">No builds available</div>
          <div className="text-[11px] text-dark-dim mt-1">Upload a build via Xcode or Transporter</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {builds.map((b) => {
            const isAttached = attachedBuild?.id === b.id;
            const isAttaching = attaching && attachingBuildId === b.id;
            const canSelect = b.processingState === "VALID" && !isAttached;

            return (
              <div key={b.id} className="bg-dark-surface rounded-[10px] px-4 py-3">
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
  );
}

import { useState } from "react";
import BuildSelectorModal from "./BuildSelectorModal.jsx";

export default function BuildSelector({ builds, attachedBuild, loading, attaching, attachingBuildId, error, onAttach, isMobile }) {
  const [showModal, setShowModal] = useState(false);

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

  async function handleAttachFromModal(buildId) {
    await onAttach(buildId);
    setShowModal(false);
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
    <>
      {attachedBuild ? (
        <div className="border border-success/30 bg-success/5 rounded-[10px] px-4 py-3">
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
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20 cursor-pointer font-sans hover:bg-accent/20 transition-colors shrink-0"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-dark-surface rounded-[10px] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-dark-dim font-medium">No build selected</div>
            <div className="text-[11px] text-dark-ghost mt-0.5">Select a build to attach to this version</div>
          </div>
          {builds.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20 cursor-pointer font-sans hover:bg-accent/20 transition-colors shrink-0"
            >
              Select Build
            </button>
          )}
        </div>
      )}

      {showModal && (
        <BuildSelectorModal
          builds={builds}
          attachedBuild={attachedBuild}
          attaching={attaching}
          attachingBuildId={attachingBuildId}
          onAttach={handleAttachFromModal}
          onClose={() => setShowModal(false)}
          isMobile={isMobile}
        />
      )}
    </>
  );
}

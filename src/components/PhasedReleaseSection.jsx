import { useState } from "react";
import { createPhasedRelease, updatePhasedRelease, deletePhasedRelease } from "../api/index.js";
import { PHASED_RELEASE_DAY_PERCENTAGES } from "../constants/index.js";

export default function PhasedReleaseSection({ appId, versionId, accountId, detail, onDetailUpdate, isMobile }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const pr = detail.phasedRelease;
  const hasPhased = !!pr;
  const isActive = pr && (pr.phasedReleaseState === "ACTIVE" || pr.phasedReleaseState === "PAUSED");

  async function handleToggle(wantPhased) {
    setSaving(true);
    setSaveError(null);
    try {
      if (wantPhased && !hasPhased) {
        await createPhasedRelease(appId, versionId, { accountId, phasedReleaseState: "INACTIVE" });
      } else if (!wantPhased && hasPhased) {
        await deletePhasedRelease(appId, versionId, pr.id, accountId);
      }
      await onDetailUpdate();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePauseResume(newState) {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePhasedRelease(appId, versionId, pr.id, { accountId, phasedReleaseState: newState });
      await onDetailUpdate();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteImmediately() {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePhasedRelease(appId, versionId, pr.id, { accountId, phasedReleaseState: "COMPLETE" });
      await onDetailUpdate();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-[13px] font-bold text-dark-text uppercase tracking-wide mb-3">Phased Release for Automatic Updates</h2>
      <p className="text-[12px] text-dark-dim mb-4 leading-relaxed">
        Release this update gradually over a 7-day period to users with automatic updates enabled.
        You can pause the rollout at any time.
      </p>

      <div className="space-y-2.5">
        <label className="flex items-center gap-3 cursor-pointer bg-dark-surface rounded-[10px] px-4 py-3 transition-colors hover:bg-dark-hover">
          <input
            type="radio"
            name="phasedRelease"
            checked={!hasPhased}
            onChange={() => handleToggle(false)}
            disabled={saving || isActive}
            className="w-4 h-4 accent-accent shrink-0"
          />
          <span className="text-[13px] text-dark-text font-medium">Release update to all users immediately</span>
          {saving && !hasPhased && (
            <span className="text-sm text-dark-dim shrink-0" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
          )}
        </label>

        <label className="flex items-start gap-3 cursor-pointer bg-dark-surface rounded-[10px] px-4 py-3 transition-colors hover:bg-dark-hover">
          <input
            type="radio"
            name="phasedRelease"
            checked={hasPhased}
            onChange={() => handleToggle(true)}
            disabled={saving || isActive}
            className="w-4 h-4 accent-accent mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[13px] text-dark-text font-medium">Release update over a 7-day period using phased release</span>

            {hasPhased && (
              <div className="mt-3 space-y-2">
                {/* Status badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    pr.phasedReleaseState === "ACTIVE" ? "text-[#34c759] bg-[rgba(52,199,89,0.12)]" :
                    pr.phasedReleaseState === "PAUSED" ? "text-[#ff9500] bg-[rgba(255,149,0,0.12)]" :
                    pr.phasedReleaseState === "COMPLETE" ? "text-[#34c759] bg-[rgba(52,199,89,0.12)]" :
                    "text-dark-dim bg-dark-hover"
                  }`}>
                    {pr.phasedReleaseState}
                  </span>
                  {pr.currentDayNumber != null && pr.phasedReleaseState !== "COMPLETE" && (
                    <span className="text-[11px] text-dark-dim">
                      Day {pr.currentDayNumber} of 7 ({PHASED_RELEASE_DAY_PERCENTAGES[pr.currentDayNumber] || "—"} of users)
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {pr.currentDayNumber != null && pr.phasedReleaseState !== "COMPLETE" && (
                  <div className="w-full h-1.5 bg-dark-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(pr.currentDayNumber / 7) * 100}%` }}
                    />
                  </div>
                )}

                {/* Action buttons */}
                {isActive && (
                  <div className="flex items-center gap-2 mt-1">
                    {pr.phasedReleaseState === "ACTIVE" && (
                      <button
                        onClick={() => handlePauseResume("PAUSED")}
                        disabled={saving}
                        className="text-[11px] font-semibold text-[#ff9500] bg-transparent border-none cursor-pointer font-sans px-0 hover:underline disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Pause Rollout"}
                      </button>
                    )}
                    {pr.phasedReleaseState === "PAUSED" && (
                      <button
                        onClick={() => handlePauseResume("ACTIVE")}
                        disabled={saving}
                        className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Resume Rollout"}
                      </button>
                    )}
                    <button
                      onClick={handleCompleteImmediately}
                      disabled={saving}
                      className="text-[11px] font-semibold text-dark-dim bg-transparent border-none cursor-pointer font-sans px-0 hover:underline disabled:opacity-50"
                    >
                      Release to All Users
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {saving && hasPhased && (
            <span className="text-sm text-dark-dim shrink-0" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
          )}
        </label>
      </div>

      {saveError && (
        <div className="text-[11px] text-danger font-medium mt-2">{saveError}</div>
      )}
    </div>
  );
}

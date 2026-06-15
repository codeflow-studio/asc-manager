import { useState } from "react";
import { releaseVersion } from "../api/index.js";

function formatPlatform(platform) {
  if (platform === "IOS") return "iOS";
  if (platform === "MAC_OS") return "macOS";
  return platform;
}

export default function ReleaseVersionButton({
  appId,
  versionId,
  accountId,
  versionString,
  platform,
  onSuccess,
  className = "",
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState(null);

  async function handleRelease() {
    setReleasing(true);
    setError(null);
    try {
      await releaseVersion(appId, versionId, accountId);
      setShowConfirm(false);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setReleasing(false);
    }
  }

  const platformLabel = formatPlatform(platform);

  if (showConfirm) {
    return (
      <div className={`border border-accent/30 bg-accent/5 rounded-[10px] px-4 py-3 ${className}`}>
        <div className="text-[13px] text-dark-text font-medium mb-1">
          Release {platformLabel} version {versionString} to the App Store?
        </div>
        <div className="text-[11px] text-dark-dim mb-3">
          This will publish the approved version. It may take up to 24 hours to appear on the App Store.
        </div>
        {error && (
          <div className="text-[11px] text-danger font-medium mb-3">{error}</div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRelease}
            disabled={releasing}
            className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-accent text-white border-none cursor-pointer font-sans hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {releasing ? "Releasing..." : "Confirm Release"}
          </button>
          <button
            onClick={() => { setShowConfirm(false); setError(null); }}
            disabled={releasing}
            className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-transparent text-dark-dim border border-dark-border cursor-pointer font-sans hover:bg-dark-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full px-4 py-3 rounded-[10px] text-[13px] font-semibold bg-accent text-white border-none cursor-pointer font-sans hover:brightness-110 transition-all"
      >
        Release This Version
      </button>
    </div>
  );
}

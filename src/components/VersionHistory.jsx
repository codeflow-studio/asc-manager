import { useState, useEffect } from "react";
import { fetchVersions } from "../api/index.js";
import Badge from "./Badge.jsx";

export default function VersionHistory({ appId, accountId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setLoading(true);
        const data = await fetchVersions(appId, accountId);
        if (!cancelled) setVersions(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [appId, accountId]);

  if (loading) {
    return (
      <div className="text-center py-8 text-dark-dim">
        <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
        <div className="text-xs font-semibold mt-1">Loading versions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-xs text-danger font-semibold mb-2">Failed to load versions</div>
        <div className="text-[11px] text-dark-dim mb-3">{error}</div>
        <button
          onClick={() => { setLoading(true); setError(null); fetchVersions(appId, accountId).then(setVersions).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
        >
          Retry
        </button>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-dark-ghost">
        <div className="text-xs font-semibold">No version history available</div>
      </div>
    );
  }

  function formatDate(dateString) {
    if (!dateString) return "\u2014";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-1.5">
      {versions.map((v) => (
        <div key={v.id} className="bg-dark-surface rounded-[10px] px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-dark-text">
              Version {v.versionString}
            </div>
            <div className="text-[11px] text-dark-dim mt-0.5">
              {formatDate(v.createdDate)}
            </div>
          </div>
          <Badge status={v.appStoreState} version={v.versionString} platform={v.platform} />
        </div>
      ))}
    </div>
  );
}

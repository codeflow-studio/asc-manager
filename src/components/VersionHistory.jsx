import { useState, useEffect, useCallback } from "react";
import { fetchVersions, createVersion, submitForReview } from "../api/index.js";
import Badge from "./Badge.jsx";

export default function VersionHistory({ appId, accountId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [newPlatform, setNewPlatform] = useState("IOS");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [submittingId, setSubmittingId] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitErrorId, setSubmitErrorId] = useState(null);

  const loadVersions = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchVersions(appId, accountId);
      setVersions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [appId, accountId]);

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

  async function handleCreate(e) {
    e.preventDefault();
    if (!newVersion.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      await createVersion(appId, accountId, newVersion.trim(), newPlatform);
      setShowNewForm(false);
      setNewVersion("");
      setNewPlatform("IOS");
      await loadVersions();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSubmit(versionId) {
    setSubmittingId(versionId);
    setSubmitError(null);
    setSubmitErrorId(null);
    try {
      await submitForReview(appId, versionId, accountId);
      await loadVersions();
    } catch (err) {
      setSubmitError(err.message);
      setSubmitErrorId(versionId);
    } finally {
      setSubmittingId(null);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "\u2014";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

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
          onClick={loadVersions}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
        >
          Retry
        </button>
      </div>
    );
  }

  const inputCls = "w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text outline-none font-sans text-[13px] transition-colors";
  const labelCls = "text-[11px] uppercase tracking-wide font-semibold text-dark-dim mb-1.5 block";

  return (
    <div className="space-y-3">
      {/* New Version Button / Form */}
      {!showNewForm ? (
        <button
          onClick={() => { setShowNewForm(true); setCreateError(null); }}
          className="w-full px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent/10 text-accent border border-accent/20 cursor-pointer font-sans hover:bg-accent/20 transition-colors"
        >
          + New Version
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-dark-surface rounded-[10px] px-4 py-4 space-y-3 border border-dark-border-light">
          <div>
            <label className={labelCls}>Version String</label>
            <input
              type="text"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              placeholder="e.g. 2.1.0"
              className={inputCls}
              autoFocus
              disabled={creating}
            />
          </div>
          <div>
            <label className={labelCls}>Platform</label>
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className={inputCls}
              disabled={creating}
            >
              <option value="IOS">iOS</option>
              <option value="MAC_OS">macOS</option>
            </select>
          </div>
          {createError && (
            <div className="text-[11px] text-danger font-medium">{createError}</div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowNewForm(false); setCreateError(null); }}
              disabled={creating}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-dark-hover text-dark-dim border-none cursor-pointer font-sans transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newVersion.trim()}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Version List */}
      {versions.length === 0 ? (
        <div className="text-center py-8 text-dark-ghost">
          <div className="text-xs font-semibold">No version history available</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {versions.map((v) => (
            <div key={v.id} className="bg-dark-surface rounded-[10px] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-dark-text">
                    Version {v.versionString}
                  </div>
                  <div className="text-[11px] text-dark-dim mt-0.5">
                    {formatDate(v.createdDate)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.appStoreState === "PREPARE_FOR_SUBMISSION" && (
                    <button
                      onClick={() => handleSubmit(v.id)}
                      disabled={submittingId === v.id}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-success/10 text-success border border-success/20 cursor-pointer font-sans hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingId === v.id ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}
                  <Badge status={v.appStoreState} version={v.versionString} platform={v.platform} />
                </div>
              </div>
              {submitError && submitErrorId === v.id && (
                <div className="text-[11px] text-danger font-medium mt-2">{submitError}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

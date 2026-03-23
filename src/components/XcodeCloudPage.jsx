import { useState, useEffect, useCallback } from "react";
import { fetchCiBuildRuns, fetchCiWorkflows } from "../api/index.js";
import { CI_COMPLETION_STATUS_MAP, CI_PROGRESS_STATUS_MAP } from "../constants/index.js";
import AppIcon from "./AppIcon.jsx";

export function formatRelativeTime(dateString) {
  if (!dateString) return "--";
  const diff = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDuration(start, end) {
  if (!start || !end) return "--";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function getBuildStatus(run) {
  if (run.executionProgress !== "COMPLETE") {
    return CI_PROGRESS_STATUS_MAP[run.executionProgress] || { label: run.executionProgress, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
  }
  return CI_COMPLETION_STATUS_MAP[run.completionStatus] || { label: run.completionStatus, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
}

function TriggerInfo({ workflow }) {
  const triggers = [];

  if (workflow.branchStartCondition) {
    const c = workflow.branchStartCondition;
    const patterns = c.source?.branchPatterns || [];
    const branchNames = patterns.map((p) => p.pattern).filter(Boolean);
    triggers.push(`Branch: ${branchNames.length > 0 ? branchNames.join(", ") : "any"}`);
  }

  if (workflow.pullRequestStartCondition) {
    const c = workflow.pullRequestStartCondition;
    const patterns = c.source?.branchPatterns || [];
    const branchNames = patterns.map((p) => p.pattern).filter(Boolean);
    triggers.push(`PR: ${branchNames.length > 0 ? branchNames.join(", ") : "any"}`);
  }

  if (workflow.tagStartCondition) {
    const c = workflow.tagStartCondition;
    const patterns = c.source?.tagPatterns || [];
    const tagNames = patterns.map((p) => p.pattern).filter(Boolean);
    triggers.push(`Tag: ${tagNames.length > 0 ? tagNames.join(", ") : "any"}`);
  }

  if (workflow.scheduledStartCondition) {
    triggers.push("Scheduled");
  }

  if (triggers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {triggers.map((t, i) => (
        <span key={i} className="text-[10px] font-medium text-dark-dim bg-dark-hover px-2 py-0.5 rounded">
          {t}
        </span>
      ))}
    </div>
  );
}

export default function XcodeCloudPage({ app, accounts, isMobile, onSelectBuild, onSelectWorkflow }) {
  const [buildRuns, setBuildRuns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configured, setConfigured] = useState(true);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [buildsRes, workflowsRes] = await Promise.all([
        fetchCiBuildRuns(app.id, app.accountId),
        fetchCiWorkflows(app.id, app.accountId),
      ]);
      setConfigured(buildsRes.configured !== false);
      setBuildRuns(buildsRes.data || []);
      setWorkflows(workflowsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [app.id, app.accountId]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
      {/* Back navigation bar */}
      <div className={`sticky top-0 z-10 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border ${isMobile ? "px-3 py-3" : "px-7 py-3"}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-accent text-sm font-medium bg-transparent border-none cursor-pointer font-sans px-0"
          >
            <span className="text-lg leading-none">{"\u2039"}</span>
            {app.name}
          </button>
          <span className="text-dark-phantom text-sm">/</span>
          <span className="text-sm text-dark-dim font-medium">Xcode Cloud</span>
        </div>
      </div>

      <div className={isMobile ? "px-3 pt-5 pb-10" : "px-7 pt-6 pb-16 max-w-[960px]"}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <AppIcon app={app} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-dark-text m-0 leading-tight">Xcode Cloud</h1>
            <div className="text-[12px] text-dark-dim mt-0.5">{app.name} &mdash; Builds & Workflows</div>
          </div>
        </div>

        {loading && (
          <div className="text-center px-5 py-20 text-dark-dim">
            <div className="text-[28px] mb-3 inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>
              {"\u21bb"}
            </div>
            <div className="text-sm font-semibold">Loading Xcode Cloud data...</div>
          </div>
        )}

        {error && !loading && (
          <div className="text-center px-5 py-16 text-danger">
            <div className="text-sm font-semibold mb-2">Failed to load Xcode Cloud data</div>
            <div className="text-xs text-dark-dim max-w-[400px] mx-auto mb-4">{error}</div>
            <button
              onClick={loadData}
              className="px-[18px] py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !configured && (
          <div className="text-center px-5 py-16">
            <div className="text-sm font-semibold text-dark-dim mb-2">Xcode Cloud is not configured for this app</div>
            <div className="text-xs text-dark-ghost max-w-[400px] mx-auto mb-4">
              Set up Xcode Cloud in App Store Connect to see build runs and workflows here.
            </div>
            <a
              href={`https://appstoreconnect.apple.com/apps/${app.id}/ci`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-accent text-white border-none cursor-pointer font-sans no-underline"
            >
              Set Up in App Store Connect
            </a>
          </div>
        )}

        {!loading && !error && configured && (
          <div className="space-y-8">
            {/* Workflows */}
            <div>
              <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Workflows</span>
              {workflows.length === 0 ? (
                <div className="text-center py-6 text-dark-ghost">
                  <div className="text-xs font-semibold">No workflows found</div>
                </div>
              ) : (
                <div className="space-y-1.5 mt-2">
                  {workflows.map((wf) => (
                    <div
                      key={wf.id}
                      className="bg-dark-surface rounded-[10px] px-4 py-3 cursor-pointer hover:bg-dark-hover transition-colors"
                      onClick={() => onSelectWorkflow?.(wf)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-dark-text truncate">{wf.name}</span>
                            <span
                              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{
                                color: wf.isEnabled ? "#34c759" : "#8e8e93",
                                background: wf.isEnabled ? "rgba(52,199,89,0.12)" : "rgba(142,142,147,0.12)",
                              }}
                            >
                              {wf.isEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          {wf.description && (
                            <div className="text-[11px] text-dark-dim mt-0.5">{wf.description}</div>
                          )}
                          <TriggerInfo workflow={wf} />
                        </div>
                        <div className="text-right shrink-0">
                          {wf.actions.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1">
                              {wf.actions.map((action, i) => (
                                <span key={i} className="text-[10px] font-medium text-dark-label bg-dark-hover px-2 py-0.5 rounded">
                                  {action.name || action.actionType || "Action"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Builds */}
            <div>
              <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Recent Builds</span>
              {buildRuns.length === 0 ? (
                <div className="text-center py-6 text-dark-ghost">
                  <div className="text-xs font-semibold">No build runs yet</div>
                </div>
              ) : (
                <div className="space-y-1 mt-2">
                  {buildRuns.map((run) => {
                    const status = getBuildStatus(run);
                    const commitSha = run.sourceCommit?.commitSha;
                    return (
                      <div
                        key={run.id}
                        className="bg-dark-surface rounded-[10px] px-4 py-3 cursor-pointer hover:bg-dark-hover transition-colors"
                        onClick={() => onSelectBuild?.(run)}
                      >
                        <div className={`flex items-center gap-3 ${isMobile ? "flex-wrap" : ""}`}>
                          {/* Status badge */}
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0"
                            style={{ color: status.color }}
                          >
                            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: status.color }} />
                            {status.label}
                          </span>

                          {/* Build number */}
                          <span className="text-[13px] font-semibold text-dark-text font-mono shrink-0">
                            #{run.number || "--"}
                          </span>

                          {/* Branch */}
                          {run.sourceBranchOrTag && (
                            <span className="text-[11px] font-medium text-dark-label bg-dark-hover px-2 py-0.5 rounded truncate max-w-[180px]">
                              {run.sourceBranchOrTag}
                            </span>
                          )}

                          {/* Commit SHA */}
                          {commitSha && (
                            <span className="text-[11px] font-mono text-dark-dim shrink-0">
                              {commitSha.slice(0, 7)}
                            </span>
                          )}

                          <div className="flex-1" />

                          {/* Duration */}
                          <span className="text-[11px] text-dark-dim font-mono shrink-0">
                            {formatDuration(run.startedDate, run.finishedDate)}
                          </span>

                          {/* Relative time */}
                          <span className="text-[11px] text-dark-ghost shrink-0">
                            {formatRelativeTime(run.createdDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

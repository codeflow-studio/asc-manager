import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBuildActions, fetchActionLogs, fetchActionIssues } from "../api/index.js";
import { CI_COMPLETION_STATUS_MAP, CI_PROGRESS_STATUS_MAP } from "../constants/index.js";
import { getBuildStatus, formatRelativeTime, formatDuration } from "./XcodeCloudPage.jsx";
import AppIcon from "./AppIcon.jsx";

function getActionStatus(action) {
  if (action.executionProgress !== "COMPLETE") {
    return CI_PROGRESS_STATUS_MAP[action.executionProgress] || { label: action.executionProgress, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
  }
  return CI_COMPLETION_STATUS_MAP[action.completionStatus] || { label: action.completionStatus, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
}

function IssuesList({ issues }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-3">
      {issues.map((issue, i) => {
        const isError = issue.category === "ERROR";
        return (
          <div key={i} className="flex items-start gap-2 text-[12px]">
            <span
              className="shrink-0 mt-0.5 w-[6px] h-[6px] rounded-full"
              style={{ background: isError ? "#ff3b30" : "#ff9500" }}
            />
            <div className="min-w-0 flex-1">
              <span style={{ color: isError ? "#ff3b30" : "#ff9500" }}>{issue.message}</span>
              {issue.fileSource && (
                <span className="text-dark-ghost ml-2 font-mono text-[11px]">
                  {issue.fileSource.path && issue.fileSource.lineNumber
                    ? `${issue.fileSource.path}:${issue.fileSource.lineNumber}`
                    : issue.fileSource.path || ""}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogViewer({ content }) {
  return (
    <pre
      className="rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre font-mono text-[12px] leading-[1.5] p-4 m-0"
      style={{ background: "#0d1117", color: "#c9d1d9" }}
    >
      {content}
    </pre>
  );
}

function IssueCountBadges({ issueCounts }) {
  if (!issueCounts) return null;
  const badges = [];
  if (issueCounts.errors > 0) {
    badges.push({ label: `${issueCounts.errors} error${issueCounts.errors > 1 ? "s" : ""}`, color: "#ff3b30" });
  }
  if (issueCounts.testFailures > 0) {
    badges.push({ label: `${issueCounts.testFailures} test failure${issueCounts.testFailures > 1 ? "s" : ""}`, color: "#ff3b30" });
  }
  if (issueCounts.warnings > 0) {
    badges.push({ label: `${issueCounts.warnings} warning${issueCounts.warnings > 1 ? "s" : ""}`, color: "#ff9500" });
  }
  if (issueCounts.analyzerWarnings > 0) {
    badges.push({ label: `${issueCounts.analyzerWarnings} analyzer`, color: "#ff9500" });
  }
  if (badges.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {badges.map((b, i) => (
        <span
          key={i}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ color: b.color, background: `${b.color}1f` }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

export default function BuildDetailPage({ app, buildRun, accounts, isMobile }) {
  const [actions, setActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState(null);
  const [expandedAction, setExpandedAction] = useState(null);
  const [actionLogs, setActionLogs] = useState({});
  const [actionIssues, setActionIssues] = useState({});
  const fetchedRef = useRef(new Set());

  const loadActions = useCallback(async () => {
    setActionsError(null);
    setActionsLoading(true);
    try {
      const data = await fetchBuildActions(app.id, buildRun.id, app.accountId);
      setActions(data);
    } catch (err) {
      setActionsError(err.message);
    } finally {
      setActionsLoading(false);
    }
  }, [app.id, app.accountId, buildRun.id]);

  useEffect(() => { loadActions(); }, [loadActions]);

  const toggleAction = useCallback((actionId, action) => {
    setExpandedAction((prev) => {
      if (prev === actionId) return null;

      // Lazy-load issues and logs when expanding for the first time
      if (!fetchedRef.current.has(actionId)) {
        fetchedRef.current.add(actionId);

        if (action.executionProgress === "COMPLETE") {
          // Fetch issues
          setActionIssues((prev) => ({ ...prev, [actionId]: { loading: true, error: null, data: [] } }));
          fetchActionIssues(app.id, buildRun.id, actionId, app.accountId)
            .then((data) => setActionIssues((prev) => ({ ...prev, [actionId]: { loading: false, error: null, data } })))
            .catch((err) => setActionIssues((prev) => ({ ...prev, [actionId]: { loading: false, error: err.message, data: [] } })));

          // Fetch logs
          setActionLogs((prev) => ({ ...prev, [actionId]: { loading: true, error: null, content: null, available: null } }));
          fetchActionLogs(app.id, buildRun.id, actionId, app.accountId)
            .then((data) => setActionLogs((prev) => ({ ...prev, [actionId]: { loading: false, error: null, ...data } })))
            .catch((err) => setActionLogs((prev) => ({ ...prev, [actionId]: { loading: false, error: err.message, content: null, available: false } })));
        }
      }

      return actionId;
    });
  }, [app.id, app.accountId, buildRun.id]);

  const buildStatus = getBuildStatus(buildRun);
  const commitSha = buildRun.sourceCommit?.commitSha;

  return (
    <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
      {/* Breadcrumb */}
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
          <button
            onClick={() => window.history.back()}
            className="text-accent text-sm font-medium bg-transparent border-none cursor-pointer font-sans px-0"
          >
            Xcode Cloud
          </button>
          <span className="text-dark-phantom text-sm">/</span>
          <span className="text-sm text-dark-dim font-medium">Build #{buildRun.number || "--"}</span>
        </div>
      </div>

      <div className={isMobile ? "px-3 pt-5 pb-10" : "px-7 pt-6 pb-16 max-w-[960px]"}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <AppIcon app={app} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-dark-text m-0 leading-tight">
              Build #{buildRun.number || "--"}
            </h1>
            <div className="text-[12px] text-dark-dim mt-0.5">{app.name} &mdash; Xcode Cloud</div>
          </div>
        </div>

        {/* Build Metadata Card */}
        <div className="bg-dark-surface rounded-xl p-4 mb-6">
          <div className={`grid gap-4 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Status</div>
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: buildStatus.color }}
              >
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: buildStatus.color }} />
                {buildStatus.label}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Build Number</div>
              <span className="text-[13px] font-semibold text-dark-text font-mono">#{buildRun.number || "--"}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Branch</div>
              <span className="text-[12px] font-medium text-dark-label">
                {buildRun.sourceBranchOrTag || "--"}
              </span>
            </div>
            {commitSha && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Commit</div>
                <span className="text-[12px] font-mono text-dark-dim">{commitSha.slice(0, 7)}</span>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Duration</div>
              <span className="text-[12px] font-mono text-dark-dim">
                {formatDuration(buildRun.startedDate, buildRun.finishedDate)}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Created</div>
              <span className="text-[12px] text-dark-dim">{formatRelativeTime(buildRun.createdDate)}</span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div>
          <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Build Actions</span>

          {actionsLoading && (
            <div className="text-center px-5 py-12 text-dark-dim">
              <div className="text-[28px] mb-3 inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>
                {"\u21bb"}
              </div>
              <div className="text-sm font-semibold">Loading actions...</div>
            </div>
          )}

          {actionsError && !actionsLoading && (
            <div className="text-center px-5 py-10 text-danger">
              <div className="text-sm font-semibold mb-2">Failed to load actions</div>
              <div className="text-xs text-dark-dim max-w-[400px] mx-auto mb-4">{actionsError}</div>
              <button
                onClick={loadActions}
                className="px-[18px] py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
              >
                Retry
              </button>
            </div>
          )}

          {!actionsLoading && !actionsError && actions.length === 0 && (
            <div className="text-center py-6 text-dark-ghost">
              <div className="text-xs font-semibold">No actions found for this build</div>
            </div>
          )}

          {!actionsLoading && !actionsError && actions.length > 0 && (
            <div className="space-y-1 mt-2">
              {actions.map((action) => {
                const status = getActionStatus(action);
                const isExpanded = expandedAction === action.id;
                const logs = actionLogs[action.id];
                const issues = actionIssues[action.id];
                const isComplete = action.executionProgress === "COMPLETE";

                return (
                  <div key={action.id} className="bg-dark-surface rounded-[10px] overflow-hidden">
                    {/* Action row header */}
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-dark-hover transition-colors"
                      onClick={() => toggleAction(action.id, action)}
                    >
                      <div className={`flex items-center gap-3 ${isMobile ? "flex-wrap" : ""}`}>
                        {/* Expand indicator */}
                        <span className="text-dark-ghost text-[11px] shrink-0 w-3 text-center transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}>
                          {"\u25b6"}
                        </span>

                        {/* Status */}
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0"
                          style={{ color: status.color }}
                        >
                          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: status.color }} />
                          {status.label}
                        </span>

                        {/* Name */}
                        <span className="text-[13px] font-semibold text-dark-text truncate">
                          {action.name || action.actionType || "Action"}
                        </span>

                        {/* Action type badge */}
                        {action.actionType && (
                          <span className="text-[10px] font-medium text-dark-label bg-dark-hover px-2 py-0.5 rounded shrink-0">
                            {action.actionType}
                          </span>
                        )}

                        <div className="flex-1" />

                        {/* Issue counts */}
                        <IssueCountBadges issueCounts={action.issueCounts} />

                        {/* Duration */}
                        <span className="text-[11px] text-dark-dim font-mono shrink-0">
                          {formatDuration(action.startedDate, action.finishedDate)}
                        </span>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-dark-border pt-3">
                        {!isComplete && (
                          <div className="text-[12px] text-dark-dim py-4 text-center">
                            Logs available after action completes
                          </div>
                        )}

                        {isComplete && (
                          <>
                            {/* Issues */}
                            {issues?.loading && (
                              <div className="text-[12px] text-dark-dim mb-3">Loading issues...</div>
                            )}
                            {issues?.error && (
                              <div className="text-[12px] text-danger mb-3">Failed to load issues: {issues.error}</div>
                            )}
                            {issues?.data && issues.data.length > 0 && (
                              <div className="mb-3">
                                <div className="text-[11px] font-semibold text-dark-ghost uppercase tracking-wide mb-2">Issues</div>
                                <IssuesList issues={issues.data} />
                              </div>
                            )}

                            {/* Logs */}
                            {logs?.loading && (
                              <div className="text-[12px] text-dark-dim py-4 text-center">Loading logs...</div>
                            )}
                            {logs?.error && (
                              <div className="text-[12px] text-danger py-2">Failed to load logs: {logs.error}</div>
                            )}
                            {logs && !logs.loading && !logs.error && logs.available === false && (
                              <div className="text-[12px] text-dark-ghost py-4 text-center">No logs available for this action</div>
                            )}
                            {logs && !logs.loading && !logs.error && logs.available && logs.content && (
                              <div>
                                <div className="text-[11px] font-semibold text-dark-ghost uppercase tracking-wide mb-2">Logs</div>
                                <LogViewer content={logs.content} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
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

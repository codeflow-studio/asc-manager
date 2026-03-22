import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBuildActions, fetchActionLogs, fetchActionIssues, fetchLogFile } from "../api/index.js";
import { CI_COMPLETION_STATUS_MAP, CI_PROGRESS_STATUS_MAP } from "../constants/index.js";
import { getBuildStatus, formatRelativeTime, formatDuration } from "./XcodeCloudPage.jsx";

function getActionStatus(action) {
  if (action.executionProgress !== "COMPLETE") {
    return CI_PROGRESS_STATUS_MAP[action.executionProgress] || { label: action.executionProgress, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
  }
  return CI_COMPLETION_STATUS_MAP[action.completionStatus] || { label: action.completionStatus, color: "#8e8e93", bg: "rgba(142,142,147,0.12)" };
}

const START_REASON_MAP = {
  MANUAL: "Manual",
  PUSH: "Code push",
  SCHEDULE: "Scheduled",
  PULL_REQUEST: "Pull request",
  MANUAL_REBUILD: "Rebuild",
};

function StatusIcon({ status, size = 16 }) {
  const failed = status.label === "Failed" || status.label === "Errored";
  const succeeded = status.label === "Succeeded";
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={r} cy={r} r={r} fill={status.color} />
      {succeeded && (
        <path d={`M${r * 0.55} ${r} L${r * 0.85} ${r * 1.3} L${r * 1.45} ${r * 0.65}`} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {failed && (
        <>
          <line x1={r * 0.7} y1={r * 0.7} x2={r * 1.3} y2={r * 1.3} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={r * 1.3} y1={r * 0.7} x2={r * 0.7} y2={r * 1.3} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// ── Log Viewer Components ────────────────────────────────────────────────────

function cleanLogContent(raw) {
  return raw
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z\t/gm, "");
}

function LogViewer({ content }) {
  const lines = cleanLogContent(content).split("\n").filter((l) => l.length > 0);
  return (
    <div className="rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto" style={{ background: "#fff" }}>
      {lines.map((line, i) => (
        <div
          key={i}
          className="px-3 py-1.5 font-mono text-[12px] leading-[1.6] whitespace-pre"
          style={{
            color: "#1d1d1f",
            borderBottom: i < lines.length - 1 ? "1px solid #e5e5ea" : "none",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function LogSteps({ steps, appId, buildId, actionId, accountId }) {
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepContent, setStepContent] = useState({});

  const toggleStep = useCallback((step) => {
    setExpandedStep((prev) => {
      if (prev === step.fileName) return null;
      if (!stepContent[step.fileName] && step.mainFile) {
        setStepContent((prev) => ({ ...prev, [step.fileName]: { loading: true, error: null, content: null } }));
        fetchLogFile(appId, buildId, actionId, accountId, step.mainFile)
          .then((data) => setStepContent((prev) => ({ ...prev, [step.fileName]: { loading: false, error: null, content: data.content } })))
          .catch((err) => setStepContent((prev) => ({ ...prev, [step.fileName]: { loading: false, error: err.message, content: null } })));
      }
      return step.fileName;
    });
  }, [appId, buildId, actionId, accountId, stepContent]);

  return (
    <div className="space-y-0.5">
      {steps.map((step) => {
        const isExpanded = expandedStep === step.fileName;
        const sc = stepContent[step.fileName];
        return (
          <div key={step.fileName} className="rounded-lg overflow-hidden bg-dark-surface">
            <div
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-dark-hover transition-colors"
              onClick={() => toggleStep(step)}
            >
              <span
                className="text-dark-ghost text-[10px] shrink-0 w-3 text-center transition-transform"
                style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
              >
                {"\u25b6"}
              </span>
              <StatusIcon
                status={{ label: step.status === "failed" ? "Failed" : "Succeeded", color: step.status === "failed" ? "#ff3b30" : "#34c759" }}
                size={14}
              />
              <span className="text-[12px] font-medium text-dark-label flex-1 truncate">{step.name}</span>
              {step.duration && (
                <span className="text-[11px] text-dark-dim font-mono shrink-0">{step.duration}</span>
              )}
            </div>
            {isExpanded && (
              <div className="px-3 pb-3">
                {sc?.loading && <div className="text-[12px] text-dark-dim py-4 text-center">Loading log...</div>}
                {sc?.error && <div className="text-[12px] text-danger py-2">Failed to load: {sc.error}</div>}
                {sc?.content && <LogViewer content={sc.content} />}
                {!step.mainFile && <div className="text-[12px] text-dark-ghost py-2 text-center">No log file available</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Issue Components ─────────────────────────────────────────────────────────

function IssuesList({ issues }) {
  if (!issues || issues.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-3">
      {issues.map((issue, i) => {
        const isError = issue.issueType === "ERROR";
        return (
          <div key={i} className="flex items-start gap-2 text-[12px]">
            <span className="shrink-0 mt-0.5 w-[6px] h-[6px] rounded-full" style={{ background: isError ? "#ff3b30" : "#ff9500" }} />
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

function IssueFilterPills({ issues, filter, onFilterChange }) {
  const errorCount = issues.filter((i) => i.issueType === "ERROR").length;
  const warningCount = issues.length - errorCount;
  if (issues.length === 0) return null;

  const pills = [
    { key: "ALL", label: "All" },
    { key: "ERROR", label: `Errors (${errorCount})`, color: "#ff3b30" },
    { key: "WARNING", label: `Warnings (${warningCount})`, color: "#ff9500" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {pills.map((p) => {
        const active = filter === p.key;
        const base = "text-[10px] font-semibold px-2 py-[3px] rounded-full cursor-pointer transition-colors border";
        if (p.key === "ALL") {
          return (
            <button key={p.key} onClick={() => onFilterChange(p.key)}
              className={`${base} ${active ? "border-accent-border bg-accent-bg text-accent-light" : "border-dark-border bg-transparent text-dark-faint"} font-sans`}
            >{p.label}</button>
          );
        }
        return (
          <button key={p.key} onClick={() => onFilterChange(p.key)}
            className={`${base} ${active ? "" : "border-dark-border bg-transparent text-dark-faint"} font-sans`}
            style={active ? { color: p.color, background: `${p.color}1f`, borderColor: `${p.color}40` } : undefined}
          >{p.label}</button>
        );
      })}
    </div>
  );
}

function IssueCountBadges({ issueCounts }) {
  if (!issueCounts) return null;
  const badges = [];
  if (issueCounts.warnings > 0) badges.push({ count: issueCounts.warnings, color: "#ff9500" });
  if (issueCounts.errors > 0) badges.push({ count: issueCounts.errors, color: "#ff3b30" });
  if (issueCounts.testFailures > 0) badges.push({ count: issueCounts.testFailures, color: "#ff3b30" });
  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {badges.map((b, i) => (
        <span key={i} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: b.color }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="7" fill={b.color} />
            {b.color === "#ff9500"
              ? <text x="7" y="11" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">!</text>
              : <><line x1="4.5" y1="4.5" x2="9.5" y2="9.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><line x1="9.5" y1="4.5" x2="4.5" y2="9.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></>
            }
          </svg>
          {b.count}
        </span>
      ))}
    </div>
  );
}

// ── Overview View ────────────────────────────────────────────────────────────

function OverviewView({ buildRun, buildStatus, actions, actionsLoading, onSelectAction }) {
  const commitSha = buildRun.sourceCommit?.commitSha;
  const commitMsg = buildRun.sourceCommit?.message;

  function formatQueuedTime(created, started) {
    if (!created || !started) return "--";
    const diff = Math.max(0, Math.round((new Date(started) - new Date(created)) / 1000));
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  }

  function formatStartedDate(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">Overview</h2>

      {/* Details section */}
      <div className="mb-6">
        <h3 className="text-[13px] font-bold text-dark-text m-0 mb-3">Details</h3>
        <div className="bg-dark-surface rounded-xl p-4">
          <div className="grid grid-cols-3 gap-y-4 gap-x-6">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Start Condition</div>
              <span className="text-[13px] text-dark-text">{START_REASON_MAP[buildRun.startReason] || buildRun.startReason || "--"}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Started</div>
              <span className="text-[13px] text-dark-text">{formatStartedDate(buildRun.startedDate)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Queued For</div>
              <span className="text-[13px] text-dark-text">{formatQueuedTime(buildRun.createdDate, buildRun.startedDate)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Duration</div>
              <span className="text-[13px] text-dark-text">{formatDuration(buildRun.startedDate, buildRun.finishedDate)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Branch</div>
              <span className="text-[13px] text-dark-text">{buildRun.sourceBranchOrTag || "--"}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-1">Status</div>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: buildStatus.color }}>
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: buildStatus.color }} />
                {buildStatus.label}
              </span>
            </div>
          </div>

          {/* Last Commit */}
          {commitSha && (
            <div className="mt-4 pt-4 border-t border-dark-border">
              <div className="text-[10px] uppercase tracking-wide text-dark-ghost mb-2">Last Commit</div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-dark-text">{commitMsg || "No commit message"}</span>
                <span className="text-[12px] font-mono text-accent font-medium">{commitSha.slice(0, 7)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results section */}
      <div>
        <h3 className="text-[13px] font-bold text-dark-text m-0 mb-3">Results</h3>
        <div className="bg-dark-surface rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-border">
            <span className="text-[10px] uppercase tracking-wide text-dark-ghost font-semibold">Actions</span>
          </div>
          {actionsLoading && (
            <div className="px-4 py-6 text-center text-dark-dim text-[12px]">Loading actions...</div>
          )}
          {!actionsLoading && actions.map((action) => {
            const status = getActionStatus(action);
            return (
              <div
                key={action.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-dark-border last:border-b-0 cursor-pointer hover:bg-dark-hover transition-colors"
                onClick={() => onSelectAction(action)}
              >
                <StatusIcon status={status} size={16} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-accent">{action.name || action.actionType || "Action"}</span>
                  <div className="text-[11px] text-dark-dim">{status.label}</div>
                </div>
                <IssueCountBadges issueCounts={action.issueCounts} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Logs View ────────────────────────────────────────────────────────────────

function LogsView({ action, logs, app, buildRun }) {
  const isComplete = action.executionProgress === "COMPLETE";

  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">Logs</h2>

      {!isComplete && (
        <div className="text-[12px] text-dark-dim py-8 text-center">Logs available after action completes</div>
      )}

      {isComplete && (
        <>
          {/* Log Steps */}
          {logs?.loading && <div className="text-[12px] text-dark-dim py-4 text-center">Loading logs...</div>}
          {logs?.error && <div className="text-[12px] text-danger py-2">Failed to load logs: {logs.error}</div>}
          {logs && !logs.loading && !logs.error && logs.available === false && (
            <div className="text-[12px] text-dark-ghost py-4 text-center">No logs available for this action</div>
          )}
          {logs && !logs.loading && !logs.error && logs.available && logs.steps && (
            <LogSteps
              steps={logs.steps}
              appId={app.id}
              buildId={buildRun.id}
              actionId={action.id}
              accountId={app.accountId}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BuildDetailPage({ app, buildRun, accounts, isMobile }) {
  const [actions, setActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionLogs, setActionLogs] = useState({});
  const [actionIssues, setActionIssues] = useState({});
  const [issueFilter, setIssueFilter] = useState("ALL");
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

  const selectAction = useCallback((action) => {
    setSelectedAction(action);
    setActiveView("logs");
    setIssueFilter("ALL");

    const actionId = action.id;
    if (!fetchedRef.current.has(actionId) && action.executionProgress === "COMPLETE") {
      fetchedRef.current.add(actionId);

      setActionIssues((prev) => ({ ...prev, [actionId]: { loading: true, error: null, data: [] } }));
      fetchActionIssues(app.id, buildRun.id, actionId, app.accountId)
        .then((data) => setActionIssues((prev) => ({ ...prev, [actionId]: { loading: false, error: null, data } })))
        .catch((err) => setActionIssues((prev) => ({ ...prev, [actionId]: { loading: false, error: err.message, data: [] } })));

      setActionLogs((prev) => ({ ...prev, [actionId]: { loading: true, error: null, available: null } }));
      fetchActionLogs(app.id, buildRun.id, actionId, app.accountId)
        .then((data) => setActionLogs((prev) => ({ ...prev, [actionId]: { loading: false, error: null, ...data } })))
        .catch((err) => setActionLogs((prev) => ({ ...prev, [actionId]: { loading: false, error: err.message, available: false } })));
    }
  }, [app.id, app.accountId, buildRun.id]);

  const buildStatus = getBuildStatus(buildRun);

  // Sidebar nav item component
  function NavItem({ label, active, indent = 0, onClick, icon }) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] font-medium border-none cursor-pointer font-sans transition-colors block ${
          active ? "bg-accent/15 text-accent" : "bg-transparent text-dark-label hover:bg-dark-hover"
        }`}
        style={{ paddingLeft: `${12 + indent * 16}px` }}
      >
        {icon && <span className="mr-2 text-dark-ghost">{icon}</span>}
        {label}
      </button>
    );
  }

  return (
    <div style={{ animation: "asc-slidein 0.3s ease both" }}>
      {/* Breadcrumb */}
      <div className={`sticky top-0 z-10 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border ${isMobile ? "px-3 py-3" : "px-7 py-3"}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-accent text-sm font-medium bg-transparent border-none cursor-pointer font-sans px-0"
          >
            <span className="text-lg leading-none">{"\u2039"}</span>
            Xcode Cloud
          </button>
          <span className="text-dark-phantom text-sm">/</span>
          <span className="text-sm text-dark-dim font-medium">Build #{buildRun.number || "--"}</span>
        </div>
      </div>

      <div className={isMobile ? "px-3 pt-4 pb-10" : "flex gap-0 min-h-[calc(100vh-49px)]"}>
        {/* Sidebar */}
        {!isMobile && (
          <div className="w-[220px] shrink-0 border-r border-dark-border px-3 pt-5 pb-8 overflow-y-auto">
            {/* Build title */}
            <div className="flex items-center gap-2 mb-4 px-1">
              <StatusIcon status={buildStatus} size={18} />
              <span className="text-[14px] font-bold text-dark-text">Build {buildRun.number || "--"}</span>
            </div>

            {/* General */}
            <div className="mb-4">
              <div className="text-[11px] font-bold text-dark-ghost uppercase tracking-wide px-3 mb-1">General</div>
              <NavItem
                label="Overview"
                active={activeView === "overview"}
                onClick={() => setActiveView("overview")}
              />
            </div>

            {/* Actions */}
            <div>
              <div className="text-[11px] font-bold text-dark-ghost uppercase tracking-wide px-3 mb-1">Actions</div>
              {actionsLoading && (
                <div className="text-[11px] text-dark-dim px-3 py-1">Loading...</div>
              )}
              {actions.map((action) => {
                const status = getActionStatus(action);
                const isSelected = selectedAction?.id === action.id;
                return (
                  <div key={action.id}>
                    <button
                      onClick={() => selectAction(action)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] font-medium border-none cursor-pointer font-sans transition-colors flex items-center gap-2 ${
                        isSelected ? "bg-accent/15 text-accent" : "bg-transparent text-dark-label hover:bg-dark-hover"
                      }`}
                    >
                      <StatusIcon status={status} size={14} />
                      <span className="truncate">{action.name || action.actionType}</span>
                    </button>
                    {isSelected && (
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        <NavItem
                          label="Logs"
                          active={activeView === "logs"}
                          indent={1}
                          onClick={() => setActiveView("logs")}
                          icon={"\u2630"}
                        />
                        <NavItem
                          label="Issues"
                          active={activeView === "issues"}
                          indent={1}
                          onClick={() => setActiveView("issues")}
                          icon={"\u26a0"}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className={isMobile ? "" : "flex-1 px-8 pt-6 pb-16 overflow-y-auto max-w-[960px]"}>
          {/* Mobile action selector */}
          {isMobile && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveView("overview")}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer font-sans ${
                  activeView === "overview" ? "border-accent bg-accent/15 text-accent" : "border-dark-border bg-transparent text-dark-label"
                }`}
              >Overview</button>
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => selectAction(action)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer font-sans ${
                    selectedAction?.id === action.id ? "border-accent bg-accent/15 text-accent" : "border-dark-border bg-transparent text-dark-label"
                  }`}
                >{action.name || action.actionType}</button>
              ))}
            </div>
          )}

          {/* Overview */}
          {activeView === "overview" && (
            <OverviewView
              buildRun={buildRun}
              buildStatus={buildStatus}
              actions={actions}
              actionsLoading={actionsLoading}
              onSelectAction={selectAction}
            />
          )}

          {/* Logs */}
          {activeView === "logs" && selectedAction && (
            <LogsView
              action={selectedAction}
              logs={actionLogs[selectedAction.id]}
              app={app}
              buildRun={buildRun}
            />
          )}

          {/* Issues (standalone view) */}
          {activeView === "issues" && selectedAction && (
            <div>
              <h2 className="text-lg font-bold text-dark-text m-0 mb-5">Issues</h2>
              {(() => {
                const issues = actionIssues[selectedAction.id];
                if (issues?.loading) return <div className="text-[12px] text-dark-dim">Loading issues...</div>;
                if (issues?.error) return <div className="text-[12px] text-danger">Failed to load issues: {issues.error}</div>;
                if (!issues?.data || issues.data.length === 0) return <div className="text-[12px] text-dark-ghost">No issues found</div>;
                return (
                  <>
                    <div className="mb-3">
                      <IssueFilterPills issues={issues.data} filter={issueFilter} onFilterChange={setIssueFilter} />
                    </div>
                    <IssuesList issues={
                      issueFilter === "ALL" ? issues.data
                        : issueFilter === "ERROR" ? issues.data.filter((i) => i.issueType === "ERROR")
                        : issues.data.filter((i) => i.issueType !== "ERROR")
                    } />
                  </>
                );
              })()}
            </div>
          )}

          {/* No action selected */}
          {activeView !== "overview" && !selectedAction && (
            <div className="text-center py-12 text-dark-ghost text-[13px]">
              Select an action from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

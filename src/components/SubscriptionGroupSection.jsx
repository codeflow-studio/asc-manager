import { useState, useEffect } from "react";
import { fetchSubscriptions } from "../api/index.js";
import { SUBSCRIPTION_PERIODS } from "../constants/index.js";
import StatusDot from "./StatusDot.jsx";

const periodLabel = (val) => SUBSCRIPTION_PERIODS.find((p) => p.value === val)?.label || val;

export default function SubscriptionGroupSection({
  group, appId, accountId,
  onEditGroup, onDeleteGroup,
  onAddSub, onEditSub, onDeleteSub,
  refreshKey,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmGroupDelete, setConfirmGroupDelete] = useState(false);

  useEffect(() => {
    if (collapsed) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSubscriptions(appId, group.id, accountId)
      .then((data) => { if (!cancelled) setSubs(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collapsed, appId, group.id, accountId, refreshKey]);

  function handleDeleteSub(sub) {
    if (confirmId === sub.id) {
      onDeleteSub(sub, group);
      setConfirmId(null);
    } else {
      setConfirmId(sub.id);
      setTimeout(() => setConfirmId((prev) => (prev === sub.id ? null : prev)), 3000);
    }
  }

  function handleDeleteGroup() {
    if (confirmGroupDelete) {
      onDeleteGroup(group);
      setConfirmGroupDelete(false);
    } else {
      setConfirmGroupDelete(true);
      setTimeout(() => setConfirmGroupDelete(false), 3000);
    }
  }

  return (
    <div className="bg-dark-surface rounded-[10px] px-4 py-3">
      {/* Group header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-0 font-sans min-w-0 flex-1"
        >
          <span className="text-dark-dim text-xs transition-transform" style={{ display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            {"\u25BE"}
          </span>
          <span className="text-[13px] font-semibold text-dark-text truncate">{group.referenceName}</span>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onAddSub(group)}
            className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
          >
            + Sub
          </button>
          <button
            onClick={() => onEditGroup(group)}
            className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={handleDeleteGroup}
            className={`text-[11px] font-semibold bg-transparent border-none cursor-pointer font-sans px-0 ${
              confirmGroupDelete ? "text-danger" : "text-dark-dim hover:text-danger"
            }`}
          >
            {confirmGroupDelete ? "Confirm?" : "Delete"}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {!collapsed && (
        <div className="mt-3 ml-4 space-y-1.5">
          {loading && (
            <div className="text-center py-4 text-dark-dim">
              <div className="text-sm inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
              <div className="text-[11px] font-semibold mt-1">Loading subscriptions...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <div className="text-[11px] text-danger font-semibold">{error}</div>
            </div>
          )}

          {!loading && !error && subs.length === 0 && (
            <div className="text-center py-4 text-dark-ghost">
              <div className="text-[11px] font-semibold">No subscriptions in this group</div>
            </div>
          )}

          {!loading && !error && subs.map((sub) => (
            <div key={sub.id} className="bg-dark-hover rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-dark-text truncate">{sub.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-dark-dim font-mono truncate">{sub.productId}</span>
                    <span className="text-[10px] font-bold text-accent-light bg-accent-bg px-1.5 py-0.5 rounded">
                      {periodLabel(sub.subscriptionPeriod)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusDot status={sub.state} />
                  <button
                    onClick={() => onEditSub(sub, group)}
                    className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSub(sub)}
                    className={`text-[11px] font-semibold bg-transparent border-none cursor-pointer font-sans px-0 ${
                      confirmId === sub.id ? "text-danger" : "text-dark-dim hover:text-danger"
                    }`}
                  >
                    {confirmId === sub.id ? "Confirm?" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import StatusDot from "./StatusDot.jsx";

export default function IAPSection({ title, iaps, onEdit, onDelete, onAdd }) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  function handleDelete(iap) {
    if (confirmId === iap.id) {
      onDelete(iap);
      setConfirmId(null);
    } else {
      setConfirmId(iap.id);
      setTimeout(() => setConfirmId((prev) => (prev === iap.id ? null : prev)), 3000);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-0 font-sans"
        >
          <span className="text-dark-dim text-xs transition-transform" style={{ display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            {"\u25BE"}
          </span>
          <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">{title}</span>
          <span className="text-[11px] text-dark-dim font-semibold bg-dark-hover px-1.5 py-0.5 rounded">{iaps.length}</span>
        </button>
        <button
          onClick={onAdd}
          className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
        >
          + New
        </button>
      </div>

      {!collapsed && (
        iaps.length === 0 ? (
          <div className="text-center py-6 text-dark-ghost">
            <div className="text-xs font-semibold">No {title.toLowerCase()} yet</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {iaps.map((iap) => (
              <div key={iap.id} className="bg-dark-surface rounded-[10px] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-dark-text truncate">{iap.name}</div>
                    <div className="text-[11px] text-dark-dim font-mono mt-0.5 truncate">{iap.productId}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusDot status={iap.state} />
                    <button
                      onClick={() => onEdit(iap)}
                      className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(iap)}
                      className={`text-[11px] font-semibold bg-transparent border-none cursor-pointer font-sans px-0 ${
                        confirmId === iap.id ? "text-danger" : "text-dark-dim hover:text-danger"
                      }`}
                    >
                      {confirmId === iap.id ? "Confirm?" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

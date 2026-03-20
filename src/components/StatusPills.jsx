import { getStatus } from "../utils/index.js";

export default function StatusPills({ uniqueStatuses, filterStatus, setFilterStatus, setView, isMobile }) {
  return (
    <div
      className={`asc-status-pills flex gap-1.5 items-center ${
        isMobile ? "overflow-x-auto flex-nowrap pb-1" : "flex-wrap"
      } ${isMobile ? "mb-3.5" : "mb-5"}`}
      style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
    >
      <span className="text-[10px] text-dark-ghost font-bold mr-1 uppercase tracking-widest shrink-0">
        Status
      </span>
      {["ALL", ...uniqueStatuses].map((st) => {
        const active = filterStatus === st;
        return (
          <span
            key={st}
            onClick={() => { setFilterStatus(st); setView("all"); }}
            className={`px-3 py-[5px] rounded-[20px] text-[11.5px] font-semibold cursor-pointer transition-all whitespace-nowrap inline-flex items-center gap-[5px] shrink-0 ${
              active
                ? "border border-accent-border bg-accent-bg text-accent-light"
                : "border border-dark-border bg-transparent text-dark-faint"
            }`}
          >
            {st !== "ALL" && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: getStatus(st).color }}
              />
            )}
            {st === "ALL" ? "All Statuses" : getStatus(st).label}
          </span>
        );
      })}
    </div>
  );
}

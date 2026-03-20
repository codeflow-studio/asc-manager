import { IAP_STATUS_MAP } from "../constants/index.js";

export default function StatusDot({ status, statusMap = IAP_STATUS_MAP }) {
  const mapped = statusMap[status];
  const label = mapped?.label || status.replace(/_/g, " ");
  const color = mapped?.color || "#8e8e93";

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </span>
  );
}

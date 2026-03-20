import { getStatus } from "../utils/index.js";

export default function Badge({ status }) {
  const st = getStatus(status);
  return (
    <span
      className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[9px] py-[3px] rounded-md"
      style={{ color: st.color, background: st.bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: st.color }}
      />
      {st.label}
    </span>
  );
}

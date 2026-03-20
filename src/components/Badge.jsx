import { getStatus } from "../utils/index.js";

export default function Badge({ status, version, platform }) {
  const st = getStatus(status);
  const platformLabel = platform === "IOS" ? "iOS" : platform === "MAC_OS" ? "macOS" : platform;

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-dark-dim mt-0.5">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: st.color }}
      />
      {platformLabel} {version} {st.label}
    </span>
  );
}

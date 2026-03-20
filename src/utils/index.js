import { STATUS_MAP } from "../constants/index.js";

export function getStatus(st) {
  return STATUS_MAP[st] || {
    label: st?.replace(/_/g, " ") || "Unknown",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
  };
}

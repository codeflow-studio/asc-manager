import { STATUS_MAP, APP_ICONS } from "../constants/index.js";

export function getStatus(st) {
  return STATUS_MAP[st] || {
    label: st?.replace(/_/g, " ") || "Unknown",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.1)",
  };
}

export function getAppIcon(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return APP_ICONS[Math.abs(hash) % APP_ICONS.length];
}

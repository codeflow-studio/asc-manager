import { getAppIcon } from "../utils/index.js";

export async function fetchApps() {
  const res = await fetch("/api/apps");
  if (!res.ok) throw new Error(`Failed to fetch apps: ${res.status}`);
  const data = await res.json();
  return data.map((app) => ({ ...app, icon: getAppIcon(app.name), iconUrl: app.iconUrl || null }));
}

export async function fetchAccounts() {
  const res = await fetch("/api/accounts");
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.status}`);
  return res.json();
}

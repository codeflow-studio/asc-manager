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

export async function createAccount({ name, issuerId, keyId, privateKey, color }) {
  const res = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, issuerId, keyId, privateKey, color }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create account: ${res.status}`);
  }
  return res.json();
}

export async function deleteAccount(id) {
  const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete account: ${res.status}`);
}

export async function fetchApps({ fresh = false } = {}) {
  const url = fresh ? "/api/apps?fresh=true" : "/api/apps";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch apps: ${res.status}`);
  const data = await res.json();
  return data.map((app) => ({ ...app, iconUrl: app.iconUrl || null }));
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

export async function fetchVersions(appId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/versions?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch versions: ${res.status}`);
  return res.json();
}

export async function createVersion(appId, accountId, versionString, platform) {
  const res = await fetch(`/api/apps/${appId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, versionString, platform }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create version: ${res.status}`);
  }
  return res.json();
}

export async function submitForReview(appId, versionId, accountId) {
  const res = await fetch(`/api/apps/${appId}/versions/${versionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to submit for review: ${res.status}`);
  }
  return res.json();
}

export async function fetchVersionDetail(appId, versionId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/versions/${versionId}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch version detail: ${res.status}`);
  return res.json();
}

export async function fetchVersionBuilds(appId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/builds?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch builds: ${res.status}`);
  return res.json();
}

export async function fetchAttachedBuild(appId, versionId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/versions/${versionId}/build?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch attached build: ${res.status}`);
  return res.json();
}

export async function attachBuild(appId, versionId, buildId, accountId) {
  const res = await fetch(`/api/apps/${appId}/versions/${versionId}/build`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, buildId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to attach build: ${res.status}`);
  }
  return res.json();
}

export async function fetchAppLookup(bundleId) {
  const params = new URLSearchParams({ bundleId });
  const res = await fetch(`/api/apps/lookup?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch app lookup: ${res.status}`);
  return res.json();
}

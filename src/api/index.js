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

// ── In-App Purchases ─────────────────────────────────────────────────────────

export async function fetchIAPs(appId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/iap?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch IAPs: ${res.status}`);
  return res.json();
}

export async function createIAP(appId, { accountId, name, productId, type }) {
  const res = await fetch(`/api/apps/${appId}/iap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, productId, type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create IAP: ${res.status}`);
  }
  return res.json();
}

export async function updateIAP(appId, iapId, { accountId, name, familySharable, reviewNote }) {
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, familySharable, reviewNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update IAP: ${res.status}`);
  }
  return res.json();
}

export async function deleteIAP(appId, iapId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}?${params}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete IAP: ${res.status}`);
  }
  return res.json();
}

// ── IAP Localizations ────────────────────────────────────────────────────────

export async function fetchIAPLocalizations(appId, iapId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}/localizations?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch IAP localizations: ${res.status}`);
  return res.json();
}

export async function createIAPLocalization(appId, iapId, { accountId, locale, name, description }) {
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}/localizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, locale, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create IAP localization: ${res.status}`);
  }
  return res.json();
}

export async function updateIAPLocalization(appId, iapId, locId, { accountId, name, description }) {
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}/localizations/${locId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update IAP localization: ${res.status}`);
  }
  return res.json();
}

export async function deleteIAPLocalization(appId, iapId, locId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/iap/${iapId}/localizations/${locId}?${params}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete IAP localization: ${res.status}`);
  }
  return res.json();
}

// ── Subscription Groups ──────────────────────────────────────────────────────

export async function fetchSubscriptionGroups(appId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch subscription groups: ${res.status}`);
  return res.json();
}

export async function createSubscriptionGroup(appId, { accountId, referenceName }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, referenceName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create subscription group: ${res.status}`);
  }
  return res.json();
}

export async function updateSubscriptionGroup(appId, groupId, { accountId, referenceName }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, referenceName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update subscription group: ${res.status}`);
  }
  return res.json();
}

export async function deleteSubscriptionGroup(appId, groupId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}?${params}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete subscription group: ${res.status}`);
  }
  return res.json();
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function fetchSubscriptions(appId, groupId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch subscriptions: ${res.status}`);
  return res.json();
}

export async function createSubscription(appId, groupId, { accountId, name, productId, subscriptionPeriod }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, productId, subscriptionPeriod }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create subscription: ${res.status}`);
  }
  return res.json();
}

export async function updateSubscription(appId, groupId, subId, { accountId, name, subscriptionPeriod, familySharable, reviewNote }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, subscriptionPeriod, familySharable, reviewNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update subscription: ${res.status}`);
  }
  return res.json();
}

export async function deleteSubscription(appId, groupId, subId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}?${params}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete subscription: ${res.status}`);
  }
  return res.json();
}

// ── Subscription Localizations ───────────────────────────────────────────────

export async function fetchSubscriptionLocalizations(appId, groupId, subId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}/localizations?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch subscription localizations: ${res.status}`);
  return res.json();
}

export async function createSubscriptionLocalization(appId, groupId, subId, { accountId, locale, name, description }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}/localizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, locale, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create subscription localization: ${res.status}`);
  }
  return res.json();
}

export async function updateSubscriptionLocalization(appId, groupId, subId, locId, { accountId, name, description }) {
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}/localizations/${locId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update subscription localization: ${res.status}`);
  }
  return res.json();
}

export async function deleteSubscriptionLocalization(appId, groupId, subId, locId, accountId) {
  const params = new URLSearchParams({ accountId });
  const res = await fetch(`/api/apps/${appId}/subscription-groups/${groupId}/subscriptions/${subId}/localizations/${locId}?${params}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete subscription localization: ${res.status}`);
  }
  return res.json();
}

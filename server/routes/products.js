import { Router } from "express";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";
import { apiCache } from "../lib/cache.js";

const router = Router();

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeIAP(item) {
  return {
    id: item.id,
    name: item.attributes.name,
    productId: item.attributes.productId,
    type: item.attributes.inAppPurchaseType,
    state: item.attributes.state,
    familySharable: item.attributes.familySharable ?? false,
    reviewNote: item.attributes.reviewNote || "",
  };
}

function normalizeSubscription(item, groupId) {
  return {
    id: item.id,
    name: item.attributes.name,
    productId: item.attributes.productId,
    subscriptionPeriod: item.attributes.subscriptionPeriod,
    state: item.attributes.state,
    familySharable: item.attributes.familySharable ?? false,
    reviewNote: item.attributes.reviewNote || "",
    groupId,
  };
}

function normalizeLocalization(item) {
  return {
    id: item.id,
    locale: item.attributes.locale,
    name: item.attributes.name,
    description: item.attributes.description,
  };
}

function resolveAccount(req, res) {
  const accountId = req.query.accountId || req.body?.accountId;
  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];
  if (!account) {
    res.status(400).json({ error: "No accounts configured" });
    return null;
  }
  return account;
}

// ── In-App Purchases ─────────────────────────────────────────────────────────

router.get("/:appId/iap", async (req, res) => {
  const { appId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `iap:list:${appId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(
      account,
      `/v1/apps/${appId}/inAppPurchasesV2?fields[inAppPurchases]=name,productId,inAppPurchaseType,state,familySharable,reviewNote&limit=200`
    );
    const iaps = (data.data || []).map(normalizeIAP);
    apiCache.set(cacheKey, iaps);
    res.json(iaps);
  } catch (err) {
    console.error(`Failed to fetch IAPs for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/iap", async (req, res) => {
  const { appId } = req.params;
  const { accountId, name, productId, type } = req.body;

  if (!accountId || !name || !productId || !type) {
    return res.status(400).json({ error: "accountId, name, productId, and type are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v2/inAppPurchases", {
      method: "POST",
      body: {
        data: {
          type: "inAppPurchases",
          attributes: { name, productId, inAppPurchaseType: type },
          relationships: {
            app: { data: { type: "apps", id: appId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`iap:list:${appId}:`);
    res.json(normalizeIAP(data.data));
  } catch (err) {
    console.error(`Failed to create IAP for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/iap/:iapId", async (req, res) => {
  const { appId, iapId } = req.params;
  const { accountId, name, familySharable, reviewNote } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (name !== undefined) attributes.name = name;
  if (familySharable !== undefined) attributes.familySharable = familySharable;
  if (reviewNote !== undefined) attributes.reviewNote = reviewNote;

  try {
    const data = await ascFetch(account, `/v2/inAppPurchases/${iapId}`, {
      method: "PATCH",
      body: {
        data: { type: "inAppPurchases", id: iapId, attributes },
      },
    });
    apiCache.deleteByPrefix(`iap:list:${appId}:`);
    res.json(normalizeIAP(data.data));
  } catch (err) {
    console.error(`Failed to update IAP ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/iap/:iapId", async (req, res) => {
  const { appId, iapId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    await ascFetch(account, `/v2/inAppPurchases/${iapId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`iap:list:${appId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete IAP ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── IAP Localizations ────────────────────────────────────────────────────────

router.get("/:appId/iap/:iapId/localizations", async (req, res) => {
  const { iapId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `iap:locs:${iapId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(
      account,
      `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations?fields[inAppPurchaseLocalizations]=locale,name,description`
    );
    const locs = (data.data || []).map(normalizeLocalization);
    apiCache.set(cacheKey, locs);
    res.json(locs);
  } catch (err) {
    console.error(`Failed to fetch IAP localizations for ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/iap/:iapId/localizations", async (req, res) => {
  const { iapId } = req.params;
  const { accountId, locale, name, description } = req.body;

  if (!accountId || !locale || !name) {
    return res.status(400).json({ error: "accountId, locale, and name are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v1/inAppPurchaseLocalizations", {
      method: "POST",
      body: {
        data: {
          type: "inAppPurchaseLocalizations",
          attributes: { locale, name, description: description || "" },
          relationships: {
            inAppPurchaseV2: { data: { type: "inAppPurchases", id: iapId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`iap:locs:${iapId}:`);
    res.json(normalizeLocalization(data.data));
  } catch (err) {
    console.error(`Failed to create IAP localization for ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/iap/:iapId/localizations/:locId", async (req, res) => {
  const { iapId, locId } = req.params;
  const { accountId, name, description } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (name !== undefined) attributes.name = name;
  if (description !== undefined) attributes.description = description;

  try {
    const data = await ascFetch(account, `/v1/inAppPurchaseLocalizations/${locId}`, {
      method: "PATCH",
      body: {
        data: { type: "inAppPurchaseLocalizations", id: locId, attributes },
      },
    });
    apiCache.deleteByPrefix(`iap:locs:${iapId}:`);
    res.json(normalizeLocalization(data.data));
  } catch (err) {
    console.error(`Failed to update IAP localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/iap/:iapId/localizations/:locId", async (req, res) => {
  const { iapId, locId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    await ascFetch(account, `/v1/inAppPurchaseLocalizations/${locId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`iap:locs:${iapId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete IAP localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Subscription Groups ──────────────────────────────────────────────────────

router.get("/:appId/subscription-groups", async (req, res) => {
  const { appId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `subs:groups:${appId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(
      account,
      `/v1/apps/${appId}/subscriptionGroups?fields[subscriptionGroups]=referenceName`
    );
    const groups = (data.data || []).map((item) => ({
      id: item.id,
      referenceName: item.attributes.referenceName,
    }));
    apiCache.set(cacheKey, groups);
    res.json(groups);
  } catch (err) {
    console.error(`Failed to fetch subscription groups for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/subscription-groups", async (req, res) => {
  const { appId } = req.params;
  const { accountId, referenceName } = req.body;

  if (!accountId || !referenceName) {
    return res.status(400).json({ error: "accountId and referenceName are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v1/subscriptionGroups", {
      method: "POST",
      body: {
        data: {
          type: "subscriptionGroups",
          attributes: { referenceName },
          relationships: {
            app: { data: { type: "apps", id: appId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`subs:groups:${appId}:`);
    res.json({ id: data.data.id, referenceName: data.data.attributes.referenceName });
  } catch (err) {
    console.error(`Failed to create subscription group for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/subscription-groups/:groupId", async (req, res) => {
  const { appId, groupId } = req.params;
  const { accountId, referenceName } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, `/v1/subscriptionGroups/${groupId}`, {
      method: "PATCH",
      body: {
        data: { type: "subscriptionGroups", id: groupId, attributes: { referenceName } },
      },
    });
    apiCache.deleteByPrefix(`subs:groups:${appId}:`);
    res.json({ id: data.data.id, referenceName: data.data.attributes.referenceName });
  } catch (err) {
    console.error(`Failed to update subscription group ${groupId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/subscription-groups/:groupId", async (req, res) => {
  const { appId, groupId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    await ascFetch(account, `/v1/subscriptionGroups/${groupId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`subs:groups:${appId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete subscription group ${groupId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Subscriptions ────────────────────────────────────────────────────────────

router.get("/:appId/subscription-groups/:groupId/subscriptions", async (req, res) => {
  const { groupId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `subs:list:${groupId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(
      account,
      `/v1/subscriptionGroups/${groupId}/subscriptions?fields[subscriptions]=name,productId,subscriptionPeriod,state,familySharable,reviewNote`
    );
    const subs = (data.data || []).map((item) => normalizeSubscription(item, groupId));
    apiCache.set(cacheKey, subs);
    res.json(subs);
  } catch (err) {
    console.error(`Failed to fetch subscriptions for group ${groupId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/subscription-groups/:groupId/subscriptions", async (req, res) => {
  const { groupId } = req.params;
  const { accountId, name, productId, subscriptionPeriod } = req.body;

  if (!accountId || !name || !productId || !subscriptionPeriod) {
    return res.status(400).json({ error: "accountId, name, productId, and subscriptionPeriod are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v1/subscriptions", {
      method: "POST",
      body: {
        data: {
          type: "subscriptions",
          attributes: { name, productId, subscriptionPeriod },
          relationships: {
            group: { data: { type: "subscriptionGroups", id: groupId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`subs:list:${groupId}:`);
    res.json(normalizeSubscription(data.data, groupId));
  } catch (err) {
    console.error(`Failed to create subscription in group ${groupId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/subscription-groups/:groupId/subscriptions/:subId", async (req, res) => {
  const { groupId, subId } = req.params;
  const { accountId, name, subscriptionPeriod, familySharable, reviewNote } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (name !== undefined) attributes.name = name;
  if (subscriptionPeriod !== undefined) attributes.subscriptionPeriod = subscriptionPeriod;
  if (familySharable !== undefined) attributes.familySharable = familySharable;
  if (reviewNote !== undefined) attributes.reviewNote = reviewNote;

  try {
    const data = await ascFetch(account, `/v1/subscriptions/${subId}`, {
      method: "PATCH",
      body: {
        data: { type: "subscriptions", id: subId, attributes },
      },
    });
    apiCache.deleteByPrefix(`subs:list:${groupId}:`);
    res.json(normalizeSubscription(data.data, groupId));
  } catch (err) {
    console.error(`Failed to update subscription ${subId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/subscription-groups/:groupId/subscriptions/:subId", async (req, res) => {
  const { groupId, subId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    await ascFetch(account, `/v1/subscriptions/${subId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`subs:list:${groupId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete subscription ${subId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Subscription Localizations ───────────────────────────────────────────────

router.get("/:appId/subscription-groups/:groupId/subscriptions/:subId/localizations", async (req, res) => {
  const { subId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `subs:locs:${subId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(
      account,
      `/v1/subscriptions/${subId}/subscriptionLocalizations?fields[subscriptionLocalizations]=locale,name,description`
    );
    const locs = (data.data || []).map(normalizeLocalization);
    apiCache.set(cacheKey, locs);
    res.json(locs);
  } catch (err) {
    console.error(`Failed to fetch subscription localizations for ${subId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/subscription-groups/:groupId/subscriptions/:subId/localizations", async (req, res) => {
  const { subId } = req.params;
  const { accountId, locale, name, description } = req.body;

  if (!accountId || !locale || !name) {
    return res.status(400).json({ error: "accountId, locale, and name are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v1/subscriptionLocalizations", {
      method: "POST",
      body: {
        data: {
          type: "subscriptionLocalizations",
          attributes: { locale, name, description: description || "" },
          relationships: {
            subscription: { data: { type: "subscriptions", id: subId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`subs:locs:${subId}:`);
    res.json(normalizeLocalization(data.data));
  } catch (err) {
    console.error(`Failed to create subscription localization for ${subId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/subscription-groups/:groupId/subscriptions/:subId/localizations/:locId", async (req, res) => {
  const { subId, locId } = req.params;
  const { accountId, name, description } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (name !== undefined) attributes.name = name;
  if (description !== undefined) attributes.description = description;

  try {
    const data = await ascFetch(account, `/v1/subscriptionLocalizations/${locId}`, {
      method: "PATCH",
      body: {
        data: { type: "subscriptionLocalizations", id: locId, attributes },
      },
    });
    apiCache.deleteByPrefix(`subs:locs:${subId}:`);
    res.json(normalizeLocalization(data.data));
  } catch (err) {
    console.error(`Failed to update subscription localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/subscription-groups/:groupId/subscriptions/:subId/localizations/:locId", async (req, res) => {
  const { subId, locId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    await ascFetch(account, `/v1/subscriptionLocalizations/${locId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`subs:locs:${subId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete subscription localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;

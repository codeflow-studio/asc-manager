import { Router } from "express";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";
import { apiCache } from "../lib/cache.js";

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

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

async function fetchAllPages(account, path, maxPages = 20) {
  const allData = [];
  const allIncluded = [];
  let url = path;
  let page = 0;

  while (url) {
    if (page >= maxPages) break;
    const result = await ascFetch(account, url);
    if (result.data) allData.push(...result.data);
    if (result.included) allIncluded.push(...result.included);
    page++;
    url = result.links?.next || null;
    if (url) {
      // ASC returns full URLs for pagination; strip the base
      url = url.replace("https://api.appstoreconnect.apple.com", "");
    }
  }

  return { data: allData, included: allIncluded };
}

// ── IAP Prices ──────────────────────────────────────────────────────────────

// Get current prices for an IAP (fast — only fetches schedule, not all price points)
router.get("/:appId/iap/:iapId/prices", async (req, res) => {
  const { iapId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `iap:prices:${iapId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const scheduleRes = await ascFetch(
      account,
      `/v1/inAppPurchases/${iapId}/inAppPurchasePriceSchedule?include=manualPrices,baseTerritory`
    ).catch(() => ({ data: null, included: [] }));

    // Extract base territory
    const baseTerritoryData = (scheduleRes.included || []).find(
      (i) => i.type === "territories"
    );
    const baseTerritory = baseTerritoryData?.id || null;

    // Build map of current prices from manual prices in schedule
    const manualPrices = (scheduleRes.included || []).filter(
      (i) => i.type === "inAppPurchasePrices"
    );

    // Collect price point IDs we need to resolve customerPrice for
    const pricePointIds = new Set();
    const currentPrices = {};

    for (const mp of manualPrices) {
      const territoryId = mp.relationships?.territory?.data?.id;
      const pricePointId = mp.relationships?.inAppPurchasePricePoint?.data?.id;
      if (territoryId && pricePointId) {
        currentPrices[territoryId] = { pricePointId, customerPrice: null };
        pricePointIds.add(pricePointId);
      }
    }

    // Resolve customerPrice from included inAppPurchasePricePoints
    for (const inc of scheduleRes.included || []) {
      if (inc.type === "inAppPurchasePricePoints" && pricePointIds.has(inc.id)) {
        for (const entry of Object.values(currentPrices)) {
          if (entry.pricePointId === inc.id) {
            entry.customerPrice = inc.attributes?.customerPrice || null;
          }
        }
      }
    }

    const result = { baseTerritory, currentPrices };

    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch IAP prices for ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Get available price points for a specific territory (lazy-loaded by frontend)
router.get("/:appId/iap/:iapId/price-points", async (req, res) => {
  const { iapId } = req.params;
  const territory = req.query.territory;
  const account = resolveAccount(req, res);
  if (!account) return;

  if (!territory) {
    return res.status(400).json({ error: "territory query parameter is required" });
  }

  const cacheKey = `iap:price-points:${iapId}:${territory}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const ppRes = await fetchAllPages(
      account,
      `/v1/inAppPurchases/${iapId}/pricePoints?filter[territory]=${territory}&include=territory&limit=200`
    );

    const pricePoints = (ppRes.data || []).map((pp) => ({
      id: pp.id,
      customerPrice: pp.attributes?.customerPrice || "0",
      proceeds: pp.attributes?.proceeds || "0",
    })).sort((a, b) => parseFloat(a.customerPrice) - parseFloat(b.customerPrice));

    const result = { pricePoints };
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch IAP price points for ${iapId}/${territory}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/iap/:iapId/prices", async (req, res) => {
  const { iapId } = req.params;
  const { accountId, baseTerritory, manualPrices } = req.body;

  if (!accountId || !baseTerritory || !manualPrices) {
    return res
      .status(400)
      .json({ error: "accountId, baseTerritory, and manualPrices are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    // Build the included array with client-generated IDs
    const included = manualPrices.map((mp, index) => ({
      type: "inAppPurchasePrices",
      id: `price-${mp.territory}-${index}`,
      attributes: {
        startDate: null,
      },
      relationships: {
        inAppPurchaseV2: {
          data: { type: "inAppPurchases", id: iapId },
        },
        inAppPurchasePricePoint: {
          data: {
            type: "inAppPurchasePricePoints",
            id: mp.pricePointId,
          },
        },
      },
    }));

    const body = {
      data: {
        type: "inAppPurchasePriceSchedules",
        relationships: {
          inAppPurchase: {
            data: { type: "inAppPurchases", id: iapId },
          },
          baseTerritory: {
            data: { type: "territories", id: baseTerritory },
          },
          manualPrices: {
            data: included.map((inc) => ({
              type: inc.type,
              id: inc.id,
            })),
          },
        },
      },
      included,
    };

    await ascFetch(account, "/v1/inAppPurchasePriceSchedules", {
      method: "POST",
      body,
    });

    apiCache.deleteByPrefix(`iap:prices:${iapId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to set IAP prices for ${iapId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Subscription Prices ─────────────────────────────────────────────────────

// Get current prices for a subscription (fast — only fetches current prices, not all price points)
router.get(
  "/:appId/subscription-groups/:groupId/subscriptions/:subId/prices",
  async (req, res) => {
    const { subId } = req.params;
    const account = resolveAccount(req, res);
    if (!account) return;

    const cacheKey = `sub:prices:${subId}:${account.id}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const currentPricesRes = await fetchAllPages(
        account,
        `/v1/subscriptions/${subId}/prices?include=subscriptionPricePoint,territory&limit=200`
      );

      // Map current price point IDs to their prices from included
      const pricePointDetailMap = new Map();
      for (const inc of currentPricesRes.included || []) {
        if (inc.type === "subscriptionPricePoints") {
          pricePointDetailMap.set(inc.id, {
            customerPrice: inc.attributes?.customerPrice || "0",
            proceeds: inc.attributes?.proceeds || "0",
          });
        }
      }

      // Build current prices map: territory -> { pricePointId, customerPrice }
      const currentPrices = {};
      for (const price of currentPricesRes.data || []) {
        const territoryId = price.relationships?.territory?.data?.id;
        const pricePointId =
          price.relationships?.subscriptionPricePoint?.data?.id;
        if (territoryId && pricePointId) {
          const detail = pricePointDetailMap.get(pricePointId);
          currentPrices[territoryId] = {
            pricePointId,
            customerPrice: detail?.customerPrice || null,
          };
        }
      }

      const result = { baseTerritory: null, currentPrices };

      apiCache.set(cacheKey, result);
      res.json(result);
    } catch (err) {
      console.error(
        `Failed to fetch subscription prices for ${subId}:`,
        err.message
      );
      res.status(502).json({ error: err.message });
    }
  }
);

// Get available price points for a specific territory (lazy-loaded by frontend)
router.get(
  "/:appId/subscription-groups/:groupId/subscriptions/:subId/price-points",
  async (req, res) => {
    const { subId } = req.params;
    const territory = req.query.territory;
    const account = resolveAccount(req, res);
    if (!account) return;

    if (!territory) {
      return res.status(400).json({ error: "territory query parameter is required" });
    }

    const cacheKey = `sub:price-points:${subId}:${territory}:${account.id}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const ppRes = await fetchAllPages(
        account,
        `/v1/subscriptions/${subId}/pricePoints?filter[territory]=${territory}&include=territory&limit=200`
      );

      const pricePoints = (ppRes.data || []).map((pp) => ({
        id: pp.id,
        customerPrice: pp.attributes?.customerPrice || "0",
        proceeds: pp.attributes?.proceeds || "0",
      })).sort((a, b) => parseFloat(a.customerPrice) - parseFloat(b.customerPrice));

      const result = { pricePoints };
      apiCache.set(cacheKey, result);
      res.json(result);
    } catch (err) {
      console.error(`Failed to fetch subscription price points for ${subId}/${territory}:`, err.message);
      res.status(502).json({ error: err.message });
    }
  }
);

router.post(
  "/:appId/subscription-groups/:groupId/subscriptions/:subId/prices",
  async (req, res) => {
    const { subId } = req.params;
    const { accountId, prices } = req.body;

    if (!accountId || !prices || !Array.isArray(prices)) {
      return res
        .status(400)
        .json({ error: "accountId and prices array are required" });
    }

    const accounts = getAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return res.status(400).json({ error: "Account not found" });

    const results = await Promise.allSettled(
      prices.map((p) =>
        ascFetch(account, "/v1/subscriptionPrices", {
          method: "POST",
          body: {
            data: {
              type: "subscriptionPrices",
              attributes: {
                startDate: null,
                preserveCurrentPrice: false,
              },
              relationships: {
                subscription: {
                  data: { type: "subscriptions", id: subId },
                },
                subscriptionPricePoint: {
                  data: {
                    type: "subscriptionPricePoints",
                    id: p.pricePointId,
                  },
                },
              },
            },
          },
        })
      )
    );

    const errors = [];
    let saved = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        saved++;
      } else {
        errors.push({
          territory: prices[i].territory,
          message: r.reason?.message || "Unknown error",
        });
      }
    });

    apiCache.deleteByPrefix(`sub:prices:${subId}:`);
    res.json({ saved, errors });
  }
);

export default router;

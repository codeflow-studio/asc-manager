import { Router } from "express";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";

const router = Router();
const iconCache = new Map();
const lookupCache = new Map();

router.get("/", async (_req, res) => {
  const allApps = [];
  const accounts = getAccounts();

  for (const account of accounts) {
    try {
      const data = await ascFetch(
        account,
        "/v1/apps?fields[apps]=name,bundleId,appStoreVersions&include=appStoreVersions&fields[appStoreVersions]=versionString,appStoreState,platform&limit=200"
      );

      const versions = {};
      if (data.included) {
        for (const inc of data.included) {
          if (inc.type === "appStoreVersions") {
            if (!versions[inc.id]) {
              versions[inc.id] = {
                versionString: inc.attributes.versionString,
                appStoreState: inc.attributes.appStoreState,
                platform: inc.attributes.platform,
              };
            }
          }
        }
      }

      for (const item of data.data) {
        const versionRefs = item.relationships?.appStoreVersions?.data || [];
        const latestRef = versionRefs[0];
        const latestVersion = latestRef ? versions[latestRef.id] : null;

        allApps.push({
          id: item.id,
          name: item.attributes.name,
          bundleId: item.attributes.bundleId,
          platform: latestVersion?.platform || "IOS",
          version: latestVersion?.versionString || "\u2014",
          status: latestVersion?.appStoreState || "UNKNOWN",
          account: account.name,
          accountId: account.id,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch apps for ${account.name}:`, err.message);
    }
  }

  // Fetch icon URLs from iTunes Lookup API
  const uncachedApps = allApps.filter((app) => {
    if (iconCache.has(app.bundleId)) {
      app.iconUrl = iconCache.get(app.bundleId);
      return false;
    }
    return true;
  });

  await Promise.allSettled(
    uncachedApps.map(async (app) => {
      try {
        const lookupRes = await fetch(
          `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(app.bundleId)}&country=US&limit=1`
        );
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          if (lookupData.resultCount > 0) {
            const url = lookupData.results[0].artworkUrl512 || lookupData.results[0].artworkUrl100 || null;
            app.iconUrl = url;
            iconCache.set(app.bundleId, url);
          }
        }
      } catch {
        // Silently fail -- fallback to build icon below
      }
    })
  );

  // Fallback: fetch build icons from ASC API for apps without iTunes icons
  // (e.g., apps not yet published, or only available in non-US stores)
  const appsWithoutIcon = allApps.filter((app) => !app.iconUrl);
  if (appsWithoutIcon.length > 0) {
    const accountsMap = new Map(accounts.map((a) => [a.id, a]));

    await Promise.allSettled(
      appsWithoutIcon.map(async (app) => {
        try {
          const account = accountsMap.get(app.accountId);
          if (!account) return;

          const buildsData = await ascFetch(
            account,
            `/v1/apps/${app.id}/builds?limit=1&fields[builds]=iconAssetToken`
          );
          if (!buildsData.data?.length) return;

          const token = buildsData.data[0].attributes?.iconAssetToken;
          if (token?.templateUrl) {
            const url = token.templateUrl
              .replace("{w}", "512")
              .replace("{h}", "512")
              .replace("{f}", "png");
            app.iconUrl = url;
            iconCache.set(app.bundleId, url);
          }
        } catch {
          // Silently fail -- frontend will use gradient placeholder
        }
      })
    );
  }

  res.json(allApps);
});

router.get("/lookup", async (req, res) => {
  const { bundleId } = req.query;
  if (!bundleId) {
    return res.status(400).json({ error: "bundleId query parameter is required" });
  }

  if (lookupCache.has(bundleId)) {
    return res.json(lookupCache.get(bundleId));
  }

  try {
    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=US&limit=1`
    );
    if (!lookupRes.ok) {
      return res.json({ found: false });
    }

    const lookupData = await lookupRes.json();
    if (lookupData.resultCount === 0) {
      const result = { found: false };
      lookupCache.set(bundleId, result);
      return res.json(result);
    }

    const r = lookupData.results[0];
    const result = {
      found: true,
      description: r.description || null,
      averageUserRating: r.averageUserRating || null,
      userRatingCount: r.userRatingCount || 0,
      sellerName: r.sellerName || null,
      price: r.price ?? null,
      formattedPrice: r.formattedPrice || null,
      primaryGenreName: r.primaryGenreName || null,
      screenshotUrls: r.screenshotUrls || [],
      trackViewUrl: r.trackViewUrl || null,
    };
    lookupCache.set(bundleId, result);
    res.json(result);
  } catch (err) {
    console.error(`iTunes lookup failed for ${bundleId}:`, err.message);
    res.json({ found: false });
  }
});

router.get("/:appId/versions", async (req, res) => {
  const { appId } = req.params;
  const { accountId } = req.query;

  const accounts = getAccounts();
  const account =
    accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    const data = await ascFetch(
      account,
      `/v1/apps/${appId}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,platform,createdDate`
    );

    const versionsList = data.data.map((v) => ({
      id: v.id,
      versionString: v.attributes.versionString,
      appStoreState: v.attributes.appStoreState,
      platform: v.attributes.platform,
      createdDate: v.attributes.createdDate,
    }));

    res.json(versionsList);
  } catch (err) {
    console.error(`Failed to fetch versions for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;

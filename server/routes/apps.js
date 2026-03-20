import { Router } from "express";
import { ACCOUNTS } from "../config/accounts.js";
import { ascFetch } from "../lib/asc-client.js";

const router = Router();
const iconCache = new Map();

router.get("/", async (_req, res) => {
  const allApps = [];

  for (const account of ACCOUNTS) {
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
          } else {
            iconCache.set(app.bundleId, null);
          }
        }
      } catch {
        // Silently fail -- frontend will use emoji fallback
      }
    })
  );

  res.json(allApps);
});

router.get("/:appId/versions", async (req, res) => {
  const { appId } = req.params;
  const { accountId } = req.query;

  const account =
    ACCOUNTS.find((a) => a.id === accountId) || ACCOUNTS[0];

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

import { Router } from "express";
import { ACCOUNTS } from "../config/accounts.js";
import { ascFetch } from "../lib/asc-client.js";

const router = Router();

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

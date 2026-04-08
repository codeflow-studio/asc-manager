import { Router } from "express";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";
import { apiCache } from "../lib/cache.js";

const router = Router();
const iconCache = new Map();

router.get("/", async (req, res) => {
  const fresh = req.query.fresh === "true";
  if (!fresh) {
    const cached = apiCache.get("apps:list");
    if (cached) return res.json(cached);
  }

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

  apiCache.set("apps:list", allApps);
  res.json(allApps);
});

router.get("/lookup", async (req, res) => {
  const { bundleId } = req.query;
  if (!bundleId) {
    return res.status(400).json({ error: "bundleId query parameter is required" });
  }

  const cached = apiCache.get(`apps:lookup:${bundleId}`);
  if (cached) return res.json(cached);

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
      apiCache.set(`apps:lookup:${bundleId}`, result);
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
    apiCache.set(`apps:lookup:${bundleId}`, result);
    res.json(result);
  } catch (err) {
    console.error(`iTunes lookup failed for ${bundleId}:`, err.message);
    res.json({ found: false });
  }
});

router.get("/:appId/versions", async (req, res) => {
  const { appId } = req.params;
  const { accountId, fresh } = req.query;

  const cacheKey = `apps:versions:${appId}:${accountId || "default"}`;
  if (fresh !== "true") {
    const cached = apiCache.get(cacheKey);
    if (cached) return res.json(cached);
  }

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

    apiCache.set(cacheKey, versionsList);
    res.json(versionsList);
  } catch (err) {
    console.error(`Failed to fetch versions for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/versions", async (req, res) => {
  const { appId } = req.params;
  const { accountId, versionString, platform } = req.body;

  if (!accountId || !versionString || !platform) {
    return res.status(400).json({ error: "accountId, versionString, and platform are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return res.status(400).json({ error: "Account not found" });
  }

  try {
    const TERMINAL_STATES = new Set(["READY_FOR_SALE", "REMOVED_FROM_SALE", "DEVELOPER_REJECTED", "REJECTED"]);

    const existingData = await ascFetch(
      account,
      `/v1/apps/${appId}/appStoreVersions?fields[appStoreVersions]=appStoreState`
    );

    const hasNonTerminal = existingData.data.some(
      (v) => !TERMINAL_STATES.has(v.attributes.appStoreState)
    );

    if (hasNonTerminal) {
      return res.status(409).json({
        error: "Cannot create a new version while a non-released version exists",
      });
    }

    const data = await ascFetch(account, "/v1/appStoreVersions", {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersions",
          attributes: { versionString, platform },
          relationships: {
            app: { data: { type: "apps", id: appId } },
          },
        },
      },
    });

    apiCache.delete("apps:list");
    apiCache.deleteByPrefix(`apps:versions:${appId}:`);

    res.json({
      id: data.data.id,
      versionString: data.data.attributes.versionString,
      appStoreState: data.data.attributes.appStoreState,
      platform: data.data.attributes.platform,
      createdDate: data.data.attributes.createdDate,
    });
  } catch (err) {
    console.error(`Failed to create version for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get("/:appId/versions/:versionId", async (req, res) => {
  const { versionId } = req.params;
  const { accountId } = req.query;

  const cacheKey = `apps:version-detail:${versionId}:${accountId || "default"}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    const data = await ascFetch(
      account,
      `/v1/appStoreVersions/${versionId}?fields[appStoreVersions]=versionString,appStoreState,platform,createdDate,releaseType,earliestReleaseDate,downloadable,reviewType&include=appStoreVersionPhasedRelease&fields[appStoreVersionPhasedReleases]=phasedReleaseState,currentDayNumber,startDate,totalPauseDuration`
    );

    const attrs = data.data.attributes;

    let phasedRelease = null;
    if (data.included) {
      const pr = data.included.find((inc) => inc.type === "appStoreVersionPhasedReleases");
      if (pr) {
        phasedRelease = {
          id: pr.id,
          phasedReleaseState: pr.attributes.phasedReleaseState,
          currentDayNumber: pr.attributes.currentDayNumber,
          startDate: pr.attributes.startDate,
          totalPauseDuration: pr.attributes.totalPauseDuration,
        };
      }
    }

    const result = {
      id: data.data.id,
      versionString: attrs.versionString,
      appStoreState: attrs.appStoreState,
      platform: attrs.platform,
      createdDate: attrs.createdDate,
      releaseType: attrs.releaseType,
      earliestReleaseDate: attrs.earliestReleaseDate,
      downloadable: attrs.downloadable,
      reviewType: attrs.reviewType,
      phasedRelease,
    };

    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch version detail ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Version Settings (release type, rating reset) ───────────────────────────

router.patch("/:appId/versions/:versionId", async (req, res) => {
  const { versionId } = req.params;
  const { accountId, releaseType, earliestReleaseDate, resetRatingSummary } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (releaseType !== undefined) attributes.releaseType = releaseType;
  if (earliestReleaseDate !== undefined) attributes.earliestReleaseDate = earliestReleaseDate;
  if (resetRatingSummary !== undefined) attributes.resetRatingSummary = resetRatingSummary;

  try {
    await ascFetch(account, `/v1/appStoreVersions/${versionId}`, {
      method: "PATCH",
      body: {
        data: { type: "appStoreVersions", id: versionId, attributes },
      },
    });

    apiCache.deleteByPrefix(`apps:version-detail:${versionId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to update version ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Phased Release ──────────────────────────────────────────────────────────

router.post("/:appId/versions/:versionId/phased-release", async (req, res) => {
  const { versionId } = req.params;
  const { accountId, phasedReleaseState } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, "/v1/appStoreVersionPhasedReleases", {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersionPhasedReleases",
          attributes: { phasedReleaseState: phasedReleaseState || "INACTIVE" },
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
          },
        },
      },
    });

    apiCache.deleteByPrefix(`apps:version-detail:${versionId}:`);
    res.json({
      id: data.data.id,
      phasedReleaseState: data.data.attributes.phasedReleaseState,
      currentDayNumber: data.data.attributes.currentDayNumber,
      startDate: data.data.attributes.startDate,
      totalPauseDuration: data.data.attributes.totalPauseDuration,
    });
  } catch (err) {
    console.error(`Failed to create phased release for version ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/versions/:versionId/phased-release/:phasedReleaseId", async (req, res) => {
  const { versionId, phasedReleaseId } = req.params;
  const { accountId, phasedReleaseState } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  try {
    const data = await ascFetch(account, `/v1/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
      method: "PATCH",
      body: {
        data: {
          type: "appStoreVersionPhasedReleases",
          id: phasedReleaseId,
          attributes: { phasedReleaseState },
        },
      },
    });

    apiCache.deleteByPrefix(`apps:version-detail:${versionId}:`);
    res.json({
      id: data.data.id,
      phasedReleaseState: data.data.attributes.phasedReleaseState,
      currentDayNumber: data.data.attributes.currentDayNumber,
      startDate: data.data.attributes.startDate,
      totalPauseDuration: data.data.attributes.totalPauseDuration,
    });
  } catch (err) {
    console.error(`Failed to update phased release ${phasedReleaseId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/versions/:versionId/phased-release/:phasedReleaseId", async (req, res) => {
  const { versionId, phasedReleaseId } = req.params;
  const { accountId } = req.query;

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];
  if (!account) return res.status(400).json({ error: "No accounts configured" });

  try {
    await ascFetch(account, `/v1/appStoreVersionPhasedReleases/${phasedReleaseId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`apps:version-detail:${versionId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete phased release ${phasedReleaseId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get("/:appId/builds", async (req, res) => {
  const { appId } = req.params;
  const { accountId, versionString } = req.query;

  const cacheKey = `apps:builds:${appId}:${accountId || "default"}:${versionString || "all"}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    const fields = "fields[builds]=version,processingState,uploadedDate,iconAssetToken,minOsVersion,buildAudienceType";
    let url;
    if (versionString) {
      url = `/v1/builds?filter[app]=${appId}&filter[preReleaseVersion.version]=${encodeURIComponent(versionString)}&${fields}&limit=25`;
    } else {
      url = `/v1/apps/${appId}/builds?${fields}&limit=25`;
    }
    const data = await ascFetch(account, url);

    const builds = data.data.map((b) => {
      const attrs = b.attributes;
      let iconUrl = null;
      if (attrs.iconAssetToken?.templateUrl) {
        iconUrl = attrs.iconAssetToken.templateUrl
          .replace("{w}", "128")
          .replace("{h}", "128")
          .replace("{f}", "png");
      }
      return {
        id: b.id,
        version: attrs.version,
        processingState: attrs.processingState,
        uploadedDate: attrs.uploadedDate,
        minOsVersion: attrs.minOsVersion,
        buildAudienceType: attrs.buildAudienceType,
        iconUrl,
      };
    }).sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate));

    apiCache.set(cacheKey, builds);
    res.json(builds);
  } catch (err) {
    console.error(`Failed to fetch builds for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get("/:appId/versions/:versionId/build", async (req, res) => {
  const { versionId } = req.params;
  const { accountId } = req.query;

  const cacheKey = `apps:version-build:${versionId}:${accountId || "default"}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    const data = await ascFetch(
      account,
      `/v1/appStoreVersions/${versionId}/build?fields[builds]=version,processingState,uploadedDate,minOsVersion`
    );

    const build = data.data
      ? {
          id: data.data.id,
          version: data.data.attributes.version,
          processingState: data.data.attributes.processingState,
          uploadedDate: data.data.attributes.uploadedDate,
          minOsVersion: data.data.attributes.minOsVersion,
        }
      : null;

    const result = { build };
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch build for version ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/versions/:versionId/build", async (req, res) => {
  const { versionId } = req.params;
  const { accountId, buildId } = req.body;

  if (!accountId || !buildId) {
    return res.status(400).json({ error: "accountId and buildId are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return res.status(400).json({ error: "Account not found" });
  }

  try {
    await ascFetch(account, `/v1/appStoreVersions/${versionId}`, {
      method: "PATCH",
      body: {
        data: {
          type: "appStoreVersions",
          id: versionId,
          relationships: {
            build: { data: { type: "builds", id: buildId } },
          },
        },
      },
    });

    apiCache.deleteByPrefix(`apps:version-build:${versionId}:`);
    apiCache.deleteByPrefix(`apps:version-detail:${versionId}:`);

    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to attach build to version ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Version Localizations ───────────────────────────────────────────────────

function normalizeVersionLocalization(item) {
  return {
    id: item.id,
    locale: item.attributes.locale,
    description: item.attributes.description,
    whatsNew: item.attributes.whatsNew,
    keywords: item.attributes.keywords,
    promotionalText: item.attributes.promotionalText,
    supportUrl: item.attributes.supportUrl,
    marketingUrl: item.attributes.marketingUrl,
  };
}

router.get("/:appId/versions/:versionId/localizations", async (req, res) => {
  const { versionId } = req.params;
  const { accountId } = req.query;

  const cacheKey = `apps:version-locs:${versionId}:${accountId || "default"}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    const data = await ascFetch(
      account,
      `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,description,whatsNew,keywords,promotionalText,supportUrl,marketingUrl`
    );
    const locs = (data.data || []).map(normalizeVersionLocalization);
    apiCache.set(cacheKey, locs);
    res.json(locs);
  } catch (err) {
    console.error(`Failed to fetch version localizations for ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/versions/:versionId/localizations", async (req, res) => {
  const { versionId } = req.params;
  const { accountId, locale, description, whatsNew, keywords, promotionalText, supportUrl, marketingUrl } = req.body;

  if (!accountId || !locale) {
    return res.status(400).json({ error: "accountId and locale are required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = { locale };
  if (description !== undefined) attributes.description = description;
  if (whatsNew !== undefined) attributes.whatsNew = whatsNew;
  if (keywords !== undefined) attributes.keywords = keywords;
  if (promotionalText !== undefined) attributes.promotionalText = promotionalText;
  if (supportUrl !== undefined) attributes.supportUrl = supportUrl;
  if (marketingUrl !== undefined) attributes.marketingUrl = marketingUrl;

  try {
    const data = await ascFetch(account, "/v1/appStoreVersionLocalizations", {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          attributes,
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
          },
        },
      },
    });
    apiCache.deleteByPrefix(`apps:version-locs:${versionId}:`);
    res.json(normalizeVersionLocalization(data.data));
  } catch (err) {
    console.error(`Failed to create version localization for ${versionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.patch("/:appId/versions/:versionId/localizations/:locId", async (req, res) => {
  const { versionId, locId } = req.params;
  const { accountId, description, whatsNew, keywords, promotionalText, supportUrl, marketingUrl } = req.body;

  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(400).json({ error: "Account not found" });

  const attributes = {};
  if (description !== undefined) attributes.description = description;
  if (whatsNew !== undefined) attributes.whatsNew = whatsNew;
  if (keywords !== undefined) attributes.keywords = keywords;
  if (promotionalText !== undefined) attributes.promotionalText = promotionalText;
  if (supportUrl !== undefined) attributes.supportUrl = supportUrl;
  if (marketingUrl !== undefined) attributes.marketingUrl = marketingUrl;

  try {
    const data = await ascFetch(account, `/v1/appStoreVersionLocalizations/${locId}`, {
      method: "PATCH",
      body: {
        data: { type: "appStoreVersionLocalizations", id: locId, attributes },
      },
    });
    apiCache.deleteByPrefix(`apps:version-locs:${versionId}:`);
    res.json(normalizeVersionLocalization(data.data));
  } catch (err) {
    console.error(`Failed to update version localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.delete("/:appId/versions/:versionId/localizations/:locId", async (req, res) => {
  const { versionId, locId } = req.params;
  const { accountId } = req.query;

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];
  if (!account) return res.status(400).json({ error: "No accounts configured" });

  try {
    await ascFetch(account, `/v1/appStoreVersionLocalizations/${locId}`, { method: "DELETE" });
    apiCache.deleteByPrefix(`apps:version-locs:${versionId}:`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete version localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Review Submissions ──────────────────────────────────────────────────────

const REVIEW_STATE_DISPLAY = {
  WAITING_FOR_REVIEW: "Waiting for Review",
  IN_REVIEW: "In Review",
  UNRESOLVED_ISSUES: "Unresolved issues",
  COMPLETE: "Review Completed",
  CANCELING: "Removed",
};

function buildReviewSubmissionUrl(appId, { states, limit }) {
  const base = `/v1/apps/${appId}/reviewSubmissions`;
  const params = [
    "include=items,appStoreVersionForReview,submittedByActor",
    "fields[reviewSubmissions]=submittedDate,state,platform,items,appStoreVersionForReview,submittedByActor",
    "fields[reviewSubmissionItems]=state,appStoreVersion",
    "fields[appStoreVersions]=versionString,platform",
    "fields[actors]=userFirstName,userLastName",
    `limit=${limit}`,
  ];
  if (states) {
    params.push(`filter[state]=${states.join(",")}`);
  }
  return `${base}?${params.join("&")}`;
}

function parseReviewSubmissions(data) {
  const includedMap = new Map();
  if (data.included) {
    for (const inc of data.included) {
      includedMap.set(`${inc.type}:${inc.id}`, inc);
    }
  }

  return (data.data || []).map((submission) => {
    const attrs = submission.attributes;
    const state = attrs.state;

    // Count items
    const itemRefs = submission.relationships?.items?.data || [];
    const itemCount = itemRefs.length;

    // Resolve version string -- try appStoreVersionForReview first, then items
    let versions = null;
    const versionRef = submission.relationships?.appStoreVersionForReview?.data;
    if (versionRef) {
      const ver = includedMap.get(`${versionRef.type}:${versionRef.id}`);
      if (ver) {
        const platform = ver.attributes.platform === "IOS" ? "iOS" : ver.attributes.platform === "MAC_OS" ? "macOS" : ver.attributes.platform;
        versions = `${platform} ${ver.attributes.versionString}`;
      }
    }

    if (!versions && itemRefs.length > 0) {
      const versionStrings = new Set();
      for (const ref of itemRefs) {
        const item = includedMap.get(`${ref.type}:${ref.id}`);
        const itemVersionRef = item?.relationships?.appStoreVersion?.data;
        if (itemVersionRef) {
          const ver = includedMap.get(`${itemVersionRef.type}:${itemVersionRef.id}`);
          if (ver) {
            const platform = ver.attributes.platform === "IOS" ? "iOS" : ver.attributes.platform === "MAC_OS" ? "macOS" : ver.attributes.platform;
            versionStrings.add(`${platform} ${ver.attributes.versionString}`);
          }
        }
      }
      if (versionStrings.size > 1) versions = "Multiple Versions";
      else if (versionStrings.size === 1) versions = [...versionStrings][0];
    }

    if (itemCount > 1 && !versions) versions = "Multiple Versions";

    // Resolve submittedBy
    let submittedBy = null;
    const actorRef = submission.relationships?.submittedByActor?.data;
    if (actorRef) {
      const actor = includedMap.get(`${actorRef.type}:${actorRef.id}`);
      if (actor) {
        submittedBy = [actor.attributes.userFirstName, actor.attributes.userLastName].filter(Boolean).join(" ");
      }
    }

    // Derive display status: for COMPLETE submissions, check item states
    // If all items are REMOVED, show "Removed" instead of "Review Completed"
    let displayStatus = REVIEW_STATE_DISPLAY[state] || state;
    if (state === "COMPLETE" && itemRefs.length > 0) {
      const allRemoved = itemRefs.every((ref) => {
        const item = includedMap.get(`${ref.type}:${ref.id}`);
        return item?.attributes?.state === "REMOVED";
      });
      if (allRemoved) displayStatus = "Removed";
    }

    return { id: submission.id, state, displayStatus, submittedDate: attrs.submittedDate, versions, submittedBy, itemCount };
  });
}

router.get("/:appId/review-submissions", async (req, res) => {
  const { appId } = req.params;
  const { accountId } = req.query;

  const cacheKey = `apps:review-submissions:${appId}:${accountId || "default"}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId) || accounts[0];

  try {
    // Two parallel calls: one for unresolved messages, one for terminal submissions
    const [messagesData, submissionsData] = await Promise.all([
      ascFetch(account, buildReviewSubmissionUrl(appId, { states: ["UNRESOLVED_ISSUES"], limit: 10 })),
      ascFetch(account, buildReviewSubmissionUrl(appId, { states: ["WAITING_FOR_REVIEW", "IN_REVIEW"], limit: 10 })),
    ]);

    const rawMessages = parseReviewSubmissions(messagesData);
    const rawSubmissions = parseReviewSubmissions(submissionsData);

    const messages = rawMessages.map((m) => ({
      id: m.id,
      createdDate: m.submittedDate,
      versions: m.versions || "Unknown",
      gracePeriodEnds: null,
      status: m.displayStatus,
    }));
    messages.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

    const submissions = rawSubmissions.map((s) => ({
      id: s.id,
      submittedDate: s.submittedDate,
      versions: s.versions || "Unknown",
      submittedBy: s.submittedBy || "Unknown",
      itemCount: s.itemCount === 1 ? "1 Item" : `${s.itemCount} Items`,
      status: s.displayStatus,
    }));
    submissions.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

    const result = { messages, submissions: submissions.slice(0, 10) };
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch review submissions for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post("/:appId/versions/:versionId/submit", async (req, res) => {
  const { appId, versionId } = req.params;
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    return res.status(400).json({ error: "Account not found" });
  }

  try {
    await ascFetch(account, "/v1/appStoreVersionSubmissions", {
      method: "POST",
      body: {
        data: {
          type: "appStoreVersionSubmissions",
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
          },
        },
      },
    });

    apiCache.delete("apps:list");
    apiCache.deleteByPrefix(`apps:versions:${appId}:`);
    apiCache.deleteByPrefix(`apps:review-submissions:${appId}:`);

    res.json({ success: true, versionId });
  } catch (err) {
    // If a submission already exists, the API rejects CREATE -- treat as success
    if (err.message.includes("does not allow 'CREATE'")) {
      apiCache.delete("apps:list");
      apiCache.deleteByPrefix(`apps:versions:${appId}:`);
      apiCache.deleteByPrefix(`apps:review-submissions:${appId}:`);
      res.json({ success: true, versionId, alreadySubmitted: true });
      return;
    }
    console.error(`Failed to submit version ${versionId} for review:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;

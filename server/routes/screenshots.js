import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";
import { apiCache } from "../lib/cache.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

function resolveAccount(accountId) {
  const accounts = getAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("Account not found");
  return account;
}

function cacheKey(locId, accountId) {
  return `screenshots:sets:${locId}:${accountId || "default"}`;
}

// ── List screenshot sets + screenshots for a localization ──────────────────

router.get("/:appId/versions/:versionId/localizations/:locId/screenshot-sets", async (req, res) => {
  const { locId } = req.params;
  const { accountId } = req.query;

  const key = cacheKey(locId, accountId);
  const cached = apiCache.get(key);
  if (cached) return res.json(cached);

  try {
    const account = resolveAccount(accountId);

    const setsData = await ascFetch(
      account,
      `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?include=appScreenshots&fields[appScreenshots]=fileName,fileSize,sourceFileChecksum,assetDeliveryState,imageAsset&limit=50`
    );

    // Index included screenshots by ID
    const screenshotsById = {};
    if (setsData.included) {
      for (const item of setsData.included) {
        if (item.type !== "appScreenshots") continue;
        screenshotsById[item.id] = {
          id: item.id,
          fileName: item.attributes.fileName,
          fileSize: item.attributes.fileSize,
          sourceFileChecksum: item.attributes.sourceFileChecksum,
          imageAsset: item.attributes.imageAsset,
          assetDeliveryState: item.attributes.assetDeliveryState,
        };
      }
    }

    const sets = (setsData.data || []).map((s) => {
      const refs = s.relationships?.appScreenshots?.data || [];
      const screenshots = refs
        .map((ref) => screenshotsById[ref.id])
        .filter(Boolean);

      return {
        id: s.id,
        displayType: s.attributes.screenshotDisplayType,
        screenshots,
      };
    });

    apiCache.set(key, sets);
    res.json(sets);
  } catch (err) {
    console.error(`Failed to fetch screenshot sets for localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Create a screenshot set ────────────────────────────────────────────────

router.post("/:appId/versions/:versionId/localizations/:locId/screenshot-sets", async (req, res) => {
  const { locId } = req.params;
  const { accountId, displayType } = req.body;

  if (!accountId || !displayType) {
    return res.status(400).json({ error: "accountId and displayType are required" });
  }

  try {
    const account = resolveAccount(accountId);

    const data = await ascFetch(account, "/v1/appScreenshotSets", {
      method: "POST",
      body: {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: locId },
            },
          },
        },
      },
    });

    apiCache.delete(cacheKey(locId, accountId));

    res.json({
      id: data.data.id,
      displayType: data.data.attributes.screenshotDisplayType,
      screenshots: [],
    });
  } catch (err) {
    console.error(`Failed to create screenshot set for localization ${locId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Delete screenshot set ──────────────────────────────────────────────────

router.delete("/screenshot-sets/:setId", async (req, res) => {
  const { setId } = req.params;
  const { accountId, locId } = req.query;

  try {
    const account = resolveAccount(accountId);
    await ascFetch(account, `/v1/appScreenshotSets/${setId}`, { method: "DELETE" });
    if (locId) apiCache.delete(cacheKey(locId, accountId));
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete screenshot set ${setId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Upload a screenshot (3-step: reserve -> upload chunks -> commit) ───────

router.post("/screenshot-sets/:setId/screenshots/upload", upload.single("file"), async (req, res) => {
  const { setId } = req.params;
  const { accountId, locId } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const account = resolveAccount(accountId);
    const buffer = req.file.buffer;
    const checksum = crypto.createHash("md5").update(buffer).digest("base64");

    // Step 1: Reserve
    const reserveData = await ascFetch(account, "/v1/appScreenshots", {
      method: "POST",
      body: {
        data: {
          type: "appScreenshots",
          attributes: {
            fileName: req.file.originalname,
            fileSize: buffer.length,
            sourceFileChecksum: checksum,
          },
          relationships: {
            appScreenshotSet: {
              data: { type: "appScreenshotSets", id: setId },
            },
          },
        },
      },
    });

    const screenshotId = reserveData.data.id;
    const uploadOps = reserveData.data.attributes.uploadOperations || [];

    // Step 2: Upload chunks to CDN
    for (const op of uploadOps) {
      const chunk = buffer.slice(op.offset, op.offset + op.length);
      const headers = {};
      for (const h of op.requestHeaders) {
        headers[h.name] = h.value;
      }

      const cdnRes = await fetch(op.url, {
        method: op.method,
        headers,
        body: chunk,
      });

      if (!cdnRes.ok) {
        throw new Error(`CDN upload failed: ${cdnRes.status} ${cdnRes.statusText}`);
      }
    }

    // Step 3: Commit
    const commitData = await ascFetch(account, `/v1/appScreenshots/${screenshotId}`, {
      method: "PATCH",
      body: {
        data: {
          type: "appScreenshots",
          id: screenshotId,
          attributes: {
            uploaded: true,
            sourceFileChecksum: checksum,
          },
        },
      },
    });

    if (locId) apiCache.delete(cacheKey(locId, accountId));

    res.json({
      id: commitData.data.id,
      fileName: commitData.data.attributes.fileName,
      fileSize: commitData.data.attributes.fileSize,
      sourceFileChecksum: commitData.data.attributes.sourceFileChecksum,
      imageAsset: commitData.data.attributes.imageAsset,
      assetDeliveryState: commitData.data.attributes.assetDeliveryState,
    });
  } catch (err) {
    console.error(`Failed to upload screenshot to set ${setId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Delete a single screenshot ─────────────────────────────────────────────

router.delete("/screenshots/:screenshotId", async (req, res) => {
  const { screenshotId } = req.params;
  const { accountId, locId } = req.query;

  try {
    const account = resolveAccount(accountId);
    await ascFetch(account, `/v1/appScreenshots/${screenshotId}`, { method: "DELETE" });
    if (locId) apiCache.delete(cacheKey(locId, accountId));
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete screenshot ${screenshotId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Reorder screenshots within a set ───────────────────────────────────────

router.patch("/screenshot-sets/:setId/screenshots/reorder", async (req, res) => {
  const { setId } = req.params;
  const { accountId, locId, screenshotIds } = req.body;

  if (!accountId || !Array.isArray(screenshotIds)) {
    return res.status(400).json({ error: "accountId and screenshotIds array are required" });
  }

  try {
    const account = resolveAccount(accountId);

    await ascFetch(account, `/v1/appScreenshotSets/${setId}/relationships/appScreenshots`, {
      method: "PATCH",
      body: {
        data: screenshotIds.map((id) => ({ type: "appScreenshots", id })),
      },
    });

    if (locId) apiCache.delete(cacheKey(locId, accountId));
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to reorder screenshots in set ${setId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;

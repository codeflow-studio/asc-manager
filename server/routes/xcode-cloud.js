import { Router } from "express";
import { getAccounts } from "../lib/account-store.js";
import { ascFetch } from "../lib/asc-client.js";
import { apiCache } from "../lib/cache.js";

const router = Router();

const CI_PRODUCT_TTL = 60 * 60 * 1000; // 1 hour

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

async function resolveCiProductId(account, appId) {
  const cacheKey = `ci:product:${appId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const data = await ascFetch(account, `/v1/apps/${appId}/ciProduct`);
    const ciProductId = data.data?.id || null;
    apiCache.set(cacheKey, ciProductId, CI_PRODUCT_TTL);
    return ciProductId;
  } catch (err) {
    // Treat any error (404, 403 missing CI permissions, etc.) as "not configured"
    console.warn(`Could not resolve ciProduct for app ${appId}:`, err.message);
    apiCache.set(cacheKey, null, CI_PRODUCT_TTL);
    return null;
  }
}

function normalizeBuildRun(item) {
  const a = item.attributes || {};
  return {
    id: item.id,
    number: a.number,
    createdDate: a.createdDate,
    startedDate: a.startedDate,
    finishedDate: a.finishedDate,
    executionProgress: a.executionProgress,
    completionStatus: a.completionStatus,
    sourceCommit: a.sourceCommit || null,
    sourceBranchOrTag: a.sourceBranchOrTag || null,
    destinationBranch: a.destinationBranch || null,
  };
}

function normalizeWorkflow(item) {
  const a = item.attributes || {};
  return {
    id: item.id,
    name: a.name,
    description: a.description || "",
    branchStartCondition: a.branchStartCondition || null,
    pullRequestStartCondition: a.pullRequestStartCondition || null,
    scheduledStartCondition: a.scheduledStartCondition || null,
    actions: a.actions || [],
    isEnabled: a.isEnabled ?? true,
    lastModifiedDate: a.lastModifiedDate,
  };
}

// ── Build Runs ──────────────────────────────────────────────────────────────

router.get("/:appId/xcode-cloud/builds", async (req, res) => {
  const { appId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `ci:builds:${appId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const ciProductId = await resolveCiProductId(account, appId);
    if (!ciProductId) {
      const result = { configured: false, data: [] };
      apiCache.set(cacheKey, result);
      return res.json(result);
    }

    const data = await ascFetch(
      account,
      `/v1/ciProducts/${ciProductId}/buildRuns?limit=25&sort=-number`
    );
    const result = {
      configured: true,
      data: (data.data || []).map(normalizeBuildRun),
    };
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch CI builds for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Workflows ───────────────────────────────────────────────────────────────

router.get("/:appId/xcode-cloud/workflows", async (req, res) => {
  const { appId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `ci:workflows:${appId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const ciProductId = await resolveCiProductId(account, appId);
    if (!ciProductId) {
      const result = { configured: false, data: [] };
      apiCache.set(cacheKey, result);
      return res.json(result);
    }

    const data = await ascFetch(
      account,
      `/v1/ciProducts/${ciProductId}/workflows`
    );
    const result = {
      configured: true,
      data: (data.data || []).map(normalizeWorkflow),
    };
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch CI workflows for app ${appId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Build Actions ────────────────────────────────────────────────────────────

router.get("/:appId/xcode-cloud/builds/:buildId/actions", async (req, res) => {
  const { buildId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `ci:actions:${buildId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(account, `/v1/ciBuildRuns/${buildId}/actions`);
    const result = (data.data || []).map((item) => {
      const a = item.attributes || {};
      return {
        id: item.id,
        name: a.name,
        actionType: a.actionType,
        completionStatus: a.completionStatus,
        executionProgress: a.executionProgress,
        startedDate: a.startedDate,
        finishedDate: a.finishedDate,
        issueCounts: a.issueCounts || {},
      };
    });
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch actions for build ${buildId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Action Logs ──────────────────────────────────────────────────────────────

const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB

router.get("/:appId/xcode-cloud/builds/:buildId/actions/:actionId/logs", async (req, res) => {
  const { actionId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    const data = await ascFetch(account, `/v1/ciBuildActions/${actionId}/artifacts`);
    const logArtifact = (data.data || []).find(
      (item) => (item.attributes?.fileType || "").toUpperCase() === "LOGS"
    );

    if (!logArtifact) {
      return res.json({ available: false });
    }

    const downloadUrl = logArtifact.attributes?.downloadUrl;
    if (!downloadUrl) {
      return res.json({ available: false });
    }

    const logRes = await fetch(downloadUrl);
    if (!logRes.ok) {
      return res.json({ available: false });
    }

    let content = await logRes.text();
    if (content.length > MAX_LOG_SIZE) {
      content = content.slice(0, MAX_LOG_SIZE) + "\n\n[log truncated at 2MB]";
    }

    res.json({ available: true, content });
  } catch (err) {
    console.error(`Failed to fetch logs for action ${actionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Action Issues ────────────────────────────────────────────────────────────

router.get("/:appId/xcode-cloud/builds/:buildId/actions/:actionId/issues", async (req, res) => {
  const { actionId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  const cacheKey = `ci:issues:${actionId}:${account.id}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await ascFetch(account, `/v1/ciBuildActions/${actionId}/issues`);
    const result = (data.data || []).map((item) => {
      const a = item.attributes || {};
      return {
        category: a.category,
        message: a.message,
        fileSource: a.fileSource || null,
      };
    });
    apiCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch issues for action ${actionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;

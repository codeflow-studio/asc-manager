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
    startReason: a.startReason || null,
    isPullRequestBuild: a.isPullRequestBuild ?? false,
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
        platform: a.platform || null,
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

// Display name mapping for common log bundle entries
const LOG_STEP_NAMES = {
  "ci_post_clone.log": "Run ci_post_clone.sh script",
  "ci_pre_xcodebuild.log": "Run ci_pre_xcodebuild.sh script",
  "ci_post_xcodebuild.log": "Run ci_post_xcodebuild.sh script",
  "xcodebuild-archive.log": "Run xcodebuild archive",
  "resolve_package_dependencies.log": "Resolve package dependencies",
  "development-export-archive-logs": "Export archive for development distribution",
  "ad-hoc-export-archive-logs": "Export archive for ad-hoc distribution",
  "app-store-export-archive-logs": "Export archive for app-store distribution",
};

function getStepDisplayName(fileName) {
  return LOG_STEP_NAMES[fileName] || fileName.replace(/[-_]/g, " ").replace(/\.log$/, "");
}

// Cache downloaded log bundles in memory to avoid re-downloading for individual file requests
const logBundleCache = new Map();
const LOG_BUNDLE_TTL = 10 * 60 * 1000; // 10 minutes

async function getLogBundle(account, actionId) {
  const cached = logBundleCache.get(actionId);
  if (cached && Date.now() < cached.expiresAt) return cached.zip;

  const data = await ascFetch(account, `/v1/ciBuildActions/${actionId}/artifacts`);
  const logArtifact = (data.data || []).find(
    (item) => (item.attributes?.fileType || "").toUpperCase() === "LOG_BUNDLE"
  );
  if (!logArtifact?.attributes?.downloadUrl) return null;

  const logRes = await fetch(logArtifact.attributes.downloadUrl);
  if (!logRes.ok) return null;

  const buffer = Buffer.from(await logRes.arrayBuffer());
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  logBundleCache.set(actionId, { zip, expiresAt: Date.now() + LOG_BUNDLE_TTL });
  return zip;
}

const ISO_TS_RE = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\t/;

// Authoritative status patterns — last match in the log wins.
// These are specific markers emitted by xcodebuild, shell, and fastlane at the
// conclusion of a step. Broad patterns like /\bfailed\b/ are intentionally avoided
// because diagnostic/informational lines frequently contain "failed" or "error"
// without indicating an actual step failure.
const STATUS_PATTERNS = [
  { re: /\*\*\s*(BUILD|ARCHIVE|EXPORT)\s+SUCCEEDED\s*\*\*/, failed: false },
  { re: /\*\*\s*(BUILD|ARCHIVE|EXPORT)\s+FAILED\s*\*\*/, failed: true },
  { re: /exited with code\s+0\b/i, failed: false },
  { re: /exited with code\s+[1-9]\d*/i, failed: true },
  { re: /fastlane finished with errors/i, failed: true },
];

function extractLogMeta(entry) {
  if (!entry || entry.isDirectory) return { duration: null, status: "success" };
  const content = entry.getData().toString("utf8");
  const lines = content.split("\n");

  let first = null;
  let last = null;
  let failed = false;
  for (const line of lines) {
    const m = line.match(ISO_TS_RE);
    if (m) {
      if (!first) first = m[1];
      last = m[1];
    }
    const stripped = line.replace(ISO_TS_RE, "");
    for (const p of STATUS_PATTERNS) {
      if (p.re.test(stripped)) {
        failed = p.failed;
        break;
      }
    }
  }

  let duration = null;
  if (first && last) {
    const diffSec = Math.max(0, Math.round((new Date(last) - new Date(first)) / 1000));
    duration = diffSec < 60 ? `${diffSec}s` : `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
  }

  return { duration, status: failed ? "failed" : "success" };
}

function parseLogSteps(zip) {
  const entries = zip.getEntries();
  // Find the root prefix (first directory level)
  const rootPrefix = entries[0]?.entryName.split("/")[0] + "/";

  const steps = [];
  const seen = new Set();

  for (const entry of entries) {
    // Strip the root bundle directory prefix
    const relative = entry.entryName.startsWith(rootPrefix)
      ? entry.entryName.slice(rootPrefix.length)
      : entry.entryName;
    if (!relative) continue;

    const parts = relative.split("/");
    const topLevel = parts[0];
    if (seen.has(topLevel)) continue;
    seen.add(topLevel);

    if (entry.isDirectory || parts.length > 1) {
      // Directory-based step: find the main log file inside
      const dirPrefix = rootPrefix + topLevel + "/";
      const subEntries = entries.filter(
        (e) => !e.isDirectory && e.entryName.startsWith(dirPrefix)
      );
      const mainLog = subEntries.find((e) => {
        const name = e.entryName.split("/").pop();
        return name === "xcodebuild-export-archive.log" || name.endsWith(".log");
      });
      steps.push({
        name: getStepDisplayName(topLevel),
        fileName: topLevel,
        ...extractLogMeta(mainLog),
        mainFile: mainLog ? mainLog.entryName : null,
      });
    } else {
      // Single log file step
      steps.push({
        name: getStepDisplayName(topLevel),
        fileName: topLevel,
        ...extractLogMeta(entry),
        mainFile: entry.entryName,
      });
    }
  }
  return steps;
}

// Get log structure (steps list)
router.get("/:appId/xcode-cloud/builds/:buildId/actions/:actionId/logs", async (req, res) => {
  const { actionId } = req.params;
  const account = resolveAccount(req, res);
  if (!account) return;

  try {
    const zip = await getLogBundle(account, actionId);
    if (!zip) return res.json({ available: false });

    const steps = parseLogSteps(zip);
    res.json({ available: true, steps });
  } catch (err) {
    console.error(`Failed to fetch logs for action ${actionId}:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// Get content for a specific log file
router.get("/:appId/xcode-cloud/builds/:buildId/actions/:actionId/logs/file", async (req, res) => {
  const { actionId } = req.params;
  const { path: filePath } = req.query;
  const account = resolveAccount(req, res);
  if (!account) return;

  if (!filePath) return res.status(400).json({ error: "Missing path parameter" });

  try {
    const zip = await getLogBundle(account, actionId);
    if (!zip) return res.json({ error: "Log bundle not available" });

    const entry = zip.getEntries().find((e) => e.entryName === filePath);
    if (!entry) return res.status(404).json({ error: "File not found in log bundle" });

    let content = entry.getData().toString("utf8");
    if (content.length > MAX_LOG_SIZE) {
      content = content.slice(0, MAX_LOG_SIZE) + "\n\n[log truncated at 2MB]";
    }
    res.json({ content });
  } catch (err) {
    console.error(`Failed to fetch log file for action ${actionId}:`, err.message);
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
    let allItems = [];
    let url = `/v1/ciBuildActions/${actionId}/issues?limit=200`;
    while (url) {
      const data = await ascFetch(account, url);
      allItems = allItems.concat(data.data || []);
      // Follow pagination if there are more pages
      const next = data.links?.next;
      url = next ? next.replace("https://api.appstoreconnect.apple.com", "") : null;
    }
    const result = allItems.map((item) => {
      const a = item.attributes || {};
      return {
        category: a.category,
        issueType: a.issueType || null,
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

import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { fetchApps, fetchAccounts, createAccount, fetchVersions } from "../api/index.js";
import TopBar from "./TopBar.jsx";
import AppGrid from "./AppGrid.jsx";
import AddAccountModal from "./AddAccountModal.jsx";
import AppDetailPage from "./AppDetailPage.jsx";
import VersionDetailPage from "./VersionDetailPage.jsx";

function getAppIdFromPath() {
  const match = window.location.pathname.match(/^\/app\/(\d+)$/);
  return match ? match[1] : null;
}

function getVersionIdFromPath() {
  const match = window.location.pathname.match(/^\/app\/([^/]+)\/version\/([^/]+)$/);
  return match ? { appId: match[1], versionId: match[2] } : null;
}

export default function AppStoreManager() {
  const isMobile = useIsMobile();

  const [accounts, setAccounts] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterAccount, setFilterAccount] = useState("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const selectApp = useCallback((app) => {
    setSelectedApp(app);
    setSelectedVersion(null);
    if (app) {
      window.history.pushState({ appId: app.id }, "", `/app/${app.id}`);
    } else {
      window.history.pushState(null, "", "/");
    }
  }, []);

  const selectVersion = useCallback((version, app) => {
    setSelectedVersion({ version, app });
    window.history.pushState(
      { appId: app.id, versionId: version.id },
      "",
      `/app/${app.id}/version/${version.id}`
    );
  }, []);

  const loadData = useCallback(async (fresh = false) => {
    try {
      setError(null);
      const [accts, appsList] = await Promise.all([fetchAccounts(), fetchApps({ fresh })]);
      setAccounts(accts);
      setApps(appsList);

      const versionPath = getVersionIdFromPath();
      if (versionPath) {
        const appMatch = appsList.find((a) => a.id === versionPath.appId);
        if (appMatch) {
          setSelectedApp(appMatch);
          try {
            const versions = await fetchVersions(appMatch.id, appMatch.accountId);
            const vMatch = versions.find((v) => v.id === versionPath.versionId);
            if (vMatch) setSelectedVersion({ version: vMatch, app: appMatch });
          } catch {
            // Version deep-link failed, stay on app detail
          }
        }
      } else {
        const pendingAppId = getAppIdFromPath();
        if (pendingAppId) {
          const match = appsList.find((a) => a.id === pendingAppId);
          if (match) setSelectedApp(match);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function onPopState() {
      const versionPath = getVersionIdFromPath();
      if (versionPath) {
        const appMatch = apps.find((a) => a.id === versionPath.appId);
        if (appMatch) {
          setSelectedApp(appMatch);
          fetchVersions(appMatch.id, appMatch.accountId)
            .then((versions) => {
              const vMatch = versions.find((v) => v.id === versionPath.versionId);
              setSelectedVersion(vMatch ? { version: vMatch, app: appMatch } : null);
            })
            .catch(() => setSelectedVersion(null));
        } else {
          setSelectedApp(null);
          setSelectedVersion(null);
        }
        return;
      }

      setSelectedVersion(null);
      const appId = getAppIdFromPath();
      if (appId) {
        const match = apps.find((a) => a.id === appId);
        setSelectedApp(match || null);
      } else {
        setSelectedApp(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [apps]);

  const filtered = apps.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.bundleId.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterAccount !== "ALL" && a.account !== filterAccount) return false;
    return true;
  });

  const uniqueStatuses = [...new Set(apps.map((a) => a.status))];

  if (selectedVersion) {
    return (
      <div className="font-sans bg-dark-bg text-dark-text min-h-screen antialiased">
        <VersionDetailPage
          app={selectedVersion.app}
          version={selectedVersion.version}
          accounts={accounts}
          isMobile={isMobile}
        />
      </div>
    );
  }

  if (selectedApp) {
    return (
      <div className="font-sans bg-dark-bg text-dark-text min-h-screen antialiased">
        <AppDetailPage
          app={selectedApp}
          accounts={accounts}
          isMobile={isMobile}
          onSelectVersion={(version) => selectVersion(version, selectedApp)}
        />
      </div>
    );
  }

  return (
    <div className="font-sans bg-dark-bg text-dark-text min-h-screen antialiased">
      <TopBar
        isMobile={isMobile}
        search={search}
        setSearch={setSearch}
        syncing={syncing}
        onSync={() => { setSyncing(true); loadData(true); }}
        onShowAdd={() => setShowAdd(true)}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        uniqueStatuses={uniqueStatuses}
      />

      <div className={isMobile ? "px-3 pt-2 pb-8" : "px-7 pt-2 pb-12"}>
        {loading && (
          <div className="text-center px-5 py-20 text-dark-dim">
            <div className="text-[28px] mb-3 inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>
              {"\u21bb"}
            </div>
            <div className="text-sm font-semibold">Loading apps from App Store Connect...</div>
          </div>
        )}

        {error && !loading && (
          <div className="text-center px-5 py-16 text-danger">
            <div className="text-sm font-semibold mb-2">Failed to load data</div>
            <div className="text-xs text-dark-dim max-w-[400px] mx-auto mb-4">{error}</div>
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="px-[18px] py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <AppGrid
            filtered={filtered}
            accounts={accounts}
            onSelectApp={selectApp}
            isMobile={isMobile}
          />
        )}
      </div>

      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          onAdd={async (a) => {
            try {
              await createAccount({
                name: a.name,
                issuerId: a.issuer,
                keyId: a.keyId,
                privateKey: a.pk,
                color: a.color,
              });
              loadData();
            } catch (err) {
              console.error("Failed to add account:", err);
              setError(err.message);
            }
          }}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

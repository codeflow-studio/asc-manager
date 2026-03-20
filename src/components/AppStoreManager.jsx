import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { fetchApps, fetchAccounts } from "../api/index.js";
import TopBar from "./TopBar.jsx";
import AppGrid from "./AppGrid.jsx";
import AddAccountModal from "./AddAccountModal.jsx";
import AppDetailModal from "./AppDetailModal.jsx";

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
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [accts, appsList] = await Promise.all([fetchAccounts(), fetchApps()]);
      setAccounts(accts);
      setApps(appsList);
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

  const filtered = apps.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.bundleId.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterAccount !== "ALL" && a.account !== filterAccount) return false;
    return true;
  });

  const uniqueStatuses = [...new Set(apps.map((a) => a.status))];

  return (
    <div className="font-sans bg-dark-bg text-dark-text min-h-screen antialiased">
      <TopBar
        isMobile={isMobile}
        search={search}
        setSearch={setSearch}
        syncing={syncing}
        onSync={() => { setSyncing(true); loadData(); }}
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
            onSelectApp={setSelectedApp}
            isMobile={isMobile}
          />
        )}
      </div>

      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          onAdd={(a) => setAccounts((prev) => [...prev, a])}
          isMobile={isMobile}
        />
      )}
      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          accounts={accounts}
          onClose={() => setSelectedApp(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

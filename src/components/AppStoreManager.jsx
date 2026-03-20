import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { fetchApps, fetchAccounts } from "../api/index.js";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import StatsGrid from "./StatsGrid.jsx";
import StatusPills from "./StatusPills.jsx";
import AppGrid from "./AppGrid.jsx";
import ApiGuide from "./ApiGuide.jsx";
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
  const [view, setView] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

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

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const closeSidebarOnMobile = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const filtered = apps.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.bundleId.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterAccount !== "ALL" && a.account !== filterAccount) return false;
    return true;
  });

  const stats = {
    total: apps.length,
    live: apps.filter((a) => ["READY_FOR_DISTRIBUTION", "READY_FOR_SALE"].includes(a.status)).length,
    review: apps.filter((a) => ["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(a.status)).length,
    prep: apps.filter((a) => a.status === "PREPARE_FOR_SUBMISSION").length,
  };

  const uniqueStatuses = [...new Set(apps.map((a) => a.status))];

  const navItems = [
    { key: "all", icon: "\u229e", label: "All Apps", count: stats.total, statusFilter: "ALL" },
    { key: "live", icon: "\u25cf", label: "Live", count: stats.live, statusFilter: "READY_FOR_DISTRIBUTION" },
    { key: "review", icon: "\u25ce", label: "In Review", count: stats.review, statusFilter: "WAITING_FOR_REVIEW" },
    { key: "prep", icon: "\u25cc", label: "In Progress", count: stats.prep, statusFilter: "PREPARE_FOR_SUBMISSION" },
  ];

  return (
    <div className="font-sans bg-dark-bg text-dark-text min-h-screen antialiased flex relative overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          style={{ animation: "asc-fadein 0.2s ease" }}
        />
      )}

      <Sidebar
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        view={view}
        setView={setView}
        filterAccount={filterAccount}
        setFilterAccount={setFilterAccount}
        setFilterStatus={setFilterStatus}
        accounts={accounts}
        apps={apps}
        navItems={navItems}
        closeSidebarOnMobile={closeSidebarOnMobile}
        onShowAdd={() => setShowAdd(true)}
      />

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          search={search}
          setSearch={setSearch}
          syncing={syncing}
          onSync={() => { setSyncing(true); loadData(); }}
          onShowAdd={() => setShowAdd(true)}
        />

        {/* Content */}
        <div className={`overflow-auto flex-1 ${isMobile ? "px-3 pt-4 pb-8" : "px-7 pt-[22px] pb-12"}`}>
          {loading && (
            <div className="text-center px-5 py-20 text-dark-dim">
              <div className="text-[28px] mb-3 inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>
                {"\u21bb"}
              </div>
              <div className="text-sm font-semibold">Loading apps from App Store Connect...</div>
            </div>
          )}

          {error && !loading && (
            <div className="text-center px-5 py-[60px] text-danger">
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
            <>
              <StatsGrid stats={stats} isMobile={isMobile} />
              <StatusPills
                uniqueStatuses={uniqueStatuses}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                setView={setView}
                isMobile={isMobile}
              />
              <AppGrid
                filtered={filtered}
                accounts={accounts}
                onSelectApp={setSelectedApp}
                isMobile={isMobile}
              />
              <ApiGuide isMobile={isMobile} />
            </>
          )}
        </div>
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

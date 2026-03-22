import { useState, useEffect, useCallback } from "react";
import {
  fetchIAPPrices, setIAPPrices, fetchIAPPricePoints,
  fetchSubscriptionPrices, setSubscriptionPrices, fetchSubscriptionPricePoints,
} from "../api/index.js";
import { TERRITORIES, TERRITORY_MAP } from "../lib/territories.js";

const inputCls = "w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text outline-none font-sans text-[13px] transition-colors";

export default function PricingPanel({ productType, productId, groupId, appId, accountId }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pricingData, setPricingData] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [search, setSearch] = useState("");

  // Cache of loaded price points per territory
  const [pricePointsCache, setPricePointsCache] = useState(new Map());
  const [loadingTerritories, setLoadingTerritories] = useState(new Set());

  const isIAP = productType === "iap";

  // Lazy-load current prices on first expand
  useEffect(() => {
    if (!expanded || pricingData) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchFn = isIAP
      ? fetchIAPPrices(appId, productId, accountId)
      : fetchSubscriptionPrices(appId, groupId, productId, accountId);

    fetchFn
      .then((data) => { if (!cancelled) setPricingData(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [expanded, pricingData, isIAP, appId, productId, groupId, accountId]);

  // Load price points for a specific territory on demand
  const loadPricePoints = useCallback(async (territory) => {
    if (pricePointsCache.has(territory)) return;
    if (loadingTerritories.has(territory)) return;

    setLoadingTerritories((prev) => new Set(prev).add(territory));

    try {
      const result = isIAP
        ? await fetchIAPPricePoints(appId, productId, territory, accountId)
        : await fetchSubscriptionPricePoints(appId, groupId, productId, territory, accountId);

      setPricePointsCache((prev) => {
        const next = new Map(prev);
        next.set(territory, result.pricePoints || []);
        return next;
      });
    } catch {
      // Silently fail — dropdown will show current price only
    } finally {
      setLoadingTerritories((prev) => {
        const next = new Set(prev);
        next.delete(territory);
        return next;
      });
    }
  }, [isIAP, appId, productId, groupId, accountId, pricePointsCache, loadingTerritories]);

  function handlePriceChange(territory, pricePointId) {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const currentEntry = pricingData?.currentPrices?.[territory];
      // If selecting back to original, remove from pending
      if (currentEntry?.pricePointId === pricePointId) {
        next.delete(territory);
      } else {
        next.set(territory, pricePointId);
      }
      return next;
    });
    setSaveResult(null);
  }

  async function handleApply() {
    if (pendingChanges.size === 0) return;
    setSaving(true);
    setSaveResult(null);

    try {
      if (isIAP) {
        // IAP: build complete manualPrices array (current + changes merged)
        const allPrices = TERRITORIES.map((t) => {
          const current = pricingData?.currentPrices?.[t.code];
          return {
            territory: t.code,
            pricePointId: pendingChanges.has(t.code)
              ? pendingChanges.get(t.code)
              : current?.pricePointId,
          };
        }).filter((p) => p.pricePointId);

        await setIAPPrices(appId, productId, {
          accountId,
          baseTerritory: pricingData?.baseTerritory || "USA",
          manualPrices: allPrices,
        });

        setSaveResult({ saved: pendingChanges.size, errors: [] });
      } else {
        // Subscription: only send changed territories
        const prices = Array.from(pendingChanges.entries()).map(
          ([territory, pricePointId]) => ({ territory, pricePointId })
        );

        const result = await setSubscriptionPrices(appId, groupId, productId, {
          accountId,
          prices,
        });

        setSaveResult(result);

        // Keep failed territories in pendingChanges for retry
        if (result.errors?.length > 0) {
          const failedTerritories = new Set(
            result.errors.map((e) => e.territory)
          );
          setPendingChanges((prev) => {
            const next = new Map();
            for (const [k, v] of prev) {
              if (failedTerritories.has(k)) next.set(k, v);
            }
            return next;
          });
          // Re-fetch to update saved prices
          setPricingData(null);
          setPricePointsCache(new Map());
          return;
        }
      }

      // On full success: re-fetch and clear pending
      setPendingChanges(new Map());
      setPricingData(null);
      setPricePointsCache(new Map());
    } catch (err) {
      setSaveResult({ saved: 0, errors: [{ territory: "all", message: err.message }] });
    } finally {
      setSaving(false);
    }
  }

  // Build territory list from TERRITORY_MAP + currentPrices
  const territories = TERRITORIES.map((t) => {
    const current = pricingData?.currentPrices?.[t.code];
    return {
      territory: t.code,
      currency: t.currency,
      currentPricePointId: current?.pricePointId || null,
      currentCustomerPrice: current?.customerPrice || null,
    };
  });

  // Filter territories by search
  const filteredTerritories = territories.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const meta = TERRITORY_MAP.get(t.territory);
    return (
      t.territory.toLowerCase().includes(q) ||
      t.currency.toLowerCase().includes(q) ||
      (meta?.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="border-t border-dark-border pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-0 font-sans mb-3"
      >
        <span
          className="text-dark-dim text-xs transition-transform"
          style={{ display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          {"\u25BE"}
        </span>
        <span className="text-[12px] font-bold text-dark-text uppercase tracking-wide">
          Pricing
        </span>
        {pendingChanges.size > 0 && (
          <span className="text-[11px] text-white font-semibold bg-accent px-1.5 py-0.5 rounded">
            {pendingChanges.size} pending
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-3 text-dark-dim">
              <div className="text-sm inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
            </div>
          )}

          {error && (
            <div className="text-[11px] text-danger font-semibold">{error}</div>
          )}

          {!loading && !error && pricingData && (
            <>
              {/* Search filter */}
              <input
                className={inputCls}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter territories..."
              />

              {/* Territory table */}
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-dark-border">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-dark-surface text-dark-dim text-left sticky top-0">
                      <th className="px-3 py-2 font-semibold">Territory</th>
                      <th className="px-3 py-2 font-semibold">Currency</th>
                      <th className="px-3 py-2 font-semibold">Current</th>
                      <th className="px-3 py-2 font-semibold">Price Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTerritories.map((t) => {
                      const isPending = pendingChanges.has(t.territory);
                      const selectedValue = isPending
                        ? pendingChanges.get(t.territory)
                        : t.currentPricePointId || "";
                      const cachedPoints = pricePointsCache.get(t.territory);
                      const isLoadingPoints = loadingTerritories.has(t.territory);

                      return (
                        <tr
                          key={t.territory}
                          className={`border-t border-dark-border hover:bg-dark-surface/50 ${
                            isPending ? "border-l-2 border-l-accent" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className="font-mono text-dark-text">{t.territory}</span>
                            <span className="text-dark-dim ml-1.5">
                              {TERRITORY_MAP.get(t.territory)?.name || ""}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-dark-dim">{t.currency}</td>
                          <td className="px-3 py-2 text-dark-text">
                            {t.currentCustomerPrice
                              ? `${t.currency} ${t.currentCustomerPrice}`
                              : "Not set"}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="bg-dark-surface border border-dark-border-light rounded px-2 py-1 text-dark-text text-[12px] outline-none font-sans max-w-[160px]"
                              value={selectedValue}
                              onFocus={() => loadPricePoints(t.territory)}
                              onChange={(e) =>
                                handlePriceChange(t.territory, e.target.value)
                              }
                            >
                              {isLoadingPoints && !cachedPoints ? (
                                <option value="">Loading...</option>
                              ) : cachedPoints ? (
                                <>
                                  <option value="">-- Select --</option>
                                  {cachedPoints.map((pp) => (
                                    <option key={pp.id} value={pp.id}>
                                      {t.currency} {pp.customerPrice}
                                    </option>
                                  ))}
                                </>
                              ) : (
                                <>
                                  {t.currentPricePointId ? (
                                    <option value={t.currentPricePointId}>
                                      {t.currency} {t.currentCustomerPrice}
                                    </option>
                                  ) : (
                                    <option value="">-- Select --</option>
                                  )}
                                </>
                              )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTerritories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-dark-dim">
                          No territories match your filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Apply button */}
              {pendingChanges.size > 0 && (
                <button
                  onClick={handleApply}
                  disabled={saving}
                  className={`w-full px-4 py-2.5 rounded-lg text-[13px] font-semibold bg-accent text-white border-none font-sans transition-all ${
                    saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:brightness-110"
                  }`}
                >
                  {saving
                    ? "Applying..."
                    : `Apply ${pendingChanges.size} price change${pendingChanges.size !== 1 ? "s" : ""}`}
                </button>
              )}

              {/* Save result */}
              {saveResult && (
                <div className={`text-[12px] font-medium ${saveResult.errors?.length > 0 ? "text-danger" : "text-green-400"}`}>
                  {saveResult.errors?.length > 0 ? (
                    <>
                      <div>Saved {saveResult.saved} of {saveResult.saved + saveResult.errors.length} territories</div>
                      {saveResult.errors.map((e, i) => (
                        <div key={i} className="text-[11px] mt-0.5">{e.territory}: {e.message}</div>
                      ))}
                    </>
                  ) : (
                    <div>Saved {saveResult.saved} price{saveResult.saved !== 1 ? "s" : ""} successfully</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

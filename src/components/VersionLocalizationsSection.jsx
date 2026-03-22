import { useState, useEffect, useMemo } from "react";
import {
  fetchVersionLocalizations,
  createVersionLocalization,
  updateVersionLocalization,
  deleteVersionLocalization,
} from "../api/index.js";
import { LOCALE_DISPLAY_NAMES } from "../constants/index.js";

const FIELDS = [
  { key: "promotionalText", label: "Promotional Text", type: "textarea", rows: 3, limit: 170 },
  { key: "description", label: "Description", type: "textarea", rows: 6, limit: 4000 },
  { key: "whatsNew", label: "What's New in This Version", type: "textarea", rows: 4, limit: 4000 },
  { key: "keywords", label: "Keywords", type: "input", limit: 100 },
  { key: "supportUrl", label: "Support URL", type: "input" },
  { key: "marketingUrl", label: "Marketing URL", type: "input" },
];

const labelCls = "text-[11px] uppercase tracking-wide font-semibold text-dark-dim mb-1.5 block";
const inputCls = "w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text outline-none font-sans text-[13px] transition-colors focus:border-accent";

function emptyFields() {
  return { promotionalText: "", description: "", whatsNew: "", keywords: "", supportUrl: "", marketingUrl: "" };
}

function fieldsFromLoc(loc) {
  return {
    promotionalText: loc.promotionalText || "",
    description: loc.description || "",
    whatsNew: loc.whatsNew || "",
    keywords: loc.keywords || "",
    supportUrl: loc.supportUrl || "",
    marketingUrl: loc.marketingUrl || "",
  };
}

function localeName(code) {
  return LOCALE_DISPLAY_NAMES[code] || code;
}

export default function VersionLocalizationsSection({ appId, versionId, accountId, isMobile }) {
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedLocId, setSelectedLocId] = useState(null);
  const [draftMap, setDraftMap] = useState({});

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [addingNewLocale, setAddingNewLocale] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState("");
  const [creatingLocale, setCreatingLocale] = useState(false);

  const selectedLoc = useMemo(
    () => locs.find((l) => l.id === selectedLocId) || null,
    [locs, selectedLocId]
  );

  const formFields = useMemo(() => {
    if (selectedLocId && draftMap[selectedLocId]) return draftMap[selectedLocId];
    if (selectedLoc) return fieldsFromLoc(selectedLoc);
    return emptyFields();
  }, [draftMap, selectedLocId, selectedLoc]);

  const selectedIndex = useMemo(
    () => locs.findIndex((l) => l.id === selectedLocId),
    [locs, selectedLocId]
  );

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < locs.length - 1;

  function goToPrev() {
    if (hasPrev) selectLocale(locs[selectedIndex - 1].id);
  }

  function goToNext() {
    if (hasNext) selectLocale(locs[selectedIndex + 1].id);
  }

  function updateField(key, value) {
    setDraftMap((prev) => ({
      ...prev,
      [selectedLocId]: {
        ...(prev[selectedLocId] || fieldsFromLoc(selectedLoc)),
        [key]: value,
      },
    }));
  }

  const anyDirty = useMemo(() => {
    for (const locId of Object.keys(draftMap)) {
      const loc = locs.find((l) => l.id === locId);
      if (!loc) continue;
      const stored = fieldsFromLoc(loc);
      const draft = draftMap[locId];
      if (FIELDS.some((f) => (draft[f.key] || "") !== (stored[f.key] || ""))) return true;
    }
    return false;
  }, [draftMap, locs]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchVersionLocalizations(appId, versionId, accountId)
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort((a, b) => {
          if (a.locale === "en-US") return -1;
          if (b.locale === "en-US") return 1;
          return 0;
        });
        setLocs(sorted);
        if (sorted.length > 0) {
          setSelectedLocId(sorted[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [appId, versionId, accountId]);

  function selectLocale(locId) {
    if (!locs.find((l) => l.id === locId)) return;
    setSelectedLocId(locId);
    setSaveError(null);
    setAddingNewLocale(false);
  }

  function handleDiscard() {
    setDraftMap({});
    setSaveError(null);
  }

  async function handleSave() {
    if (!anyDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dirtyEntries = Object.entries(draftMap).filter(([locId]) => {
        const loc = locs.find((l) => l.id === locId);
        if (!loc) return false;
        const stored = fieldsFromLoc(loc);
        return FIELDS.some((f) => (draftMap[locId][f.key] || "") !== (stored[f.key] || ""));
      });
      const results = await Promise.all(
        dirtyEntries.map(([locId, fields]) =>
          updateVersionLocalization(appId, versionId, locId, { accountId, ...fields })
        )
      );
      setLocs((prev) =>
        prev.map((l) => {
          const updated = results.find((r) => r.id === l.id);
          return updated || l;
        })
      );
      setDraftMap({});
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedLoc) return;
    const deletedId = selectedLoc.id;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteVersionLocalization(appId, versionId, deletedId, accountId);
      const remaining = locs.filter((l) => l.id !== deletedId);
      setLocs(remaining);
      setDraftMap((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      if (remaining.length > 0) {
        setSelectedLocId(remaining[0].id);
      } else {
        setSelectedLocId(null);
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleDropdownChange(e) {
    const value = e.target.value;
    if (value === "__add__") {
      setAddingNewLocale(true);
      setNewLocaleCode("");
    } else {
      selectLocale(value);
    }
  }

  async function handleCreateLocale() {
    const code = newLocaleCode.trim();
    if (!code) return;
    setCreatingLocale(true);
    setSaveError(null);
    try {
      const created = await createVersionLocalization(appId, versionId, {
        accountId,
        locale: code,
        ...emptyFields(),
      });
      setLocs((prev) => [...prev, created]);
      setSelectedLocId(created.id);
      setAddingNewLocale(false);
      setNewLocaleCode("");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setCreatingLocale(false);
    }
  }

  function cancelAddLocale() {
    setAddingNewLocale(false);
    setNewLocaleCode("");
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="text-[13px] font-bold text-dark-text uppercase tracking-wide mb-4">Localizable Information</div>
        <div className="text-center py-8 text-dark-dim">
          <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
          <div className="text-xs font-semibold mt-1">Loading localizations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <div className="text-[13px] font-bold text-dark-text uppercase tracking-wide mb-4">Localizable Information</div>
        <div className="text-center py-6">
          <div className="text-xs text-danger font-semibold mb-1">Failed to load localizations</div>
          <div className="text-[11px] text-dark-dim">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Localizable Information</div>
        <div className="flex items-center gap-2">
          {addingNewLocale ? (
            <div className="flex items-center gap-2">
              <input
                className="px-2.5 py-1.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text text-[12px] font-sans outline-none w-28 focus:border-accent"
                value={newLocaleCode}
                onChange={(e) => setNewLocaleCode(e.target.value)}
                placeholder="e.g. de-DE"
                onKeyDown={(e) => e.key === "Enter" && handleCreateLocale()}
                aria-label="New locale code"
              />
              <button
                onClick={handleCreateLocale}
                disabled={!newLocaleCode.trim() || creatingLocale}
                className="text-[11px] font-semibold text-white bg-accent px-3 py-1.5 rounded-lg border-none cursor-pointer font-sans disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {creatingLocale ? "Adding..." : "Add"}
              </button>
              <button
                onClick={cancelAddLocale}
                className="text-[11px] font-semibold text-dark-dim bg-transparent border-none cursor-pointer font-sans hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrev}
                disabled={!hasPrev}
                className="w-7 h-7 flex items-center justify-center bg-dark-surface border border-dark-border-light rounded-lg text-dark-text text-[13px] cursor-pointer font-sans disabled:opacity-30 disabled:cursor-default hover:enabled:bg-dark-hover transition-colors"
                aria-label="Previous locale"
              >
                {"\u2039"}
              </button>
              <select
                value={selectedLocId || ""}
                onChange={handleDropdownChange}
                className="px-3 py-1.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text text-[12px] font-sans outline-none cursor-pointer min-w-[180px]"
                aria-label="Select locale"
              >
                {locs.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {localeName(loc.locale)} ({loc.locale})
                  </option>
                ))}
                <option value="__add__">Add Locale...</option>
              </select>
              <button
                onClick={goToNext}
                disabled={!hasNext}
                className="w-7 h-7 flex items-center justify-center bg-dark-surface border border-dark-border-light rounded-lg text-dark-text text-[13px] cursor-pointer font-sans disabled:opacity-30 disabled:cursor-default hover:enabled:bg-dark-hover transition-colors"
                aria-label="Next locale"
              >
                {"\u203a"}
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="text-[11px] text-danger font-medium mb-3">{saveError}</div>
      )}

      {locs.length === 0 && !addingNewLocale ? (
        <div className="text-center py-6 text-dark-ghost">
          <div className="text-xs font-semibold">No localizations yet</div>
          <div className="text-[11px] text-dark-dim mt-1">Select "Add Locale..." from the dropdown to create one.</div>
        </div>
      ) : selectedLoc && (
        <>
          {/* Fields */}
          <div className="space-y-4">
            {FIELDS.map((f) => {
              const val = formFields[f.key] || "";
              const remaining = f.limit ? f.limit - val.length : null;
              const isUrlRow = f.key === "supportUrl";

              if (isUrlRow) {
                const marketingField = FIELDS.find((ff) => ff.key === "marketingUrl");
                const marketingVal = formFields.marketingUrl || "";
                return (
                  <div key="url-row" className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <div>
                      <label className={labelCls}>{f.label}</label>
                      <input
                        className={inputCls}
                        value={val}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        placeholder={f.label}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{marketingField.label}</label>
                      <input
                        className={inputCls}
                        value={marketingVal}
                        onChange={(e) => updateField("marketingUrl", e.target.value)}
                        placeholder={marketingField.label}
                      />
                    </div>
                  </div>
                );
              }

              if (f.key === "marketingUrl") return null;

              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] uppercase tracking-wide font-semibold text-dark-dim">{f.label}</label>
                    {remaining !== null && (
                      <span className={`text-[11px] font-medium ${remaining < 0 ? "text-danger" : "text-dark-dim"}`}>
                        {remaining.toLocaleString()} remaining
                      </span>
                    )}
                  </div>
                  {f.type === "textarea" ? (
                    <textarea
                      className={`${inputCls} resize-y`}
                      rows={f.rows}
                      maxLength={f.limit}
                      value={val}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      placeholder={f.label}
                    />
                  ) : (
                    <input
                      className={inputCls}
                      maxLength={f.limit}
                      value={val}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      placeholder={f.label}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className={`flex items-center mt-6 pt-4 border-t border-dark-border-light ${locs.length >= 2 ? "justify-between" : "justify-end"}`}>
            {locs.length >= 2 && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[12px] font-semibold text-danger bg-transparent border border-danger/30 px-4 py-2 rounded-lg cursor-pointer font-sans hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Locale"}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                disabled={!anyDirty}
                className="text-[12px] font-semibold text-dark-dim bg-dark-surface border border-dark-border-light px-4 py-2 rounded-lg cursor-pointer font-sans hover:text-dark-text transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={!anyDirty || saving}
                className="text-[12px] font-semibold text-white bg-accent px-4 py-2 rounded-lg border-none cursor-pointer font-sans disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

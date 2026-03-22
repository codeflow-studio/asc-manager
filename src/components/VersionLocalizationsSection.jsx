import { useState, useEffect } from "react";
import {
  fetchVersionLocalizations,
  createVersionLocalization,
  updateVersionLocalization,
  deleteVersionLocalization,
} from "../api/index.js";

const labelCls = "text-[11px] uppercase tracking-wide font-semibold text-dark-dim mb-1.5 block";
const inputCls = "w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text outline-none font-sans text-[13px] transition-colors";

const FIELDS = [
  { key: "description", label: "Description", type: "textarea", height: "h-[100px]" },
  { key: "whatsNew", label: "What's New", type: "textarea", height: "h-[80px]" },
  { key: "keywords", label: "Keywords", type: "input" },
  { key: "promotionalText", label: "Promotional Text", type: "textarea", height: "h-[60px]" },
  { key: "supportUrl", label: "Support URL", type: "input" },
  { key: "marketingUrl", label: "Marketing URL", type: "input" },
];

function emptyFields() {
  return { description: "", whatsNew: "", keywords: "", promotionalText: "", supportUrl: "", marketingUrl: "" };
}

export default function VersionLocalizationsSection({ appId, versionId, accountId, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const [locs, setLocs] = useState([]);
  const [locsLoading, setLocsLoading] = useState(false);
  const [locsError, setLocsError] = useState(null);

  const [editingLocId, setEditingLocId] = useState(null);
  const [editFields, setEditFields] = useState(emptyFields());
  const [savingLocId, setSavingLocId] = useState(null);
  const [deletingLocId, setDeletingLocId] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [newLocale, setNewLocale] = useState("");
  const [newFields, setNewFields] = useState(emptyFields());
  const [addingLoc, setAddingLoc] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLocsLoading(true);
    setLocsError(null);

    fetchVersionLocalizations(appId, versionId, accountId)
      .then((data) => { if (!cancelled) setLocs(data); })
      .catch((err) => { if (!cancelled) setLocsError(err.message); })
      .finally(() => { if (!cancelled) setLocsLoading(false); });

    return () => { cancelled = true; };
  }, [expanded, appId, versionId, accountId]);

  function startEdit(loc) {
    setEditingLocId(loc.id);
    setSaveError(null);
    setEditFields({
      description: loc.description || "",
      whatsNew: loc.whatsNew || "",
      keywords: loc.keywords || "",
      promotionalText: loc.promotionalText || "",
      supportUrl: loc.supportUrl || "",
      marketingUrl: loc.marketingUrl || "",
    });
  }

  function cancelEdit() {
    setEditingLocId(null);
    setSaveError(null);
  }

  async function handleSave(loc) {
    setSavingLocId(loc.id);
    setSaveError(null);
    try {
      const updated = await updateVersionLocalization(appId, versionId, loc.id, { accountId, ...editFields });
      setLocs((prev) => prev.map((l) => (l.id === loc.id ? updated : l)));
      setEditingLocId(null);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSavingLocId(null);
    }
  }

  async function handleDelete(loc) {
    setDeletingLocId(loc.id);
    setSaveError(null);
    try {
      await deleteVersionLocalization(appId, versionId, loc.id, accountId);
      setLocs((prev) => prev.filter((l) => l.id !== loc.id));
      if (editingLocId === loc.id) setEditingLocId(null);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setDeletingLocId(null);
    }
  }

  async function handleAdd() {
    if (!newLocale.trim()) return;
    setAddingLoc(true);
    setSaveError(null);
    try {
      const created = await createVersionLocalization(appId, versionId, {
        accountId,
        locale: newLocale.trim(),
        ...newFields,
      });
      setLocs((prev) => [...prev, created]);
      setNewLocale("");
      setNewFields(emptyFields());
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setAddingLoc(false);
    }
  }

  function renderFieldInputs(fields, setFields, prefix) {
    return (
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className={labelCls}>{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                className={`${inputCls} ${f.height} resize-y`}
                value={fields[f.key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.label}
              />
            ) : (
              <input
                className={inputCls}
                value={fields[f.key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.label}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-0 font-sans"
        >
          <span className="text-dark-dim text-xs transition-transform" style={{ display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
            {"\u25BE"}
          </span>
          <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Localizations</span>
          {expanded && !locsLoading && (
            <span className="text-[11px] text-dark-dim font-semibold bg-dark-hover px-1.5 py-0.5 rounded">{locs.length}</span>
          )}
        </button>
      </div>

      {expanded && (
        <>
          {locsLoading ? (
            <div className="text-center py-8 text-dark-dim">
              <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
              <div className="text-xs font-semibold mt-1">Loading localizations...</div>
            </div>
          ) : locsError ? (
            <div className="text-center py-6">
              <div className="text-xs text-danger font-semibold mb-1">Failed to load localizations</div>
              <div className="text-[11px] text-dark-dim">{locsError}</div>
            </div>
          ) : (
            <>
              {saveError && (
                <div className="text-[11px] text-danger font-medium mb-3">{saveError}</div>
              )}

              {locs.length === 0 ? (
                <div className="text-center py-6 text-dark-ghost">
                  <div className="text-xs font-semibold">No localizations yet</div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {locs.map((loc) => (
                    <div key={loc.id} className="bg-dark-surface rounded-[10px] px-4 py-3">
                      {editingLocId === loc.id ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-accent-light bg-accent-bg px-2 py-0.5 rounded">{loc.locale}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSave(loc)}
                                disabled={savingLocId === loc.id}
                                className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline disabled:opacity-50"
                              >
                                {savingLocId === loc.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-[11px] font-semibold text-dark-dim bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          {renderFieldInputs(editFields, setEditFields, "edit")}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-bold text-accent-light bg-accent-bg px-2 py-0.5 rounded">{loc.locale}</span>
                            </div>
                            {loc.description && (
                              <div className="text-[12px] text-dark-dim mt-1 truncate">{loc.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              onClick={() => startEdit(loc)}
                              className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(loc)}
                              disabled={deletingLocId === loc.id}
                              className="text-[11px] font-semibold text-dark-dim bg-transparent border-none cursor-pointer font-sans px-0 hover:text-danger disabled:opacity-50"
                            >
                              {deletingLocId === loc.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new locale */}
              <div className="mt-4 bg-dark-surface rounded-[10px] px-4 py-3">
                <div className="text-[11px] font-bold text-dark-text uppercase tracking-wide mb-3">Add Locale</div>
                <div className="mb-3">
                  <label className={labelCls}>Locale Code</label>
                  <input
                    className={inputCls}
                    value={newLocale}
                    onChange={(e) => setNewLocale(e.target.value)}
                    placeholder="e.g. en-US, ja, de"
                  />
                </div>
                {renderFieldInputs(newFields, setNewFields, "new")}
                <button
                  onClick={handleAdd}
                  disabled={!newLocale.trim() || addingLoc}
                  className="mt-3 text-[12px] font-semibold text-white bg-accent px-4 py-2 rounded-lg border-none cursor-pointer font-sans disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {addingLoc ? "Adding..." : "Add Localization"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

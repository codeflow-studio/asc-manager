import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchVersionLocalizations,
  fetchScreenshotSets,
  createScreenshotSet,
  deleteScreenshotSet,
  uploadScreenshot,
  deleteScreenshot,
  reorderScreenshots,
} from "../api/index.js";
import { SCREENSHOT_DISPLAY_TYPES, SCREENSHOT_MAX_COUNT } from "../constants/index.js";

const CATEGORIES = ["iPhone", "iPad", "Apple Watch"];

function getDisplayTypesByCategory(category) {
  return Object.entries(SCREENSHOT_DISPLAY_TYPES)
    .filter(([, v]) => v.category === category)
    .map(([key, v]) => ({ key, label: v.label }));
}

function screenshotUrl(imageAsset, width = 400) {
  if (!imageAsset?.templateUrl) return null;
  const height = Math.round(width * 2.16);
  return imageAsset.templateUrl
    .replace("{w}", String(width))
    .replace("{h}", String(height))
    .replace("{f}", "png");
}

export default function ScreenshotsSection({ appId, versionId, accountId, isMobile }) {
  const [expanded, setExpanded] = useState(false);

  // Localizations (reused for locale tabs)
  const [localizations, setLocalizations] = useState([]);
  const [locsLoading, setLocsLoading] = useState(false);
  const [locsError, setLocsError] = useState(null);

  const [selectedLocId, setSelectedLocId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("iPhone");

  // Screenshot sets for selected locale
  const [sets, setSets] = useState([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsError, setSetsError] = useState(null);

  // Per-operation states
  const [uploadingSetId, setUploadingSetId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creatingSetType, setCreatingSetType] = useState(null);
  const [error, setError] = useState(null);

  // Drag state
  const [dragSetId, setDragSetId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const fileInputRef = useRef(null);
  const uploadSetIdRef = useRef(null);

  // Load localizations when expanded
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLocsLoading(true);
    setLocsError(null);

    fetchVersionLocalizations(appId, versionId, accountId)
      .then((data) => {
        if (cancelled) return;
        setLocalizations(data);
        if (data.length > 0 && !selectedLocId) {
          const enUS = data.find((l) => l.locale.toLowerCase() === "en-us");
          setSelectedLocId(enUS ? enUS.id : data[0].id);
        }
      })
      .catch((err) => { if (!cancelled) setLocsError(err.message); })
      .finally(() => { if (!cancelled) setLocsLoading(false); });

    return () => { cancelled = true; };
  }, [expanded, appId, versionId, accountId]);

  // Load screenshot sets when locale changes
  useEffect(() => {
    if (!selectedLocId) return;
    let cancelled = false;
    setSetsLoading(true);
    setSetsError(null);

    fetchScreenshotSets(appId, versionId, selectedLocId, accountId)
      .then((data) => { if (!cancelled) setSets(data); })
      .catch((err) => { if (!cancelled) setSetsError(err.message); })
      .finally(() => { if (!cancelled) setSetsLoading(false); });

    return () => { cancelled = true; };
  }, [selectedLocId, appId, versionId, accountId]);

  const selectedLocale = localizations.find((l) => l.id === selectedLocId)?.locale;

  // Filter sets for current category
  const categoryTypes = getDisplayTypesByCategory(selectedCategory);
  const categoryTypeKeys = new Set(categoryTypes.map((t) => t.key));
  const filteredSets = sets.filter((s) => categoryTypeKeys.has(s.displayType));

  // Display types that don't have sets yet (for creating new ones)
  const existingTypes = new Set(sets.map((s) => s.displayType));
  const availableTypes = categoryTypes.filter((t) => !existingTypes.has(t.key));

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleCreateSet(displayType) {
    setCreatingSetType(displayType);
    setError(null);
    try {
      const newSet = await createScreenshotSet(appId, versionId, selectedLocId, { accountId, displayType });
      setSets((prev) => [...prev, newSet]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingSetType(null);
    }
  }

  function triggerUpload(setId) {
    uploadSetIdRef.current = setId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const setId = uploadSetIdRef.current;
    if (!setId) return;

    setUploadingSetId(setId);
    setError(null);
    try {
      const newScreenshot = await uploadScreenshot(setId, accountId, selectedLocId, file);
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, screenshots: [...s.screenshots, newScreenshot] }
            : s
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingSetId(null);
    }
  }

  async function handleDeleteScreenshot(setId, screenshotId) {
    setDeletingId(screenshotId);
    setError(null);
    try {
      await deleteScreenshot(screenshotId, accountId, selectedLocId);
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, screenshots: s.screenshots.filter((sc) => sc.id !== screenshotId) }
            : s
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteSet(setId) {
    setDeletingId(`set-${setId}`);
    setError(null);
    try {
      await deleteScreenshotSet(setId, accountId, selectedLocId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Drag-and-drop reorder ────────────────────────────────────────────────

  function handleDragStart(setId, index) {
    setDragSetId(setId);
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  const handleDrop = useCallback(async (setId) => {
    if (dragSetId !== setId || dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragSetId(null);
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const set = sets.find((s) => s.id === setId);
    if (!set) return;

    const newScreenshots = [...set.screenshots];
    const [moved] = newScreenshots.splice(dragIndex, 1);
    newScreenshots.splice(dragOverIndex, 0, moved);

    // Optimistic update
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, screenshots: newScreenshots } : s))
    );

    setDragSetId(null);
    setDragIndex(null);
    setDragOverIndex(null);

    try {
      await reorderScreenshots(setId, accountId, selectedLocId, newScreenshots.map((s) => s.id));
    } catch (err) {
      setError(err.message);
      // Revert on failure
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, screenshots: set.screenshots } : s))
      );
    }
  }, [dragSetId, dragIndex, dragOverIndex, sets, accountId, selectedLocId]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Collapsible header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-0 font-sans"
        >
          <span className="text-dark-dim text-xs transition-transform" style={{ display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
            {"\u25BE"}
          </span>
          <span className="text-[13px] font-bold text-dark-text uppercase tracking-wide">Previews & Screenshots</span>
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
          ) : localizations.length === 0 ? (
            <div className="text-center py-6 text-dark-ghost">
              <div className="text-xs font-semibold">No localizations available</div>
              <div className="text-[11px] mt-1">Add a localization first to manage screenshots</div>
            </div>
          ) : (
            <>
              {/* Locale tabs */}
              <div className="flex items-center gap-1 mb-3 flex-wrap">
                {localizations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocId(loc.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md border-none cursor-pointer font-sans transition-colors ${
                      selectedLocId === loc.id
                        ? "bg-accent text-white"
                        : "bg-dark-surface text-dark-dim hover:text-dark-text"
                    }`}
                  >
                    {loc.locale}
                  </button>
                ))}
              </div>

              {/* Device category tabs */}
              <div className="flex items-center gap-1 mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border-none cursor-pointer font-sans transition-colors ${
                      selectedCategory === cat
                        ? "bg-dark-hover text-dark-text"
                        : "bg-transparent text-dark-dim hover:text-dark-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {error && (
                <div className="text-[11px] text-danger font-medium mb-3">{error}</div>
              )}

              {setsLoading ? (
                <div className="text-center py-8 text-dark-dim">
                  <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
                  <div className="text-xs font-semibold mt-1">Loading screenshots...</div>
                </div>
              ) : setsError ? (
                <div className="text-center py-6">
                  <div className="text-xs text-danger font-semibold mb-1">Failed to load screenshots</div>
                  <div className="text-[11px] text-dark-dim">{setsError}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Existing sets */}
                  {filteredSets.map((set) => {
                    const typeInfo = SCREENSHOT_DISPLAY_TYPES[set.displayType];
                    const isUploading = uploadingSetId === set.id;
                    const isDeletingSet = deletingId === `set-${set.id}`;
                    const atMax = set.screenshots.length >= SCREENSHOT_MAX_COUNT;

                    return (
                      <div key={set.id} className="bg-dark-surface rounded-[10px] px-4 py-3">
                        {/* Set header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-dark-text">
                            {typeInfo?.label || set.displayType}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-dark-dim font-semibold">
                              {set.screenshots.length} of {SCREENSHOT_MAX_COUNT}
                            </span>
                            <button
                              onClick={() => handleDeleteSet(set.id)}
                              disabled={isDeletingSet}
                              className="text-[10px] font-semibold text-dark-dim bg-transparent border-none cursor-pointer font-sans px-0 hover:text-danger disabled:opacity-50"
                            >
                              {isDeletingSet ? "Deleting..." : "Delete All"}
                            </button>
                          </div>
                        </div>

                        {/* Screenshot grid */}
                        <div className={`flex gap-2 flex-wrap ${isMobile ? "" : ""}`}>
                          {set.screenshots.map((sc, idx) => {
                            const isDeleting = deletingId === sc.id;
                            const isProcessing = sc.assetDeliveryState?.state !== "COMPLETE";
                            const url = screenshotUrl(sc.imageAsset);
                            const isDragging = dragSetId === set.id && dragIndex === idx;
                            const isDragOver = dragSetId === set.id && dragOverIndex === idx;

                            return (
                              <div
                                key={sc.id}
                                draggable
                                onDragStart={() => handleDragStart(set.id, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={() => handleDrop(set.id)}
                                onDragEnd={() => { setDragSetId(null); setDragIndex(null); setDragOverIndex(null); }}
                                className={`relative group rounded-lg overflow-hidden cursor-grab shrink-0 ${
                                  isDragging ? "opacity-40" : ""
                                } ${isDragOver ? "ring-2 ring-accent" : ""}`}
                                style={{ width: isMobile ? 64 : 80, height: isMobile ? 138 : 173 }}
                              >
                                {isProcessing ? (
                                  <div className="w-full h-full bg-dark-hover flex items-center justify-center">
                                    <div className="text-sm" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
                                  </div>
                                ) : url ? (
                                  <img
                                    src={url}
                                    alt={sc.fileName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-dark-hover flex items-center justify-center">
                                    <span className="text-[10px] text-dark-dim">No preview</span>
                                  </div>
                                )}

                                {/* Delete overlay */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteScreenshot(set.id, sc.id); }}
                                  disabled={isDeleting}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-50"
                                >
                                  {isDeleting ? "\u21bb" : "\u2715"}
                                </button>
                              </div>
                            );
                          })}

                          {/* Upload button */}
                          {!atMax && (
                            <button
                              onClick={() => triggerUpload(set.id)}
                              disabled={isUploading}
                              className="rounded-lg border-2 border-dashed border-dark-border-light bg-transparent cursor-pointer flex items-center justify-center shrink-0 hover:border-accent transition-colors disabled:opacity-50"
                              style={{ width: isMobile ? 64 : 80, height: isMobile ? 138 : 173 }}
                            >
                              {isUploading ? (
                                <span className="text-lg text-dark-dim" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
                              ) : (
                                <span className="text-xl text-dark-dim">+</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Create new set for display types that don't have one */}
                  {availableTypes.length > 0 && (
                    <div className="bg-dark-surface rounded-[10px] px-4 py-3">
                      <div className="text-[11px] font-bold text-dark-text uppercase tracking-wide mb-2">Add Display Type</div>
                      <div className="flex gap-2 flex-wrap">
                        {availableTypes.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => handleCreateSet(t.key)}
                            disabled={creatingSetType === t.key}
                            className="text-[11px] font-semibold text-accent bg-accent-bg px-2.5 py-1.5 rounded-lg border-none cursor-pointer font-sans hover:opacity-80 transition-opacity disabled:opacity-50"
                          >
                            {creatingSetType === t.key ? "Creating..." : t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredSets.length === 0 && availableTypes.length === 0 && (
                    <div className="text-center py-6 text-dark-ghost">
                      <div className="text-xs font-semibold">No display types for {selectedCategory}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

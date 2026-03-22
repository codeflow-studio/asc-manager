import { useState } from "react";
import { updateVersionRelease } from "../api/index.js";

export default function RatingResetSection({ appId, versionId, accountId, detail, onDetailUpdate, isMobile }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // resetRatingSummary is write-only in the ASC API (not returned in GET),
  // so we track the user's selection locally with optimistic state
  const [isReset, setIsReset] = useState(false);

  async function handleChange(wantReset) {
    const prev = isReset;
    setIsReset(wantReset);
    setSaving(true);
    setSaveError(null);
    try {
      await updateVersionRelease(appId, versionId, {
        accountId,
        resetRatingSummary: wantReset,
      });
    } catch (err) {
      setIsReset(prev);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-[13px] font-bold text-dark-text uppercase tracking-wide mb-3">Reset App Store Summary Rating</h2>
      <p className="text-[12px] text-dark-dim mb-4 leading-relaxed">
        You can choose to reset your app's summary rating when this version is released.
        All existing ratings will be removed and a new average will be calculated from new ratings only.
      </p>

      <div className="space-y-2.5">
        <label className="flex items-center gap-3 cursor-pointer bg-dark-surface rounded-[10px] px-4 py-3 transition-colors hover:bg-dark-hover">
          <input
            type="radio"
            name="ratingReset"
            checked={!isReset}
            onChange={() => handleChange(false)}
            disabled={saving}
            className="w-4 h-4 accent-accent shrink-0"
          />
          <span className="text-[13px] text-dark-text font-medium">Keep existing rating</span>
          {saving && !isReset && (
            <span className="text-sm text-dark-dim shrink-0" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
          )}
        </label>

        <label className="flex items-center gap-3 cursor-pointer bg-dark-surface rounded-[10px] px-4 py-3 transition-colors hover:bg-dark-hover">
          <input
            type="radio"
            name="ratingReset"
            checked={isReset}
            onChange={() => handleChange(true)}
            disabled={saving}
            className="w-4 h-4 accent-accent shrink-0"
          />
          <span className="text-[13px] text-dark-text font-medium">Reset rating when this version is released</span>
          {saving && isReset && (
            <span className="text-sm text-dark-dim shrink-0" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
          )}
        </label>
      </div>

      {saveError && (
        <div className="text-[11px] text-danger font-medium mt-2">{saveError}</div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { fetchBuildEncryptionDeclaration, updateBuildEncryptionDeclaration } from "../api/index.js";

const ALGORITHM_OPTIONS = [
  {
    id: "proprietary",
    label: "Encryption algorithms that are proprietary or not accepted as standard by international standard bodies (IEEE, IETF, ITU, etc.)",
    proprietary: true,
    thirdParty: false,
  },
  {
    id: "standard",
    label: "Standard encryption algorithms instead of, or in addition to, using or accessing the encryption within Apple's operating system",
    proprietary: false,
    thirdParty: true,
  },
  {
    id: "both",
    label: "Both algorithms mentioned above",
    proprietary: true,
    thirdParty: true,
  },
  {
    id: "none",
    label: "None of the algorithms mentioned above",
    proprietary: false,
    thirdParty: false,
  },
];

export default function BuildComplianceModal({ build, appId, accountId, onClose, onSuccess, isMobile }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [declaration, setDeclaration] = useState(null);

  // Step 1: encryption yes/no, Step 2: algorithm type
  const [step, setStep] = useState(1);
  const [usesEncryption, setUsesEncryption] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchBuildEncryptionDeclaration(appId, build.id, accountId);
        if (cancelled) return;
        setDeclaration(result.declaration);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [appId, build.id, accountId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const algo = ALGORITHM_OPTIONS.find((a) => a.id === selectedAlgorithm);
      const data = {
        accountId,
        containsProprietaryCryptography: algo?.proprietary ?? false,
        containsThirdPartyCryptography: algo?.thirdParty ?? false,
      };
      await updateBuildEncryptionDeclaration(appId, build.id, data);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleNoEncryption() {
    setUsesEncryption(false);
    setStep("saving");
    // Save immediately
    setSaving(true);
    setError(null);
    updateBuildEncryptionDeclaration(appId, build.id, {
      accountId,
      containsProprietaryCryptography: false,
      containsThirdPartyCryptography: false,
    })
      .then(() => onSuccess())
      .catch((err) => {
        setError(err.message);
        setSaving(false);
        setStep(1);
      });
  }

  function handleYesEncryption() {
    setUsesEncryption(true);
    setStep(2);
  }

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/40 backdrop-blur-[8px] flex justify-center z-[100] ${isMobile ? "items-end" : "items-center"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "asc-fadein 0.3s ease" }}
        className={`bg-dark-card border border-dark-border-light w-full overflow-y-auto shadow-[0_32px_64px_rgba(0,0,0,0.15)] ${
          isMobile
            ? "rounded-t-2xl max-w-full max-h-[90vh]"
            : "rounded-2xl max-w-[520px] max-h-[85vh]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-[1]">
          <span className="text-[15px] font-bold text-dark-text">Export Compliance</span>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-7 h-7 rounded-full bg-dark-surface flex items-center justify-center cursor-pointer border-none hover:bg-dark-hover transition-colors disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={isMobile ? "px-4 py-4" : "px-6 py-5"}>
          {loading ? (
            <div className="text-center py-8 text-dark-dim">
              <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
              <div className="text-xs font-semibold mt-1">Loading compliance info...</div>
            </div>
          ) : error && step !== 2 ? (
            <div className="text-center py-6">
              <div className="text-xs text-danger font-semibold mb-1">Error</div>
              <div className="text-[11px] text-dark-dim">{error}</div>
            </div>
          ) : step === 1 ? (
            <>
              {/* Build info */}
              <div className="mb-5">
                <div className="text-[11px] text-dark-dim font-semibold uppercase tracking-wider mb-1">Build {build.version}</div>
                {declaration?.appEncryptionDeclarationState && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]" />
                    <span className="text-[11px] text-[#ff9500] font-medium">
                      {declaration.appEncryptionDeclarationState === "MISSING" ? "Missing Compliance" : declaration.appEncryptionDeclarationState}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[13px] text-dark-text font-semibold mb-3">
                Does your app use non-exempt encryption?
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleNoEncryption}
                  disabled={saving}
                  className="w-full text-left rounded-[10px] px-4 py-3 bg-dark-surface border border-dark-border hover:border-dark-border-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-[13px] font-semibold text-dark-text">No</div>
                  <div className="text-[11px] text-dark-dim mt-0.5">
                    This app does not use encryption, or only uses exempt encryption (HTTPS, TLS, etc.)
                  </div>
                </button>

                <button
                  onClick={handleYesEncryption}
                  disabled={saving}
                  className="w-full text-left rounded-[10px] px-4 py-3 bg-dark-surface border border-dark-border hover:border-dark-border-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-[13px] font-semibold text-dark-text">Yes</div>
                  <div className="text-[11px] text-dark-dim mt-0.5">
                    This app uses non-exempt encryption
                  </div>
                </button>
              </div>

              {/* Info box */}
              <div className="mt-4 rounded-lg bg-[#ff9500]/8 border border-[#ff9500]/15 px-4 py-3">
                <div className="text-[11px] text-dark-dim leading-relaxed">
                  You can bypass this by adding <span className="font-mono text-dark-ghost">ITSAppUsesNonExemptEncryption</span> to your app's Info.plist.
                </div>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <div className="text-[13px] text-dark-text font-semibold mb-1">
                App Encryption Documentation
              </div>
              <div className="text-[12px] text-dark-dim mb-4">
                What type of encryption algorithms does your app implement?
              </div>

              <div className="space-y-1.5">
                {ALGORITHM_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedAlgorithm(opt.id)}
                    className={`w-full text-left rounded-[10px] px-4 py-3 border transition-colors cursor-pointer ${
                      selectedAlgorithm === opt.id
                        ? "bg-accent/8 border-accent/30"
                        : "bg-dark-surface border-dark-border hover:border-dark-border-light"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                        selectedAlgorithm === opt.id ? "border-accent" : "border-dark-ghost"
                      }`}>
                        {selectedAlgorithm === opt.id && (
                          <div className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </div>
                      <div className="text-[12px] text-dark-text leading-relaxed">{opt.label}</div>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-3 text-[11px] text-danger font-medium">{error}</div>
              )}

              {/* Footer buttons */}
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => { setStep(1); setSelectedAlgorithm(null); setError(null); }}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold text-dark-dim bg-dark-surface border border-dark-border cursor-pointer hover:bg-dark-hover transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selectedAlgorithm || saving}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-accent text-white border-none cursor-pointer hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</span>
                  ) : "Save"}
                </button>
              </div>
            </>
          ) : step === "saving" ? (
            <div className="text-center py-8 text-dark-dim">
              <div className="text-lg inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
              <div className="text-xs font-semibold mt-1">Saving compliance declaration...</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

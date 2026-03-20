import { useState } from "react";
import { ACCT_COLORS } from "../constants/index.js";

export default function AddAccountModal({ onClose, onAdd, isMobile }) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [keyId, setKeyId] = useState("");
  const [pk, setPk] = useState("");

  const inputCls = `w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border-light rounded-lg text-dark-text outline-none font-sans ${isMobile ? "text-base" : "text-[13px]"}`;
  const disabled = !name || !issuer || !keyId;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/40 backdrop-blur-[8px] flex justify-center z-[100] ${isMobile ? "items-end" : "items-center"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-dark-card border border-dark-border-light w-full overflow-y-auto shadow-[0_32px_64px_rgba(0,0,0,0.15)] ${
          isMobile
            ? "rounded-t-2xl max-w-full max-h-[90vh]"
            : "rounded-2xl max-w-[520px]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-card z-[1]">
          <span className="text-base font-bold">Add Account</span>
          <span onClick={onClose} className="cursor-pointer text-dark-dim text-lg px-2 py-1">
            {"\u2715"}
          </span>
        </div>

        {/* Body */}
        <div className={isMobile ? "px-4 py-5" : "px-6 py-5"}>
          <p className="text-[12.5px] text-dark-muted mb-5 leading-relaxed">
            Connect via App Store Connect API. Generate keys at{" "}
            <span className="text-accent-light">
              Users and Access {"\u2192"} Integrations {"\u2192"} App Store Connect API
            </span>.
          </p>

          {[
            ["Account Name", name, setName, "e.g. My Company LLC", false],
            ["Issuer ID", issuer, setIssuer, "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", true],
            ["Key ID", keyId, setKeyId, "XXXXXXXXXX", true],
          ].map(([label, val, setter, ph, isMono]) => (
            <div key={label} className="mb-4">
              <label className="text-xs font-semibold text-dark-label mb-1.5 block">{label}</label>
              <input
                className={`${inputCls} ${isMono ? "font-mono" : "font-sans"}`}
                placeholder={ph}
                value={val}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}

          <div className="mb-6">
            <label className="text-xs font-semibold text-dark-label mb-1.5 block">Private Key (.p8)</label>
            <textarea
              className={`${inputCls} font-mono h-[100px] resize-y text-xs`}
              placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
              value={pk}
              onChange={(e) => setPk(e.target.value)}
            />
          </div>

          <div className={`flex gap-2.5 ${isMobile ? "flex-col-reverse" : "justify-end"}`}>
            <button
              onClick={onClose}
              className="px-[18px] py-3 rounded-lg text-[13px] font-semibold bg-dark-border text-dark-label border border-dark-border-light cursor-pointer font-sans"
            >
              Cancel
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                onAdd({
                  id: Date.now().toString(),
                  name,
                  issuer,
                  keyId,
                  pk,
                  color: ACCT_COLORS[Math.floor(Math.random() * ACCT_COLORS.length)],
                });
                onClose();
              }}
              className="px-[18px] py-3 rounded-lg text-[13px] font-semibold bg-accent text-white border-none cursor-pointer font-sans"
              style={{ opacity: disabled ? 0.4 : 1 }}
            >
              Connect Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

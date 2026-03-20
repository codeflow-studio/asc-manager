import { useState } from "react";
import Badge from "./Badge.jsx";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #5ac8fa, #007aff)",
  "linear-gradient(135deg, #34c759, #30b0c7)",
  "linear-gradient(135deg, #ff9500, #ff2d55)",
  "linear-gradient(135deg, #af52de, #5856d6)",
  "linear-gradient(135deg, #ff2d55, #ff6482)",
  "linear-gradient(135deg, #007aff, #5856d6)",
  "linear-gradient(135deg, #34c759, #007aff)",
  "linear-gradient(135deg, #ff9500, #ffcc00)",
];

function getPlaceholderGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return PLACEHOLDER_GRADIENTS[Math.abs(hash) % PLACEHOLDER_GRADIENTS.length];
}

function AppIcon({ app }) {
  const [imgError, setImgError] = useState(false);

  if (app.iconUrl && !imgError) {
    return (
      <img
        src={app.iconUrl}
        alt={app.name}
        className="w-[72px] h-[72px] rounded-[18px] shrink-0 object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  const letter = app.name.charAt(0).toUpperCase();

  return (
    <div
      className="w-[72px] h-[72px] rounded-[18px] shrink-0 flex items-center justify-center text-white font-bold text-2xl select-none"
      style={{ background: getPlaceholderGradient(app.name) }}
    >
      {letter}
    </div>
  );
}

export default function AppGrid({ filtered, accounts, onSelectApp, isMobile }) {
  if (filtered.length === 0) {
    return (
      <div className="text-center text-dark-ghost px-5 py-16">
        <div className="text-sm font-semibold">No apps found</div>
        <div className="text-xs mt-1 text-dark-phantom">Adjust filters or search query</div>
      </div>
    );
  }

  const columns = isMobile ? 1 : 3;
  const rows = [];
  for (let i = 0; i < filtered.length; i += columns) {
    rows.push(filtered.slice(i, i + columns));
  }

  return (
    <div>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx}>
          <div className="border-t border-dark-border" />
          <div
            className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}
            style={{ animation: `asc-fadein 0.3s ease ${rowIdx * 40}ms both` }}
          >
            {row.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app)}
                className="asc-app-card flex items-center gap-4 px-3 cursor-pointer rounded-lg transition-colors"
                style={{ paddingTop: 24, paddingBottom: 24 }}
              >
                <AppIcon app={app} />
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-dark-text truncate">
                    {app.name}
                  </div>
                  <Badge status={app.status} version={app.version} platform={app.platform} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-dark-border" />
    </div>
  );
}

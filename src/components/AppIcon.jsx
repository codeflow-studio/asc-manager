import { useState } from "react";

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

export default function AppIcon({ app, size = 72 }) {
  const [imgError, setImgError] = useState(false);
  const radius = Math.round(size * 0.25);
  const fontSize = Math.round(size * 0.35);

  if (app.iconUrl && !imgError) {
    return (
      <img
        src={app.iconUrl}
        alt={app.name}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setImgError(true)}
      />
    );
  }

  const letter = app.name.charAt(0).toUpperCase();

  return (
    <div
      className="shrink-0 flex items-center justify-center text-white font-bold select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        background: getPlaceholderGradient(app.name),
      }}
    >
      {letter}
    </div>
  );
}

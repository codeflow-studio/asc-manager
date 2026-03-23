import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.SERVER_PORT || 3001;

  const dirName = path.basename(process.cwd());
  const isMainWorktree = dirName === "app-store-manager";
  const defaultTitle = isMainWorktree ? "ASC Manager" : `ASC Manager \u2014 ${dirName}`;
  const appTitle = env.VITE_APP_TITLE || defaultTitle;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_TITLE__: JSON.stringify(appTitle),
    },
    appType: "spa",
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.js"],
    },
    server: {
      port: parseInt(env.PORT || "5173"),
      proxy: {
        "/api": {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});

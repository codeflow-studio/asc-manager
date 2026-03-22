import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.SERVER_PORT || 3001;

  return {
    plugins: [react(), tailwindcss()],
    appType: "spa",
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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Нормализация в manualChunks под Windows/Linux */
function posixPath(id: string): string {
  return id.replace(/\\/g, "/");
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/internal": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/openapi.json": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const s = posixPath(id);
          if (s.includes("/src/merchant/reference/")) {
            return "merchant-api-docs";
          }
          if (s.includes("/src/merchant/")) {
            return "merchant-console";
          }
          if (s.includes("/src/docs/")) {
            return "docs-site";
          }
          if (s.includes("/src/platform/")) {
            return "platform-console";
          }
          if (s.includes("/src/landing/")) {
            return "landing";
          }
          if (s.includes("PublicDocsPage.tsx")) {
            return "public-docs";
          }
          if (s.includes("node_modules") && s.includes("@tanstack/react-query")) {
            return "vendor-react-query";
          }
          return undefined;
        },
      },
    },
  },
});

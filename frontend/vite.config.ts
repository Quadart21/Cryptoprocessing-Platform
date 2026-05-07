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
          if (id.includes("node_modules")) {
            const n = posixPath(id);
            if (n.includes("@tanstack/react-query")) {
              return "vendor-react-query";
            }
            if (n.includes("/react-dom/") || n.includes("react-dom")) {
              return "vendor-react-dom";
            }
            if (n.includes("/react/") && !n.includes("react-dom")) {
              return "vendor-react";
            }
            return "vendor";
          }

          const s = posixPath(id);
          if (s.includes("/src/merchant/reference/")) {
            return "merchant-api-docs";
          }
          if (s.includes("/src/merchant/")) {
            return "merchant-console";
          }
          if (s.includes("/src/platform/")) {
            return "platform-console";
          }
          if (s.includes("/src/landing/")) {
            return "landing";
          }
          if (s.includes("PublicDocsPage.tsx") || s.includes("PublicDocsPage.tsx/")) {
            return "public-docs";
          }

          return undefined;
        },
      },
    },
  },
});

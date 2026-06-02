import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Нормализация в manualChunks под Windows/Linux */
function posixPath(id: string): string {
  return id.replace(/\\/g, "/");
}

function platformSectionChunk(path: string): string | undefined {
  const match = path.match(/\/src\/platform\/sections\/([^/]+)\./);
  if (!match) {
    return undefined;
  }
  return `platform-${match[1].replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const s = posixPath(id);

          if (s.includes("node_modules")) {
            if (s.includes("@tiptap") || s.includes("prosemirror")) {
              return "vendor-tiptap";
            }
            if (s.includes("@tanstack/react-query")) {
              return "vendor-react-query";
            }
            if (s.includes("react-dom") || s.includes("/react/")) {
              return "vendor-react";
            }
            return undefined;
          }

          if (s.includes("/src/merchant/reference/")) {
            return "merchant-api-docs";
          }
          if (s.includes("/src/merchant/")) {
            return "merchant-console";
          }
          if (s.includes("/src/docs/")) {
            return "docs-site";
          }
          if (s.includes("/src/platform/sections/")) {
            return platformSectionChunk(s);
          }
          if (s.includes("/src/platform/components/NotificationTemplate")) {
            return "platform-settings-editor";
          }
          if (s.includes("/src/platform/")) {
            return "platform-core";
          }
          if (s.includes("/src/landing/")) {
            return "landing";
          }
          if (s.includes("PublicDocsPage.tsx")) {
            return "public-docs";
          }
          return undefined;
        },
      },
    },
  },
});

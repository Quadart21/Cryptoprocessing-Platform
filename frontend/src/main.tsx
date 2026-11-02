import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { getAccessToken } from "./storage";
import { LocaleProvider } from "./i18n";
import { readPublicSsrBootstrap, setPublicRequestContext } from "./ssr/requestContext";
import "./i18n/i18n.css";
import "./styles.css";

const queryClient = new QueryClient();
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root is missing");
}

const bootstrap = readPublicSsrBootstrap();
const canHydrate = Boolean(
  bootstrap && (bootstrap.surface === "docs" || (bootstrap.surface === "landing" && !getAccessToken())),
);
if (canHydrate && bootstrap) {
  setPublicRequestContext(bootstrap);
}

const tree = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={canHydrate ? bootstrap?.locale : undefined}>
        <App />
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if (canHydrate) {
  hydrateRoot(rootElement, tree);
} else {
  createRoot(rootElement).render(tree);
}


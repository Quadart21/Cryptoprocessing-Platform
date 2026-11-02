import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "../App";
import { LocaleProvider } from "../i18n";
import { publicHead } from "./publicHead";
import { setPublicRequestContext, type PublicRequestContext } from "./requestContext";

export function render(ctx: PublicRequestContext): { html: string; title: string; description: string } {
  setPublicRequestContext(ctx);
  try {
    const html = renderToString(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <LocaleProvider initialLocale={ctx.locale}>
            <App />
          </LocaleProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    return { html, ...publicHead(ctx.locale, ctx.surface, ctx.url) };
  } finally {
    setPublicRequestContext(null);
  }
}

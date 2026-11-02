import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { getPublicRequestContext } from "../ssr/requestContext";
import { StaticPublicRouter } from "../ssr/staticRouter";
import { DocsArticlePage } from "./DocsArticlePage";
import { DocsGuidePage } from "./DocsGuidePage";
import { DocsIntegrationModulePage } from "./DocsIntegrationModulePage";
import { DocsIntegrationsPage } from "./DocsIntegrationsPage";
import { DocsIntroductionPage } from "./DocsIntroductionPage";
import { DocsLegacyRedirect } from "./DocsLegacyRedirect";
import { DocsSiteLayout } from "./DocsSiteLayout";

function DocsHashScroll() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }
    const target = document.querySelector(location.hash);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location]);

  return null;
}

export function DocsSiteRoutes() {
  return (
    <>
      <DocsHashScroll />
      <Routes>
        <Route element={<DocsSiteLayout />}>
          <Route index element={<DocsIntroductionPage />} />
          <Route path="quickstart" element={<DocsArticlePage articleKey="quickstart" />} />
          <Route path="invoices" element={<DocsArticlePage articleKey="invoices" />} />
          <Route path="balance" element={<DocsArticlePage articleKey="balance" />} />
          <Route path="transactions" element={<DocsArticlePage articleKey="transactions" />} />
          <Route path="rates" element={<DocsArticlePage articleKey="rates" />} />
          <Route path="checkout" element={<DocsArticlePage articleKey="checkout" />} />
          <Route path="webhooks" element={<DocsArticlePage articleKey="webhooks" />} />
          <Route path="integrations" element={<DocsIntegrationsPage />} />
          <Route path="integrations/:moduleId" element={<DocsIntegrationModulePage />} />
          <Route path="commissions" element={<DocsGuidePage section="commissions" />} />
          <Route path="reference" element={<DocsArticlePage articleKey="reference" />} />
          <Route path="faq" element={<DocsGuidePage section="faq" />} />
          <Route path="merchant-api" element={<DocsLegacyRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export function DocsSiteRoot() {
  if (typeof window === "undefined") {
    return (
      <StaticPublicRouter location={getPublicRequestContext()?.url ?? "/"}>
        <DocsSiteRoutes />
      </StaticPublicRouter>
    );
  }
  return (
    <BrowserRouter>
      <DocsSiteRoutes />
    </BrowserRouter>
  );
}

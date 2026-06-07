import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { DocsGuidePage } from "./DocsGuidePage";
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

export function DocsSiteRoot() {
  return (
    <BrowserRouter>
      <DocsHashScroll />
      <Routes>
        <Route element={<DocsSiteLayout />}>
          <Route index element={<DocsIntroductionPage />} />
          <Route path="quickstart" element={<DocsGuidePage section="quickstart" />} />
          <Route path="checkout" element={<DocsGuidePage section="checkout" />} />
          <Route path="webhooks" element={<DocsGuidePage section="webhooks" />} />
          <Route path="commissions" element={<DocsGuidePage section="commissions" />} />
          <Route path="reference" element={<DocsGuidePage section="reference" />} />
          <Route path="faq" element={<DocsGuidePage section="faq" />} />
          <Route path="merchant-api" element={<DocsLegacyRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

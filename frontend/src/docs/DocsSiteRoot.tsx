import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { DocsIntroductionPage } from "./DocsIntroductionPage";
import { DocsMerchantApiPage } from "./DocsMerchantApiPage";
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
          <Route path="merchant-api" element={<DocsMerchantApiPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

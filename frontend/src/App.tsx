import { useEffect, useState } from "react";

import { AppController } from "./AppController";
import { AppRouteFallback } from "./components/AppRouteFallback";
import { SeoHead } from "./components/SeoHead";
import { isAdminSubdomain, isMarketingHost, isPaySubdomain } from "./config/siteHost";
import { redirectApiRootToDocs, redirectPayTokenFromMarketingHost } from "./config/siteHostRedirect";
import { DocsSiteRoot } from "./docs/DocsSiteRoot";
import { PublicMarketingView } from "./public/PublicMarketingView";
import { resolveInitialSurface } from "./ssr/surface";
import { PayPageMissing } from "./pay/PayPageMissing";
import { PayPageRoot } from "./pay/PayPageRoot";
import { resolvePayPageToken } from "./pay/publicPayApi";
import { fetchSeoSettings, type SeoSettings } from "./api";
import { PlatformBrandProvider } from "./brand/PlatformBrandContext";

export function App() {
  const [seoSettings, setSeoSettings] = useState<SeoSettings | null>(null);
  const payToken = resolvePayPageToken();
  const payRedirectFromMarketing = Boolean(payToken && isMarketingHost() && !isPaySubdomain());

  useEffect(() => {
    fetchSeoSettings()
      .then(setSeoSettings)
      .catch((error) => {
        console.error("Failed to load SEO settings", error);
      });
  }, []);

  useEffect(() => {
    redirectApiRootToDocs();
    if (payToken) {
      redirectPayTokenFromMarketingHost(payToken);
    }
  }, [payToken]);

  const surface = resolveInitialSurface();

  let content: JSX.Element;
  if (surface === "docs") {
    content = <DocsSiteRoot />;
  } else if (surface === "landing") {
    content = <PublicMarketingView />;
  } else if (isAdminSubdomain()) {
    content = <AppController siteScope="admin" />;
  } else if (isPaySubdomain()) {
    content = payToken ? <PayPageRoot token={payToken} /> : <PayPageMissing />;
  } else if (payRedirectFromMarketing) {
    content = <AppRouteFallback />;
  } else if (payToken) {
    content = <PayPageRoot token={payToken} />;
  } else {
    content = <AppController />;
  }

  return (
    <PlatformBrandProvider settings={seoSettings}>
      <SeoHead settings={seoSettings} />
      {content}
    </PlatformBrandProvider>
  );
}

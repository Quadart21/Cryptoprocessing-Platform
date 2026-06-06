import { useEffect, useLayoutEffect, useState } from "react";

import { AppController } from "./AppController";
import { AppRouteFallback } from "./components/AppRouteFallback";
import { SeoHead } from "./components/SeoHead";
import {
  isAdminSubdomain,
  isDocsSubdomain,
  isMarketingHost,
  isPaySubdomain,
} from "./config/siteHost";
import { redirectApiRootToDocs, redirectPayTokenFromMarketingHost } from "./config/siteHostRedirect";
import { DocsSiteRoot } from "./docs/DocsSiteRoot";
import { PayPageMissing } from "./pay/PayPageMissing";
import { PayPageRoot } from "./pay/PayPageRoot";
import { resolvePayPageToken } from "./pay/publicPayApi";
import { fetchSeoSettings, type SeoSettings } from "./api";

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

  useLayoutEffect(() => {
    redirectApiRootToDocs();
    if (payToken) {
      redirectPayTokenFromMarketingHost(payToken);
    }
  }, [payToken]);

  let content: JSX.Element;
  if (isDocsSubdomain()) {
    content = <DocsSiteRoot />;
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
    <>
      <SeoHead settings={seoSettings} />
      {content}
    </>
  );
}

import { useLayoutEffect } from "react";

import { AppController } from "./AppController";
import { AppRouteFallback } from "./components/AppRouteFallback";
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

export function App() {
  const payToken = resolvePayPageToken();
  const payRedirectFromMarketing = Boolean(payToken && isMarketingHost() && !isPaySubdomain());

  useLayoutEffect(() => {
    redirectApiRootToDocs();
    if (payToken) {
      redirectPayTokenFromMarketingHost(payToken);
    }
  }, [payToken]);

  if (isDocsSubdomain()) {
    return <DocsSiteRoot />;
  }
  if (isAdminSubdomain()) {
    return <AppController siteScope="admin" />;
  }
  if (isPaySubdomain()) {
    return payToken ? <PayPageRoot token={payToken} /> : <PayPageMissing />;
  }
  if (payRedirectFromMarketing) {
    return <AppRouteFallback />;
  }
  if (payToken) {
    return <PayPageRoot token={payToken} />;
  }
  return <AppController />;
}

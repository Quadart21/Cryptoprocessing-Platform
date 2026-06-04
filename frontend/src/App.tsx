import { AppController } from "./AppController";
import { isAdminSubdomain, isDocsSubdomain, isPaySubdomain } from "./config/siteHost";
import { DocsSiteRoot } from "./docs/DocsSiteRoot";
import { PayPageMissing } from "./pay/PayPageMissing";
import { PayPageRoot } from "./pay/PayPageRoot";
import { resolvePayPageToken } from "./pay/publicPayApi";

export function App() {
  if (isDocsSubdomain()) {
    return <DocsSiteRoot />;
  }
  if (isAdminSubdomain()) {
    return <AppController siteScope="admin" />;
  }
  if (isPaySubdomain()) {
    const payToken = resolvePayPageToken();
    return payToken ? <PayPageRoot token={payToken} /> : <PayPageMissing />;
  }
  const payToken = resolvePayPageToken();
  if (payToken) {
    return <PayPageRoot token={payToken} />;
  }
  return <AppController />;
}

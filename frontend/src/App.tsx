import { AppController } from "./AppController";
import { isDocsSubdomain } from "./config/siteHost";
import { DocsSiteRoot } from "./docs/DocsSiteRoot";
import { PayPageRoot } from "./pay/PayPageRoot";
import { resolvePayPageToken } from "./pay/publicPayApi";

export function App() {
  if (isDocsSubdomain()) {
    return <DocsSiteRoot />;
  }
  const payToken = resolvePayPageToken();
  if (payToken) {
    return <PayPageRoot token={payToken} />;
  }
  return <AppController />;
}

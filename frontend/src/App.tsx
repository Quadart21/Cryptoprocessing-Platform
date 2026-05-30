import { AppController } from "./AppController";
import { isDocsSubdomain } from "./config/siteHost";
import { DocsSiteRoot } from "./docs/DocsSiteRoot";

export function App() {
  if (isDocsSubdomain()) {
    return <DocsSiteRoot />;
  }
  return <AppController />;
}

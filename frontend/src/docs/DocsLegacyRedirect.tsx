import { Navigate, useLocation } from "react-router-dom";

import { DOCS_LEGACY_HASH_REDIRECTS } from "./docsNav";

/** /merchant-api#… → новые маршруты */
export function DocsLegacyRedirect() {
  const location = useLocation();
  const target = DOCS_LEGACY_HASH_REDIRECTS[location.hash];
  return <Navigate replace to={target ?? "/reference"} />;
}

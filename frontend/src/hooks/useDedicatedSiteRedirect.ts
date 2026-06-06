import { useEffect } from "react";

import {
  redirectApiRootToDocs,
  redirectAuthenticatedUserToDedicatedHost,
} from "../config/siteHostRedirect";

type UseDedicatedSiteRedirectParams = {
  userRole: string | null;
  adminHost: boolean;
  accessToken: string | null;
  csrfToken?: string | null;
};

export function useDedicatedSiteRedirect({
  userRole,
  adminHost,
  accessToken,
  csrfToken,
}: UseDedicatedSiteRedirectParams) {
  useEffect(() => {
    redirectApiRootToDocs();
  }, []);

  useEffect(() => {
    if (!userRole || !accessToken) {
      return;
    }
    redirectAuthenticatedUserToDedicatedHost(userRole, adminHost, accessToken, csrfToken);
  }, [userRole, adminHost, accessToken, csrfToken]);
}

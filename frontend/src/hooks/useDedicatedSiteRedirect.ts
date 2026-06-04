import { useEffect } from "react";

import {
  redirectApiRootToDocs,
  redirectAuthenticatedUserToDedicatedHost,
} from "../config/siteHostRedirect";

type UseDedicatedSiteRedirectParams = {
  userRole: string | null;
  adminHost: boolean;
};

export function useDedicatedSiteRedirect({ userRole, adminHost }: UseDedicatedSiteRedirectParams) {
  useEffect(() => {
    redirectApiRootToDocs();
  }, []);

  useEffect(() => {
    if (!userRole) {
      return;
    }
    redirectAuthenticatedUserToDedicatedHost(userRole, adminHost);
  }, [userRole, adminHost]);
}

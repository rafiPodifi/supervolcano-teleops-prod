import { getAuth, type Auth, type TenantAwareAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebaseAdmin";

/**
 * Return the right Firebase Auth instance for a given tenant. When the
 * project uses Identity Platform multi-tenancy, users live inside a
 * tenant's user pool and the root Auth instance cannot look them up
 * via getUser(); the call returns auth/user-not-found. Routes that call
 * getUser must pass the tenant they discovered on the decoded ID token
 * (`decodedToken.firebase.tenant`).
 */
export function authForTenant(
  tenantId: string | null | undefined,
): Auth | TenantAwareAuth {
  const app = getAdminApp();
  const rootAuth = getAuth(app);
  if (!tenantId) return rootAuth;
  return rootAuth.tenantManager().authForTenant(tenantId);
}

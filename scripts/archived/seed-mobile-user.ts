/**
 * Seed a mobile-app user (cleaner / teleoperator / owner) in a GCP Identity
 * Platform tenant. Mirrors scripts/seed-superadmin.ts but parameterised.
 *
 * Prereq:
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project gen-lang-client-0659584673
 *
 * Usage:
 *   ENV=staging pnpm tsx scripts/seed-mobile-user.ts \
 *     <email> <password> <role> <organizationId>
 *
 * Examples:
 *   ENV=staging pnpm tsx scripts/seed-mobile-user.ts \
 *     cleaner@test.local Passw0rd! location_cleaner owner:demo
 *   ENV=staging pnpm tsx scripts/seed-mobile-user.ts \
 *     teleop@test.local Passw0rd! oem_teleoperator oem:demo
 *   ENV=staging pnpm tsx scripts/seed-mobile-user.ts \
 *     owner@test.local Passw0rd! location_owner owner:demo
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "gen-lang-client-0659584673";

const ENV_MAP = {
  staging: { tenantId: "staging-ita88", dbId: "staging-db" },
  prod: { tenantId: "prod-ftn50", dbId: "prod-db" },
} as const;

const MOBILE_ROLES = new Set([
  "location_cleaner",
  "oem_teleoperator",
  "location_owner",
]);

async function main() {
  const env = process.env.ENV as keyof typeof ENV_MAP | undefined;
  const [, , email, password, role, organizationId] = process.argv;

  if (!env || !ENV_MAP[env]) {
    console.error("ENV must be 'staging' or 'prod'");
    process.exit(1);
  }
  if (!email || !password || !role || !organizationId) {
    console.error(
      "Usage: ENV=staging pnpm tsx scripts/seed-mobile-user.ts <email> <password> <role> <organizationId>",
    );
    process.exit(1);
  }
  if (!MOBILE_ROLES.has(role)) {
    console.error(
      `role must be one of: ${[...MOBILE_ROLES].join(", ")}. Got: ${role}`,
    );
    process.exit(1);
  }

  const { tenantId, dbId } = ENV_MAP[env];

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

  const tenantAuth = getAuth().tenantManager().authForTenant(tenantId);
  const db = getFirestore(dbId);

  let user;
  try {
    user = await tenantAuth.getUserByEmail(email);
    console.log(`Found existing user ${user.uid} in tenant ${tenantId}`);
    await tenantAuth.updateUser(user.uid, { password, emailVerified: true });
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      user = await tenantAuth.createUser({
        email,
        password,
        emailVerified: true,
      });
      console.log(`Created user ${user.uid} in tenant ${tenantId}`);
    } else {
      throw err;
    }
  }

  // Set both camelCase and snake_case so older readers + newer readers both work.
  await tenantAuth.setCustomUserClaims(user.uid, {
    role,
    organizationId,
    organization_id: organizationId,
    // partnerId mirrors organizationId for non-superadmin roles — used by
    // permissions middleware on the web API.
    partnerId: organizationId,
  });
  console.log(
    `Custom claims set: role=${role}, organizationId=${organizationId}`,
  );

  const now = new Date().toISOString();
  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        id: user.uid,
        email,
        name: email.split("@")[0],
        displayName: email.split("@")[0],
        role,
        organizationId,
        organization_id: organizationId,
        partnerId: organizationId,
        status: "active",
        created_at: now,
        updated_at: now,
        notifications_enabled: true,
      },
      { merge: true },
    );
  console.log(`Firestore users/${user.uid} written to ${dbId}`);

  console.log("\nDone. Sign in on mobile with this email + password.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

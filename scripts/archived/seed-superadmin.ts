/**
 * Bootstrap a superadmin user in a GCP Identity Platform tenant.
 *
 * Uses Application Default Credentials. Run first:
 *   gcloud auth application-default login
 *   gcloud config set project gen-lang-client-0659584673
 *
 * Usage:
 *   ENV=staging pnpm tsx scripts/seed-superadmin.ts <email> <password>
 *   ENV=prod    pnpm tsx scripts/seed-superadmin.ts <email> <password>
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "gen-lang-client-0659584673";

const ENV_MAP = {
  staging: { tenantId: "staging-ita88", dbId: "staging-db" },
  prod: { tenantId: "prod-ftn50", dbId: "prod-db" },
} as const;

async function main() {
  const env = process.env.ENV as keyof typeof ENV_MAP | undefined;
  const email = process.argv[2];
  const password = process.argv[3];

  if (!env || !ENV_MAP[env]) {
    console.error("ENV must be 'staging' or 'prod'");
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      "Usage: ENV=staging pnpm tsx scripts/seed-superadmin.ts <email> <password>",
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

  await tenantAuth.setCustomUserClaims(user.uid, {
    role: "superadmin",
    organization_id: "sv:internal",
  });
  console.log(
    "Custom claims set: role=superadmin, organization_id=sv:internal",
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
        role: "superadmin",
        organization_id: "sv:internal",
        created_at: now,
        updated_at: now,
        notifications_enabled: true,
      },
      { merge: true },
    );
  console.log(`Firestore users/${user.uid} written to ${dbId}`);

  console.log("\nDone. Sign in at the env URL with email + password.");
  console.log(
    "If already signed in elsewhere, sign out + back in so new claims load.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

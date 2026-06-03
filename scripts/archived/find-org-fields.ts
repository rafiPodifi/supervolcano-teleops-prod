/**
 * FIND ORGANIZATION FIELDS
 * Finds any user with organization fields to use as reference
 */

import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

async function findOrgFields() {
  const { adminDb } = await import("../src/lib/firebaseAdmin");

  console.log("🔍 Searching for users with organization fields...\n");

  // Check all users
  const allUsers = await adminDb.collection("users").get();

  console.log(`Found ${allUsers.docs.length} total users\n`);

  for (const doc of allUsers.docs) {
    const data = doc.data();
    if (data.organizationId || data.partnerId) {
      console.log(`✅ User: ${data.email || doc.id}`);
      console.log(`   organizationId: ${data.organizationId || "N/A"}`);
      console.log(`   partnerId: ${data.partnerId || "N/A"}`);
      console.log(`   role: ${data.role || "N/A"}`);
      console.log("");
    }
  }

  // Check organizations collection
  console.log("🔍 Checking organizations collection...\n");
  const orgs = await adminDb.collection("organizations").limit(5).get();

  if (!orgs.empty) {
    console.log(`Found ${orgs.docs.length} organizations:\n`);
    orgs.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`   ${data.name || doc.id} (${doc.id})`);
      console.log(`   partnerId: ${data.partnerId || "N/A"}`);
      console.log("");
    });
  } else {
    console.log("No organizations found\n");
  }
}

findOrgFields();

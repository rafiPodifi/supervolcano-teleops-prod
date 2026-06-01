/**
 * Backfill location coordinates.
 *
 * Iterates the `locations` collection, finds documents without usable
 * coordinates, geocodes their address, and writes back `coordinates:{lat,lng}`.
 * Idempotent — already-populated locations are skipped.
 *
 * Usage:
 *   GOOGLE_GEOCODING_API_KEY=<key> npx tsx scripts/backfill-location-coords.ts
 *
 * Optional:
 *   FIRESTORE_DATABASE_ID=staging-db   # target a named DB (default DB if unset)
 *   DRY_RUN=1                          # log what would change, write nothing
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Service account discovery (mirrors check-locations.ts) ----------------
const possiblePaths = [
  join(
    __dirname,
    "..",
    "..",
    "super-volcano-oem-portal-firebase-adminsdk-fbsvc-9afc946529.json",
  ),
  join(
    process.cwd(),
    "..",
    "super-volcano-oem-portal-firebase-adminsdk-fbsvc-9afc946529.json",
  ),
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
].filter(Boolean) as string[];

let serviceAccount: any;
for (const p of possiblePaths) {
  try {
    if (p && fs.existsSync(p)) {
      serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
      console.log(`✅ Found service account at: ${p}`);
      break;
    }
  } catch {
    // try next
  }
}

if (!serviceAccount) {
  console.error("❌ Service account file not found. Tried:");
  possiblePaths.forEach((p) => console.error(`   - ${p}`));
  process.exit(1);
}

if (getApps().length === 0) {
  const projectId = serviceAccount.projectId || serviceAccount.project_id;
  console.log(`🔧 Initializing Firebase Admin with project: ${projectId}`);
  initializeApp({ credential: cert(serviceAccount), projectId });
}

const databaseId = process.env.FIRESTORE_DATABASE_ID;
const db = databaseId ? getFirestore(databaseId) : getFirestore();
const dryRun = process.env.DRY_RUN === "1";
console.log(
  `📦 Firestore ready (db=${databaseId ?? "(default)"}, dryRun=${dryRun})`,
);

// ---- Geocoding -------------------------------------------------------------
const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const geocodeKey =
  process.env.GOOGLE_GEOCODING_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!geocodeKey) {
  console.error(
    "❌ No geocoding key. Set GOOGLE_GEOCODING_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).",
  );
  process.exit(1);
}

async function geocode(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${GEOCODE_ENDPOINT}?address=${encodeURIComponent(
      address,
    )}&key=${geocodeKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`   ⚠️ HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      console.warn(`   ⚠️ status=${data.status} ${data.error_message ?? ""}`);
      return null;
    }
    const loc = data.results[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
      return null;
    }
    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    console.warn(`   ⚠️ geocode error:`, err);
    return null;
  }
}

function hasUsableCoordinates(c: any): boolean {
  return Boolean(
    c &&
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    !(c.lat === 0 && c.lng === 0),
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Main ------------------------------------------------------------------
async function run() {
  const snap = await db.collection("locations").get();
  console.log(`\n🔍 ${snap.size} locations total\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = data.name || doc.id;

    if (hasUsableCoordinates(data.coordinates)) {
      skipped++;
      continue;
    }

    const address = data.address?.trim();
    if (!address) {
      console.log(`⏭️  ${name}: no address, skipping`);
      skipped++;
      continue;
    }

    const coords = await geocode(address);
    if (!coords) {
      console.log(`❌ ${name}: geocode failed for "${address}"`);
      failed++;
      // Be gentle on the API even on failure.
      await sleep(200);
      continue;
    }

    console.log(`📍 ${name}: ${coords.lat}, ${coords.lng}`);
    if (!dryRun) {
      await doc.ref.update({ coordinates: coords });
    }
    updated++;
    await sleep(200);
  }

  console.log(
    `\n✅ Done. updated=${updated} skipped=${skipped} failed=${failed}${
      dryRun ? " (dry run, nothing written)" : ""
    }`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });

/**
 * MIGRATION: Fix auto-generated organization names
 * Updates "Organization org-XXXXX" to proper names
 * ONE-TIME USE - DELETE AFTER RUNNING
 */
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🚀 Starting organization name fix migration...");
    const stats = {
      analyzed: 0,
      updated: 0,
      skipped: 0,
      details: [] as { id: string; from: string; to: string }[],
      errors: [] as string[],
    };

    const snapshot = await adminDb.collection("organizations").get();
    stats.analyzed = snapshot.size;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const currentName = data.name || "";
      const orgId = doc.id;

      // Skip if name doesn't match auto-generated pattern
      if (!currentName.startsWith("Organization org-") && !currentName.startsWith("Organization ")) {
        console.log(`⏭️  Skipping ${orgId}: name already set to "${currentName}"`);
        stats.skipped++;
        continue;
      }

      // Generate a better default name based on org type and slug
      let newName: string;

      if (orgId === "sv:internal") {
        newName = "SuperVolcano Internal";
      } else if (orgId.startsWith("oem:")) {
        const slug = data.slug || orgId.replace("oem:", "");
        newName = `${formatSlugToName(slug)} Robotics`;
      } else if (orgId.startsWith("owner:")) {
        const slug = data.slug || orgId.replace("owner:", "").replace("org-", "");
        newName = `${formatSlugToName(slug)} Properties`;
      } else {
        // Fallback for any other format
        const slug = data.slug || orgId;
        newName = formatSlugToName(slug);
      }

      try {
        await adminDb.collection("organizations").doc(orgId).update({
          name: newName,
          updated_at: new Date(),
        });

        console.log(`✅ Updated ${orgId}: "${currentName}" → "${newName}"`);
        stats.updated++;
        stats.details.push({ id: orgId, from: currentName, to: newName });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Failed to update ${orgId}:`, message);
        stats.errors.push(`${orgId}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Organization names updated",
      stats,
    });
  } catch (error: unknown) {
    console.error("❌ Migration failed:", error);
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

function formatSlugToName(slug: string): string {
  // Convert "org-19dc60c6" or "demo-company" to "Demo Company"
  return slug
    .replace(/^org-/, "")
    .replace(/^owner:/, "")
    .replace(/^oem:/, "")
    .split("-")
    .map((word) => {
      // Handle hex strings - just capitalize first letter
      if (/^[a-f0-9]+$/i.test(word) && word.length > 4) {
        return `#${word.substring(0, 6).toUpperCase()}`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}


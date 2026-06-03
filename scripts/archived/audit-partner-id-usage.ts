/**
 * AUDIT SCRIPT: Find all partnerId references
 * This will show us everywhere we need to make changes
 * Run: npx tsx scripts/audit-partner-id-usage.ts
 */

import * as fs from "fs";
import * as path from "path";

interface FileReference {
  file: string;
  line: number;
  content: string;
  type: "code" | "type" | "comment" | "firestore";
}

function searchDirectory(
  dir: string,
  references: FileReference[],
  searchTerm: string,
) {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      let stat: fs.Stats;

      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      // Skip node_modules, .next, etc.
      if (
        file === "node_modules" ||
        file === ".next" ||
        file === ".git" ||
        file === "dist" ||
        file === "build"
      ) {
        continue;
      }

      if (stat.isDirectory()) {
        searchDirectory(filePath, references, searchTerm);
      } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");

          lines.forEach((line, index) => {
            // Case-insensitive search for partnerId
            const lowerLine = line.toLowerCase();
            if (
              lowerLine.includes(searchTerm.toLowerCase()) &&
              !line.includes("REMOVED") &&
              !line.includes("removed")
            ) {
              let type: "code" | "type" | "comment" | "firestore" = "code";

              if (
                line.trim().startsWith("//") ||
                line.trim().startsWith("*") ||
                line.trim().startsWith("/*")
              ) {
                type = "comment";
              } else if (
                line.includes("interface") ||
                line.includes("type ") ||
                line.includes("export type")
              ) {
                type = "type";
              } else if (
                line.includes("partnerId:") ||
                line.includes(".partnerId") ||
                lowerLine.includes("partnerid")
              ) {
                type = "firestore";
              }

              references.push({
                file: filePath,
                line: index + 1,
                content: line.trim(),
                type,
              });
            }
          });
        } catch (error) {
          // Skip files we can't read
          console.error(`Error reading ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

async function auditPartnerIdUsage() {
  console.log("🔍 Auditing partnerId usage across codebase...\n");
  console.log("=".repeat(80));

  const references: FileReference[] = [];
  const projectRoot = process.cwd();

  // Search for partnerId references
  const srcPath = path.join(projectRoot, "src");
  if (fs.existsSync(srcPath)) {
    searchDirectory(srcPath, references, "partnerId");
  }

  const mobileAppPath = path.join(projectRoot, "mobile-app", "src");
  if (fs.existsSync(mobileAppPath)) {
    searchDirectory(mobileAppPath, references, "partnerId");
  }

  // Categorize findings
  const byType = {
    code: references.filter((r) => r.type === "code"),
    type: references.filter((r) => r.type === "type"),
    comment: references.filter((r) => r.type === "comment"),
    firestore: references.filter((r) => r.type === "firestore"),
  };

  console.log("\n📊 AUDIT SUMMARY\n");
  console.log(`Total references found: ${references.length}`);
  console.log(`  - Code references: ${byType.code.length}`);
  console.log(`  - Type definitions: ${byType.type.length}`);
  console.log(`  - Firestore queries: ${byType.firestore.length}`);
  console.log(`  - Comments: ${byType.comment.length}`);
  console.log("");

  // Print detailed findings
  if (byType.code.length > 0) {
    console.log("=".repeat(80));
    console.log("🔴 CODE REFERENCES (Must Fix)\n");
    byType.code.forEach((ref) => {
      console.log(`${ref.file}:${ref.line}`);
      console.log(`  ${ref.content}`);
      console.log("");
    });
  }

  if (byType.type.length > 0) {
    console.log("=".repeat(80));
    console.log("📝 TYPE DEFINITIONS (Must Update)\n");
    byType.type.forEach((ref) => {
      console.log(`${ref.file}:${ref.line}`);
      console.log(`  ${ref.content}`);
      console.log("");
    });
  }

  if (byType.firestore.length > 0) {
    console.log("=".repeat(80));
    console.log("🔥 FIRESTORE QUERIES (Must Migrate)\n");
    byType.firestore.forEach((ref) => {
      console.log(`${ref.file}:${ref.line}`);
      console.log(`  ${ref.content}`);
      console.log("");
    });
  }

  if (byType.comment.length > 0) {
    console.log("=".repeat(80));
    console.log("💬 COMMENTS (Update for Clarity)\n");
    byType.comment.forEach((ref) => {
      console.log(`${ref.file}:${ref.line}`);
      console.log(`  ${ref.content}`);
      console.log("");
    });
  }

  console.log("=".repeat(80));
  console.log("\n💡 NEXT STEPS:\n");
  console.log("1. Review all references above");
  console.log("2. Run migration script to update database");
  console.log("3. Update all code files to remove partnerId");
  console.log("4. Update all TypeScript types");
  console.log("5. Test thoroughly");
  console.log("");

  // Save detailed report
  const reportPath = path.join(projectRoot, "partner-id-audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ references, byType }, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

auditPartnerIdUsage().catch((error) => {
  console.error("Audit failed:", error);
  process.exit(1);
});

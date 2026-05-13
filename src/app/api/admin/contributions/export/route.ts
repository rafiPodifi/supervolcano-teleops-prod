import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebaseAdmin";
import { getUserClaims } from "@/lib/utils/auth";
import { Storage } from "@google-cloud/storage";
import { FieldValue } from "firebase-admin/firestore";
import archiver from "archiver";
import { PassThrough } from "stream";

// Force dynamic rendering to prevent build-time execution
export const dynamic = "force-dynamic";

function getBucketName(): string {
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) {
    throw new Error("FIREBASE_STORAGE_BUCKET is not set");
  }
  return name;
}

function getStorage() {
  // On Cloud Run, Application Default Credentials are auto-injected via
  // the runtime service account — pass no `credentials` so the GCS SDK
  // picks them up. Locally, fall back to the FIREBASE_ADMIN_* service
  // account env vars.
  if (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  ) {
    return new Storage({
      credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
          /\\n/g,
          "\n",
        ),
      },
      projectId:
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT,
    });
  }
  return new Storage({
    projectId:
      process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const claims = await getUserClaims(token);

    if (
      !claims ||
      !["admin", "superadmin", "partner_admin"].includes(claims.role)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      name,
      description,
      videoIds,
      partnerId,
      partnerName,
      deliveryMethod = "both",
    } = await request.json();

    if (!name || !videoIds || videoIds.length === 0) {
      return NextResponse.json(
        { error: "name and videoIds required" },
        { status: 400 },
      );
    }

    // Fetch all selected videos
    const adminDb = getAdminDb();
    const videoDocs = await Promise.all(
      videoIds.map((id: string) => adminDb.collection("media").doc(id).get()),
    );

    const videos = videoDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    // Only include approved videos
    const eligibleVideos = videos.filter(
      (v: any) => v.reviewStatus === "approved",
    );

    if (eligibleVideos.length === 0) {
      return NextResponse.json(
        {
          error: "No eligible videos (must be approved)",
        },
        { status: 400 },
      );
    }

    // Calculate totals
    const totalSizeBytes = eligibleVideos.reduce(
      (sum: number, v: any) => sum + (v.fileSize || 0),
      0,
    );
    const totalDurationSeconds = eligibleVideos.reduce(
      (sum: number, v: any) => sum + (v.durationSeconds || 0),
      0,
    );

    const storage = getStorage();
    const bucket = storage.bucket(getBucketName());
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const exportId = adminDb.collection("exports").doc().id;
    const timestamp = Date.now();

    let manifestUrl: string | null = null;
    let zipUrl: string | null = null;
    let zipSizeBytes: number | null = null;

    // Generate manifest with signed URLs
    if (deliveryMethod === "manifest" || deliveryMethod === "both") {
      const manifest = await Promise.all(
        eligibleVideos.map(async (video: any) => {
          // Prefer blurred version if available
          const filePath = video.blurredStoragePath || video.storagePath;
          const [signedUrl] = await bucket.file(filePath).getSignedUrl({
            action: "read",
            expires: expiresAt,
          });

          return {
            id: video.id,
            fileName: video.fileName,
            url: signedUrl,
            isBlurred: !!video.blurredStoragePath,
            facesDetected: video.facesDetected || 0,
            durationSeconds: video.durationSeconds || 0,
            fileSize: video.fileSize || 0,
            locationText: video.locationText || null,
          };
        }),
      );

      const manifestFileName = `exports/${exportId}/${timestamp}_${name.replace(/\s+/g, "_")}_manifest.json`;
      const manifestFile = bucket.file(manifestFileName);
      await manifestFile.save(JSON.stringify(manifest, null, 2), {
        contentType: "application/json",
      });

      [manifestUrl] = await manifestFile.getSignedUrl({
        action: "read",
        expires: expiresAt,
        responseDisposition: `attachment; filename="${name}_manifest.json"`,
      });
    }

    // Generate ZIP file
    if (deliveryMethod === "zip" || deliveryMethod === "both") {
      const zipFileName = `exports/${exportId}/${timestamp}_${name.replace(/\s+/g, "_")}.zip`;
      const zipFile = bucket.file(zipFileName);

      // Create ZIP in memory and stream to GCS
      const archive = archiver("zip", { zlib: { level: 5 } });
      const passThrough = new PassThrough();

      const writeStream = zipFile.createWriteStream({
        resumable: false,
        contentType: "application/zip",
      });

      archive.pipe(passThrough);
      passThrough.pipe(writeStream);

      // Add each video to the archive
      for (const video of eligibleVideos as any[]) {
        const filePath = video.blurredStoragePath || video.storagePath;
        const fileName = video.blurredStoragePath
          ? `blurred_${video.fileName}`
          : video.fileName;

        const [fileContents] = await bucket.file(filePath).download();
        archive.append(fileContents, { name: fileName });
      }

      // Add manifest to ZIP as well
      const manifestInZip = eligibleVideos.map((v: any) => ({
        id: v.id,
        fileName: v.blurredStoragePath ? `blurred_${v.fileName}` : v.fileName,
        isBlurred: !!v.blurredStoragePath,
        facesDetected: v.facesDetected || 0,
        durationSeconds: v.durationSeconds || 0,
        fileSize: v.fileSize || 0,
        locationText: v.locationText || null,
      }));
      archive.append(JSON.stringify(manifestInZip, null, 2), {
        name: "manifest.json",
      });

      await archive.finalize();

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Get ZIP file size
      const [metadata] = await zipFile.getMetadata();
      zipSizeBytes = parseInt(metadata.size as string) || null;

      [zipUrl] = await zipFile.getSignedUrl({
        action: "read",
        expires: expiresAt,
        responseDisposition: `attachment; filename="${name}.zip"`,
      });
    }

    // Get user uid and email from token
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const firebaseUser = await adminAuth.getUser(uid);
    const createdByEmail = firebaseUser.email || "unknown";

    // Create export record
    const exportRef = adminDb.collection("exports").doc(exportId);
    const exportData = {
      id: exportId,
      name,
      description: description || null,
      partnerId: partnerId || null,
      partnerName: partnerName || null,
      status: "ready",
      deliveryMethod,
      videoIds: eligibleVideos.map((v: any) => v.id),
      videoCount: eligibleVideos.length,
      totalSizeBytes,
      totalDurationSeconds,
      manifestUrl,
      zipUrl,
      zipSizeBytes,
      zipGeneratedAt: zipUrl ? FieldValue.serverTimestamp() : null,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      createdByEmail: createdByEmail,
    };

    await exportRef.set(exportData);

    return NextResponse.json({
      success: true,
      export: {
        ...exportData,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API] Export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const claims = await getUserClaims(token);

    if (
      !claims ||
      !["admin", "superadmin", "partner_admin"].includes(claims.role)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("exports")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const exports = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        expiresAt:
          data.expiresAt instanceof Date
            ? data.expiresAt.toISOString()
            : data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt,
        zipGeneratedAt: data.zipGeneratedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ exports });
  } catch (error: any) {
    console.error("[API] Get exports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

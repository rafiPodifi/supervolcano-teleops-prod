/**
 * Google Cloud Video Intelligence Service
 *
 * Handles video annotation using Google Cloud Video Intelligence API.
 * Free tier: 1,000 minutes/month per feature.
 *
 * Supports large videos by using GCS URIs (Firebase Storage = GCS bucket)
 */

import {
  VideoIntelligenceServiceClient,
  protos,
} from "@google-cloud/video-intelligence";

type IVideoAnnotationResults =
  protos.google.cloud.videointelligence.v1.IVideoAnnotationResults;

export interface VideoAnnotations {
  labels: Array<{
    description: string;
    confidence: number;
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
  objects: Array<{
    description: string;
    confidence: number;
    trackId: number;
    frames: Array<{
      time: number;
      boundingBox: { left: number; top: number; right: number; bottom: number };
    }>;
  }>;
  text: Array<{
    text: string;
    confidence: number;
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
  shots: Array<{ startTime: number; endTime: number }>;
  processedAt: string;
  processingTimeMs: number;
}

export interface ProcessingResult {
  success: boolean;
  annotations?: VideoAnnotations;
  error?: string;
}

class GoogleVideoAIService {
  private client: VideoIntelligenceServiceClient | null = null;
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.client = new VideoIntelligenceServiceClient();
      this.initialized = true;
      console.log("[VideoAI] Client initialized via ADC");
    } catch (error: any) {
      console.error("[VideoAI] Failed to initialize:", error.message);
      throw new Error(`Failed to initialize Video AI: ${error.message}`);
    }
  }

  /**
   * Convert Firebase Storage URL to GCS URI
   * Firebase Storage URLs: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?token=...
   * GCS URI: gs://BUCKET/PATH
   */
  private firebaseUrlToGcsUri(firebaseUrl: string): string | null {
    try {
      // Pattern 1: firebasestorage.googleapis.com format
      // https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?...
      const googleapisMatch = firebaseUrl.match(
        /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/,
      );
      if (googleapisMatch) {
        const bucket = googleapisMatch[1];
        const path = decodeURIComponent(googleapisMatch[2]);
        return `gs://${bucket}/${path}`;
      }

      // Pattern 2: storage.googleapis.com format
      // https://storage.googleapis.com/BUCKET/PATH
      const storageMatch = firebaseUrl.match(
        /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/,
      );
      if (storageMatch) {
        const bucket = storageMatch[1];
        const path = storageMatch[2].split("?")[0]; // Remove query params
        return `gs://${bucket}/${path}`;
      }

      // Pattern 3: Firebase Storage new format
      // https://BUCKET.firebasestorage.app/o/PATH?...
      const newFormatMatch = firebaseUrl.match(
        /https:\/\/([^.]+\.firebasestorage\.app)\/o\/([^?]+)/,
      );
      if (newFormatMatch) {
        const bucket = newFormatMatch[1];
        const path = decodeURIComponent(newFormatMatch[2]);
        return `gs://${bucket}/${path}`;
      }

      return null;
    } catch (error) {
      console.error("[VideoAI] Failed to parse Firebase URL:", error);
      return null;
    }
  }

  /**
   * Download video for base64 processing (fallback for small videos)
   */
  private async downloadVideo(url: string): Promise<Buffer> {
    console.log(`[VideoAI] Downloading video...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(
      `[VideoAI] Downloaded ${Math.round((buffer.length / 1024 / 1024) * 10) / 10}MB`,
    );
    return buffer;
  }

  async annotateVideo(
    videoUrl: string,
    features: ("LABEL" | "OBJECT" | "TEXT" | "SHOT")[] = [
      "LABEL",
      "OBJECT",
      "TEXT",
    ],
  ): Promise<ProcessingResult> {
    await this.initialize();

    if (!this.client) {
      return { success: false, error: "Video AI client not initialized" };
    }

    const startTime = Date.now();

    try {
      const featureMap: Record<string, number> = {
        LABEL: 1,
        OBJECT: 9,
        TEXT: 7,
        SHOT: 4,
      };

      const requestFeatures = features
        .map((f) => featureMap[f])
        .filter((f): f is number => f !== undefined);

      // Try to convert Firebase URL to GCS URI (no size limit)
      const gcsUri = this.firebaseUrlToGcsUri(videoUrl);

      let request: any;

      if (gcsUri) {
        // Use GCS URI - NO SIZE LIMIT
        console.log(`[VideoAI] Using GCS URI: ${gcsUri}`);
        request = {
          inputUri: gcsUri,
          features: requestFeatures,
        };
      } else if (videoUrl.startsWith("gs://")) {
        // Already a GCS URI
        console.log(`[VideoAI] Using provided GCS URI: ${videoUrl}`);
        request = {
          inputUri: videoUrl,
          features: requestFeatures,
        };
      } else {
        // Fallback: download and use base64 (20MB limit)
        console.log(`[VideoAI] Falling back to base64 download...`);
        const videoBuffer = await this.downloadVideo(videoUrl);

        const maxSize = 20 * 1024 * 1024;
        if (videoBuffer.length > maxSize) {
          return {
            success: false,
            error: `Video too large (${Math.round(videoBuffer.length / 1024 / 1024)}MB). Could not convert to GCS URI.`,
          };
        }

        request = {
          inputContent: videoBuffer.toString("base64"),
          features: requestFeatures,
        };
      }

      console.log(
        `[VideoAI] Starting annotation with features: ${features.join(", ")}`,
      );

      const [operation] = await this.client.annotateVideo(request);

      console.log(
        "[VideoAI] Waiting for annotation (may take 1-5 minutes for longer videos)...",
      );
      const [response] = await operation.promise();

      const results = response.annotationResults?.[0];
      if (!results) {
        return { success: false, error: "No annotation results returned" };
      }

      const annotations = this.parseResults(results);
      annotations.processingTimeMs = Date.now() - startTime;

      console.log(
        `[VideoAI] Complete in ${Math.round(annotations.processingTimeMs / 1000)}s`,
      );
      console.log(
        `[VideoAI] Found: ${annotations.labels.length} labels, ${annotations.objects.length} objects`,
      );

      return { success: true, annotations };
    } catch (error: any) {
      // gRPC errors often format as `${code} ${codeName}: ${details}`.
      // When fields are missing, .message reads "undefined undefined: undefined" —
      // so dump the whole error shape to logs and surface the most useful field.
      console.error("[VideoAI] Annotation failed. Raw error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        statusDetails: error?.statusDetails,
        metadata: error?.metadata,
        stack: error?.stack,
      });
      const friendly =
        error?.details ||
        error?.statusDetails ||
        (error?.code !== undefined ? `gRPC code ${error.code}` : null) ||
        error?.message ||
        "Unknown Video AI error";
      return { success: false, error: friendly };
    }
  }

  async annotateVideoFromBuffer(
    videoBuffer: Buffer,
    features: ("LABEL" | "OBJECT" | "TEXT" | "SHOT")[] = ["LABEL", "OBJECT"],
  ): Promise<ProcessingResult> {
    await this.initialize();
    if (!this.client)
      return { success: false, error: "Client not initialized" };

    const maxSize = 20 * 1024 * 1024;
    if (videoBuffer.length > maxSize) {
      return {
        success: false,
        error: `Video too large (${Math.round(videoBuffer.length / 1024 / 1024)}MB > 20MB)`,
      };
    }

    const startTime = Date.now();
    try {
      const featureMap: Record<string, number> = {
        LABEL: 1,
        OBJECT: 9,
        TEXT: 7,
        SHOT: 4,
      };
      const requestFeatures = features
        .map((f) => featureMap[f])
        .filter((f): f is number => f !== undefined);

      const [operation] = await this.client.annotateVideo({
        inputContent: videoBuffer.toString("base64"),
        features: requestFeatures,
      });
      const [response] = await operation.promise();

      const results = response.annotationResults?.[0];
      if (!results) return { success: false, error: "No results" };

      const annotations = this.parseResults(results);
      annotations.processingTimeMs = Date.now() - startTime;
      return { success: true, annotations };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private parseResults(results: IVideoAnnotationResults): VideoAnnotations {
    const annotations: VideoAnnotations = {
      labels: [],
      objects: [],
      text: [],
      shots: [],
      processedAt: new Date().toISOString(),
      processingTimeMs: 0,
    };

    for (const label of results.segmentLabelAnnotations || []) {
      if (!label.entity?.description) continue;
      const segments = (label.segments || []).map((seg) => ({
        startTime: this.parseTime(seg.segment?.startTimeOffset),
        endTime: this.parseTime(seg.segment?.endTimeOffset),
      }));
      const maxConf = Math.max(
        ...(label.segments || []).map((s) => s.confidence || 0),
        0,
      );
      annotations.labels.push({
        description: label.entity.description,
        confidence: maxConf,
        segments,
      });
    }

    for (const obj of results.objectAnnotations || []) {
      if (!obj.entity?.description) continue;
      const frames = (obj.frames || []).map((frame) => ({
        time: this.parseTime(frame.timeOffset),
        boundingBox: {
          left: frame.normalizedBoundingBox?.left || 0,
          top: frame.normalizedBoundingBox?.top || 0,
          right: frame.normalizedBoundingBox?.right || 0,
          bottom: frame.normalizedBoundingBox?.bottom || 0,
        },
      }));
      annotations.objects.push({
        description: obj.entity.description,
        confidence: obj.confidence || 0,
        trackId: obj.trackId ? Number(obj.trackId) : 0,
        frames,
      });
    }

    for (const text of results.textAnnotations || []) {
      if (!text.text) continue;
      const segments = (text.segments || []).map((seg) => ({
        startTime: this.parseTime(seg.segment?.startTimeOffset),
        endTime: this.parseTime(seg.segment?.endTimeOffset),
      }));
      const maxConf = Math.max(
        ...(text.segments || []).map((s) => s.confidence || 0),
        0,
      );
      annotations.text.push({ text: text.text, confidence: maxConf, segments });
    }

    for (const shot of results.shotAnnotations || []) {
      annotations.shots.push({
        startTime: this.parseTime(shot.startTimeOffset),
        endTime: this.parseTime(shot.endTimeOffset),
      });
    }

    return annotations;
  }

  private parseTime(
    duration: protos.google.protobuf.IDuration | null | undefined,
  ): number {
    if (!duration) return 0;
    return Number(duration.seconds || 0) + Number(duration.nanos || 0) / 1e9;
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.initialize();
      return { healthy: this.initialized && this.client !== null };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }
}

export const googleVideoAI = new GoogleVideoAIService();

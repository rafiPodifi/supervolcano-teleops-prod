/**
 * Video Face Blur Service
 * 
 * Uses Google Cloud Video Intelligence API for face detection,
 * then applies blur using FFmpeg via Cloud Run processor.
 */

import { VideoIntelligenceServiceClient, protos } from '@google-cloud/video-intelligence';
import { Storage } from '@google-cloud/storage';

interface BlurResult {
  success: boolean;
  blurredUrl?: string;
  blurredStoragePath?: string;
  facesDetected?: number;
  error?: string;
  processingTimeMs?: number;
}

interface FaceTrack {
  trackId: number;
  frames: Array<{
    timeOffset: number;
    boundingBox: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    };
  }>;
}

class VideoBlurService {
  private client: VideoIntelligenceServiceClient | null = null;
  private storage: Storage | null = null;
  private initialized = false;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'super-volcano-oem-portal.firebasestorage.app';
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin credentials');
      }

      const credentials = { client_email: clientEmail, private_key: privateKey };

      this.client = new VideoIntelligenceServiceClient({
        credentials,
        projectId,
      });

      this.storage = new Storage({
        credentials,
        projectId,
      });

      this.initialized = true;
      console.log('[VideoBlur] Service initialized');
    } catch (error: any) {
      console.error('[VideoBlur] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Convert Firebase Storage URL to GCS URI
   */
  firebaseUrlToGcsUri(firebaseUrl: string): string | null {
    try {
      const googleapisMatch = firebaseUrl.match(
        /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/
      );
      if (googleapisMatch) {
        const bucket = googleapisMatch[1];
        const path = decodeURIComponent(googleapisMatch[2]);
        return `gs://${bucket}/${path}`;
      }

      const storageMatch = firebaseUrl.match(
        /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/
      );
      if (storageMatch) {
        const bucket = storageMatch[1];
        const path = storageMatch[2].split('?')[0];
        return `gs://${bucket}/${path}`;
      }

      const newFormatMatch = firebaseUrl.match(
        /https:\/\/([^.]+\.firebasestorage\.app)\/o\/([^?]+)/
      );
      if (newFormatMatch) {
        const bucket = newFormatMatch[1];
        const path = decodeURIComponent(newFormatMatch[2]);
        return `gs://${bucket}/${path}`;
      }

      return null;
    } catch (error) {
      console.error('[VideoBlur] Failed to parse Firebase URL:', error);
      return null;
    }
  }

  /**
   * Generate blurred video output path
   */
  generateBlurredPath(originalPath: string): string {
    const parts = originalPath.split('/');
    const filename = parts.pop() || 'video.mp4';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const ext = filename.split('.').pop() || 'mp4';
    
    return [...parts, 'blurred', `${nameWithoutExt}_blurred.${ext}`].join('/');
  }

  /**
   * Detect faces in video using Video Intelligence API
   */
  async detectFaces(gcsUri: string): Promise<{ faces: FaceTrack[]; error?: string }> {
    await this.initialize();

    if (!this.client) {
      return { faces: [], error: 'Client not initialized' };
    }

    try {
      console.log(`[VideoBlur] Detecting faces in: ${gcsUri}`);

      const [operation] = await this.client.annotateVideo({
        inputUri: gcsUri,
        features: ['FACE_DETECTION' as any],
        videoContext: {
          faceDetectionConfig: {
            includeBoundingBoxes: true,
            includeAttributes: false,
          },
        },
      });

      console.log('[VideoBlur] Waiting for face detection...');
      const [response] = await operation.promise();

      const results = response.annotationResults?.[0];
      const faceAnnotations = results?.faceDetectionAnnotations || [];

      const faces: FaceTrack[] = faceAnnotations.map((face, index) => ({
        trackId: index,
        frames: (face.tracks?.[0]?.timestampedObjects || []).map(obj => ({
          timeOffset: this.parseTime(obj.timeOffset),
          boundingBox: {
            left: obj.normalizedBoundingBox?.left || 0,
            top: obj.normalizedBoundingBox?.top || 0,
            right: obj.normalizedBoundingBox?.right || 0,
            bottom: obj.normalizedBoundingBox?.bottom || 0,
          },
        })),
      }));

      console.log(`[VideoBlur] Detected ${faces.length} faces`);
      return { faces };
    } catch (error: any) {
      console.error('[VideoBlur] Face detection failed:', error.message);
      return { faces: [], error: error.message };
    }
  }

  private parseTime(duration: protos.google.protobuf.IDuration | null | undefined): number {
    if (!duration) return 0;
    return Number(duration.seconds || 0) + Number(duration.nanos || 0) / 1e9;
  }

  /**
   * Get signed download URL for a file
   */
  async getSignedUrl(filePath: string, expiresInDays: number = 7): Promise<string> {
    await this.initialize();
    const bucket = this.storage!.bucket(this.bucketName);
    const [url] = await bucket.file(filePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    });
    return url;
  }

  /**
   * Main blur method - detects faces and applies blur
   */
  async blurVideo(
    videoUrl: string,
    storagePath: string
  ): Promise<BlurResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      const gcsUri = this.firebaseUrlToGcsUri(videoUrl);
      if (!gcsUri) {
        return { success: false, error: 'Could not convert URL to GCS URI' };
      }

      console.log(`[VideoBlur] Processing: ${gcsUri}`);

      // Step 1: Detect faces
      const { faces, error: detectError } = await this.detectFaces(gcsUri);
      if (detectError) {
        return { success: false, error: detectError };
      }

      const facesDetected = faces.length;
      const blurredPath = this.generateBlurredPath(storagePath);
      const bucket = this.storage!.bucket(this.bucketName);

      // Step 2: If no faces, copy original as "blurred"
      if (facesDetected === 0) {
        console.log('[VideoBlur] No faces detected, copying original');
        await bucket.file(storagePath).copy(bucket.file(blurredPath));
        const blurredUrl = await this.getSignedUrl(blurredPath);

        return {
          success: true,
          blurredUrl,
          blurredStoragePath: blurredPath,
          facesDetected: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Step 3: Call Cloud Run FFmpeg processor (or dev fallback)
      const processorUrl = process.env.VIDEO_BLUR_PROCESSOR_URL;
      
      if (!processorUrl) {
        // Development fallback: copy original without actual blur
        console.warn('[VideoBlur] No processor URL configured, copying original (dev mode)');
        await bucket.file(storagePath).copy(bucket.file(blurredPath));
        const blurredUrl = await this.getSignedUrl(blurredPath);

        return {
          success: true,
          blurredUrl,
          blurredStoragePath: blurredPath,
          facesDetected,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Call the FFmpeg processor
      const response = await fetch(`${processorUrl}/blur`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VIDEO_BLUR_PROCESSOR_KEY || ''}`,
        },
        body: JSON.stringify({
          sourcePath: storagePath,
          outputPath: blurredPath,
          bucket: this.bucketName,
          faces: faces.map((f, idx) => {
            console.log(`[VideoBlur] Face ${idx} has ${f.frames.length} frames`);
            if (f.frames.length > 0) {
              console.log(`[VideoBlur] First frame box:`, JSON.stringify(f.frames[0].boundingBox));
            }
            
            // Get time range this face appears
            const startTime = Math.max(0, (f.frames[0]?.timeOffset || 0) - 0.5); // Start 0.5s early
            const endTime = (f.frames[f.frames.length - 1]?.timeOffset || 9999) + 1.0; // Add 1s buffer
            
            // Get average bounding box across all frames
            const avgBox = f.frames.reduce((acc, frame) => ({
              left: acc.left + frame.boundingBox.left,
              top: acc.top + frame.boundingBox.top,
              right: acc.right + frame.boundingBox.right,
              bottom: acc.bottom + frame.boundingBox.bottom,
            }), { left: 0, top: 0, right: 0, bottom: 0 });
            
            const numFrames = f.frames.length || 1;
            
            const result = {
              x: avgBox.left / numFrames,
              y: avgBox.top / numFrames,
              width: (avgBox.right - avgBox.left) / numFrames,
              height: (avgBox.bottom - avgBox.top) / numFrames,
              startTime,
              endTime,
            };
            
            console.log(`[VideoBlur] Face ${idx} coords:`, JSON.stringify(result));
            return result;
          }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blur processor failed: ${errorText}`);
      }

      const blurredUrl = await this.getSignedUrl(blurredPath);

      return {
        success: true,
        blurredUrl,
        blurredStoragePath: blurredPath,
        facesDetected,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[VideoBlur] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
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

export const videoBlurService = new VideoBlurService();


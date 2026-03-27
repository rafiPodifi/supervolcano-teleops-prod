import { uploadVideoToFirebase } from './upload';
import { saveMediaMetadata } from './api';
import { UploadStageEvent } from './upload-debug.types';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-100
}

export interface QueuedUploadInput {
  locationId: string;
  locationName: string;
  jobId: string;
  jobTitle: string;
  segmentNumber: number;
  startedAt: string;
  endedAt: string;
}

export interface UploadedVideoArtifact {
  storageUrl: string;
  durationSeconds: number;
  fileSize: number;
  fileName: string;
}

function buildSegmentFileName(segment: QueuedUploadInput): string {
  const segmentLabel = segment.segmentNumber.toString().padStart(4, '0');
  const startedAt = new Date(segment.startedAt);
  const timestamp = Number.isNaN(startedAt.getTime()) ? Date.now() : startedAt.getTime();
  return `${timestamp}-segment-${segmentLabel}.mp4`;
}

export class VideoUploadService {
  static async uploadBinary(
    videoUri: string,
    segment: QueuedUploadInput,
    onProgress?: (progress: UploadProgress) => void,
    onStage?: (event: UploadStageEvent) => void
  ): Promise<UploadedVideoArtifact> {
    console.log('[VideoUploadService] Starting upload...');
    console.log('[VideoUploadService] Video URI:', videoUri);
    console.log('[VideoUploadService] Location ID:', segment.locationId);
    console.log('[VideoUploadService] Job ID:', segment.jobId);

    try {
      const uploadResult = await uploadVideoToFirebase(
        videoUri,
        segment.locationId,
        segment.jobId,
        (progress) => onProgress?.(progress),
        (event) => onStage?.(event)
      );

      return {
        storageUrl: uploadResult.storageUrl,
        durationSeconds: uploadResult.durationSeconds,
        fileSize: uploadResult.fileSize,
        fileName: buildSegmentFileName(segment),
      };
    } catch (error: any) {
      onStage?.({
        stage: 'failed',
        message: error?.message || error?.code || 'Unknown upload error',
      });
      throw new Error(`Failed to upload video: ${error?.message || error?.code || 'Unknown error'}`);
    }
  }

  static async saveMetadata(
    segment: QueuedUploadInput,
    artifact: UploadedVideoArtifact,
    onStage?: (event: UploadStageEvent) => void
  ): Promise<void> {
    try {
      onStage?.({
        stage: 'save_metadata',
        message: 'Saving upload metadata to portal API',
        details: `${segment.locationId}/${segment.jobId}`,
      });
      await saveMediaMetadata({
        taskId: segment.jobId,
        locationId: segment.locationId,
        storageUrl: artifact.storageUrl,
        fileName: artifact.fileName,
        fileSize: artifact.fileSize,
        mimeType: 'video/mp4',
        durationSeconds: artifact.durationSeconds,
      });
      onStage?.({
        stage: 'completed',
        message: 'Upload metadata saved successfully',
      });
    } catch (error: any) {
      onStage?.({
        stage: 'failed',
        message: error?.message || error?.code || 'Unknown upload error',
      });
      throw new Error(`Failed to save upload metadata: ${error?.message || error?.code || 'Unknown error'}`);
    }
  }

  static async uploadVideo(
    videoUri: string,
    segment: QueuedUploadInput,
    onProgress?: (progress: UploadProgress) => void,
    onStage?: (event: UploadStageEvent) => void
  ): Promise<UploadedVideoArtifact> {
    const artifact = await this.uploadBinary(videoUri, segment, onProgress, onStage);
    await this.saveMetadata(segment, artifact, onStage);
    return artifact;
  }
}

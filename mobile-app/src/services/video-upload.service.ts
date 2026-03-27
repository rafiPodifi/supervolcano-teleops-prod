import { uploadVideoToFirebase } from './upload';
import { saveMediaMetadata } from './api';

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

export class VideoUploadService {
  static async uploadVideo(
    videoUri: string,
    segment: QueuedUploadInput,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    console.log('[VideoUploadService] Starting upload...');
    console.log('[VideoUploadService] Video URI:', videoUri);
    console.log('[VideoUploadService] Location ID:', segment.locationId);
    console.log('[VideoUploadService] Job ID:', segment.jobId);
    
    try {
      const uploadResult = await uploadVideoToFirebase(
        videoUri,
        segment.locationId,
        segment.jobId,
        (progress) => onProgress?.(progress)
      );

      const segmentLabel = segment.segmentNumber.toString().padStart(4, '0');
      const startedAt = new Date(segment.startedAt);
      const timestamp = Number.isNaN(startedAt.getTime()) ? Date.now() : startedAt.getTime();
      const fileName = `${timestamp}-segment-${segmentLabel}.mp4`;

      await saveMediaMetadata({
        taskId: segment.jobId,
        locationId: segment.locationId,
        storageUrl: uploadResult.storageUrl,
        fileName,
        fileSize: uploadResult.fileSize,
        mimeType: 'video/mp4',
        durationSeconds: uploadResult.durationSeconds,
      });
    } catch (error: any) {
      throw new Error(`Failed to upload video: ${error?.message || error?.code || 'Unknown error'}`);
    }
  }
}

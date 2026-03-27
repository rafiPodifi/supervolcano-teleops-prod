/**
 * UPLOAD QUEUE SERVICE
 * Manages persistent queue of videos pending upload
 * Survives app restarts, handles offline/online transitions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoUploadService } from './video-upload.service';
import { normalizeLocalFileUri } from '@/utils/local-file-uri';

const QUEUE_STORAGE_KEY = '@upload_queue';
const VIDEOS_DIR = `${FileSystem.documentDirectory}videos/`;
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

export interface QueuedVideo {
  id: string;
  localPath: string;
  locationId: string;
  locationName: string;
  jobId: string;
  jobTitle: string;
  segmentNumber: number;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'uploading' | 'failed';
}

export interface QueueStatus {
  pending: number;
  uploading: number;
  failed: number;
  total: number;
}

type QueueListener = (status: QueueStatus) => void;

class UploadQueueServiceClass {
  private queue: QueuedVideo[] = [];
  private isProcessing: boolean = false;
  private isOnline: boolean = true;
  private listeners: Set<QueueListener> = new Set();

  /**
   * Initialize the service - call on app start
   */
  async initialize(): Promise<void> {
    console.log('[UploadQueue] Initializing...');
    
    // Ensure videos directory exists
    await this.ensureVideosDirectory();
    
    // Load persisted queue
    await this.loadQueue();
    
    // Start network monitoring
    this.startNetworkMonitoring();
    
    // Process any pending uploads
    this.processQueue();
    
    console.log('[UploadQueue] Initialized with', this.queue.length, 'pending uploads');
  }

  /**
   * Cleanup - call on app unmount
   */
  cleanup(): void {
    this.listeners.clear();
  }

  /**
   * Subscribe to queue status changes
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current queue status
   */
  getStatus(): QueueStatus {
    const pending = this.queue.filter(v => v.status === 'pending').length;
    const uploading = this.queue.filter(v => v.status === 'uploading').length;
    const failed = this.queue.filter(v => v.status === 'failed').length;
    return { pending, uploading, failed, total: this.queue.length };
  }

  /**
   * Add a video to the upload queue
   * Moves file from temp cache to persistent storage
   */
  async addToQueue(
    tempVideoUri: string,
    payload: {
      locationId: string;
      locationName: string;
      jobId: string;
      jobTitle: string;
      segmentNumber: number;
      startedAt: string;
      endedAt: string;
    }
  ): Promise<string> {
    const normalizedTempVideoUri = normalizeLocalFileUri(tempVideoUri);
    console.log('[UploadQueue] Adding video to queue:', normalizedTempVideoUri);

    // Generate unique ID
    const id = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${id}.mov`;
    const persistentPath = `${VIDEOS_DIR}${filename}`;

    try {
      const sourceFileInfo = await FileSystem.getInfoAsync(normalizedTempVideoUri);
      if (!sourceFileInfo.exists) {
        throw new Error(
          `Source recording file not found. raw=${tempVideoUri} normalized=${normalizedTempVideoUri}`
        );
      }

      // Move from temp cache to persistent storage
      await FileSystem.copyAsync({
        from: normalizedTempVideoUri,
        to: persistentPath,
      });
      console.log('[UploadQueue] Moved video to:', persistentPath);

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(persistentPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to persist video file');
      }

      // Create queue entry
      const queuedVideo: QueuedVideo = {
        id,
        localPath: persistentPath,
        locationId: payload.locationId,
        locationName: payload.locationName,
        jobId: payload.jobId,
        jobTitle: payload.jobTitle,
        segmentNumber: payload.segmentNumber,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
      };

      // Add to queue and persist
      this.queue.push(queuedVideo);
      await this.saveQueue();
      this.notifyListeners();

      // Try to delete temp file (don't fail if can't)
      try {
        await FileSystem.deleteAsync(normalizedTempVideoUri, { idempotent: true });
      } catch (e) {
        console.log('[UploadQueue] Could not delete temp file:', e);
      }

      // Trigger processing
      this.processQueue();

      console.log('[UploadQueue] Video queued successfully:', id);
      return id;
    } catch (error: any) {
      console.error('[UploadQueue] Failed to queue video:', error);
      throw error;
    }
  }

  /**
   * Process the upload queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[UploadQueue] Already processing');
      return;
    }

    if (!this.isOnline) {
      console.log('[UploadQueue] Offline, waiting for connection');
      return;
    }

    const pendingVideos = this.queue.filter(
      v => v.status === 'pending' || v.status === 'failed'
    );

    if (pendingVideos.length === 0) {
      console.log('[UploadQueue] No pending uploads');
      return;
    }

    this.isProcessing = true;
    console.log('[UploadQueue] Processing', pendingVideos.length, 'videos');

    for (const video of pendingVideos) {
      if (!this.isOnline) {
        console.log('[UploadQueue] Lost connection, pausing');
        break;
      }

      await this.uploadVideo(video);
    }

    this.isProcessing = false;
  }

  /**
   * Upload a single video
   */
  private async uploadVideo(video: QueuedVideo): Promise<void> {
    console.log('[UploadQueue] Uploading:', video.id);

    // Update status
    video.status = 'uploading';
    await this.saveQueue();
    this.notifyListeners();

    try {
      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(video.localPath);
      if (!fileInfo.exists) {
        console.error('[UploadQueue] File missing:', video.localPath);
        this.removeFromQueue(video.id);
        return;
      }

      // Upload
      await VideoUploadService.uploadVideo(
        video.localPath,
        {
          locationId: video.locationId,
          locationName: video.locationName,
          jobId: video.jobId,
          jobTitle: video.jobTitle,
          segmentNumber: video.segmentNumber,
          startedAt: video.startedAt,
          endedAt: video.endedAt,
        },
        (progress) => {
          console.log(`[UploadQueue] ${video.id} progress: ${progress.progress}%`);
        }
      );

      console.log('[UploadQueue] Upload successful:', video.id);

      // Reset online status on successful upload
      this.isOnline = true;

      // Delete local file
      await FileSystem.deleteAsync(video.localPath, { idempotent: true });

      // Remove from queue
      this.removeFromQueue(video.id);
    } catch (error: any) {
      console.error('[UploadQueue] Upload failed:', video.id, error.message);

      video.status = 'failed';
      video.lastError = error.message;
      video.retryCount += 1;

      // If we got a network error, assume offline
      if (error.message?.includes('network') || error.message?.includes('Network')) {
        this.isOnline = false;
      }

      if (video.retryCount >= MAX_RETRIES) {
        console.log('[UploadQueue] Max retries reached:', video.id);
        // Keep in queue as failed for manual retry
      } else {
        // Schedule retry
        const delay = RETRY_DELAYS[Math.min(video.retryCount - 1, RETRY_DELAYS.length - 1)];
        console.log(`[UploadQueue] Will retry in ${delay}ms`);
        setTimeout(() => {
          video.status = 'pending';
          this.saveQueue();
          this.processQueue();
        }, delay);
      }

      await this.saveQueue();
      this.notifyListeners();
    }
  }

  /**
   * Retry all failed uploads
   */
  async retryFailed(): Promise<void> {
    const failed = this.queue.filter(v => v.status === 'failed');
    for (const video of failed) {
      video.status = 'pending';
      video.retryCount = 0;
    }
    await this.saveQueue();
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Remove a video from the queue
   */
  private async removeFromQueue(id: string): Promise<void> {
    this.queue = this.queue.filter(v => v.id !== id);
    await this.saveQueue();
    this.notifyListeners();
  }

  /**
   * Clear completed/failed uploads
   */
  async clearQueue(): Promise<void> {
    // Delete all local files
    for (const video of this.queue) {
      try {
        await FileSystem.deleteAsync(video.localPath, { idempotent: true });
      } catch (e) {
        // Ignore
      }
    }
    this.queue = [];
    await this.saveQueue();
    this.notifyListeners();
  }

  /**
   * Ensure the videos directory exists
   */
  private async ensureVideosDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(VIDEOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VIDEOS_DIR, { intermediates: true });
      console.log('[UploadQueue] Created videos directory');
    }
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        this.queue = JSON.parse(data);
        // Reset any stuck "uploading" status to "pending"
        for (const video of this.queue) {
          if (video.status === 'uploading') {
            video.status = 'pending';
          }
        }
        await this.saveQueue();
      }
    } catch (error) {
      console.error('[UploadQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[UploadQueue] Failed to save queue:', error);
    }
  }

  /**
   * Start monitoring network status (simplified - no native module needed)
   */
  private startNetworkMonitoring(): void {
    // Simplified: We'll detect offline by failed uploads
    // and retry periodically instead of using NetInfo
    this.isOnline = true;
    
    // Periodic retry every 30 seconds for any pending uploads
    setInterval(() => {
      if (this.queue.some(v => v.status === 'pending' || v.status === 'failed')) {
        console.log('[UploadQueue] Periodic retry check...');
        this.isOnline = true;
        this.processQueue();
      }
    }, 30000);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }
}

export const UploadQueueService = new UploadQueueServiceClass();

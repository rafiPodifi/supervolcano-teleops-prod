/**
 * UPLOAD QUEUE SERVICE
 * Manages persistent queue of videos pending upload
 * Survives app restarts, handles offline/online transitions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { UploadedVideoArtifact, VideoUploadService } from './video-upload.service';
import { normalizeLocalFileUri } from '@/utils/local-file-uri';
import { UploadDebugLogEntry, UploadLogLevel, UploadStage } from './upload-debug.types';

const UPLOAD_TASK_NAME = 'SUPERVOLCANO_UPLOAD_QUEUE';

// Defined at module level — task callback runs when OS fires the background task.
// By that time the module is fully loaded and UploadQueueService is available.
TaskManager.defineTask(UPLOAD_TASK_NAME, async () => {
  try {
    await UploadQueueService.processQueue();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const QUEUE_STORAGE_KEY = '@upload_queue';
const DEBUG_LOGS_STORAGE_KEY = '@upload_queue_debug_logs';
const VIDEOS_DIR = `${FileSystem.documentDirectory}videos/`;
const MAX_RETRIES = 5;
const MAX_DEBUG_LOGS = 200;
const MAX_ITEM_LOGS = 25;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000];

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
  updatedAt: string;
  retryCount: number;
  progress: number;
  stage: UploadStage;
  logs: UploadDebugLogEntry[];
  lastError?: string;
  storageUrl?: string;
  uploadedFileName?: string;
  uploadedFileSize?: number;
  uploadedDurationSeconds?: number;
  remoteUploadCompletedAt?: string;
  status: 'pending' | 'uploading' | 'failed';
}

export interface QueueStatus {
  pending: number;
  uploading: number;
  failed: number;
  total: number;
}

export interface QueueDebugSnapshot {
  items: QueuedVideo[];
  logs: UploadDebugLogEntry[];
  status: QueueStatus;
  isProcessing: boolean;
  isOnline: boolean;
}

type QueueListener = (status: QueueStatus) => void;
type QueueDebugListener = (snapshot: QueueDebugSnapshot) => void;

class UploadQueueServiceClass {
  private queue: QueuedVideo[] = [];
  private debugLogs: UploadDebugLogEntry[] = [];
  private isProcessing = false;
  private isOnline = true;
  private listeners: Set<QueueListener> = new Set();
  private debugListeners: Set<QueueDebugListener> = new Set();
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;

  async initialize(): Promise<void> {
    console.log('[UploadQueue] Initializing...');

    await this.ensureVideosDirectory();
    await this.loadDebugLogs();
    await this.loadQueue();
    this.startNetworkMonitoring();
    this.appendGlobalLog('info', 'Upload queue initialized');
    this.notifyListeners();
    void this.processQueue();

    BackgroundFetch.registerTaskAsync(UPLOAD_TASK_NAME, {
      minimumInterval: 60,    // seconds; OS may call more or less frequently
      stopOnTerminate: false, // Android: keep registered after app is closed
      startOnBoot: true,      // Android: re-register after device restart
    }).catch(() => {
      // Silently ignore — task already registered or platform unsupported
    });

    console.log('[UploadQueue] Initialized with', this.queue.length, 'pending uploads');
  }

  cleanup(): void {
    this.listeners.clear();
    this.debugListeners.clear();
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    this.networkUnsubscribe?.();
    this.networkUnsubscribe = null;
    BackgroundFetch.unregisterTaskAsync(UPLOAD_TASK_NAME).catch(() => {});
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  subscribeDebug(listener: QueueDebugListener): () => void {
    this.debugListeners.add(listener);
    listener(this.getDebugSnapshot());
    return () => this.debugListeners.delete(listener);
  }

  getStatus(): QueueStatus {
    const pending = this.queue.filter(v => v.status === 'pending').length;
    const uploading = this.queue.filter(v => v.status === 'uploading').length;
    const failed = this.queue.filter(v => v.status === 'failed').length;
    return { pending, uploading, failed, total: this.queue.length };
  }

  getDebugSnapshot(): QueueDebugSnapshot {
    return {
      items: this.queue
        .map((item) => ({
          ...item,
          logs: [...item.logs],
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      logs: [...this.debugLogs],
      status: this.getStatus(),
      isProcessing: this.isProcessing,
      isOnline: this.isOnline,
    };
  }

  logDebug(
    level: UploadLogLevel,
    message: string,
    details?: string,
    stage?: UploadStage
  ): void {
    this.appendGlobalLog(level, message, stage, undefined, details);
    void this.saveDebugLogs();
    this.notifyListeners();
  }

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

    const id = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${id}.mov`;
    const persistentPath = `${VIDEOS_DIR}${filename}`;
    const now = new Date().toISOString();

    try {
      const sourceFileInfo = await FileSystem.getInfoAsync(normalizedTempVideoUri);
      if (!sourceFileInfo.exists) {
        throw new Error(
          `Source recording file not found. raw=${tempVideoUri} normalized=${normalizedTempVideoUri}`
        );
      }

      await FileSystem.copyAsync({
        from: normalizedTempVideoUri,
        to: persistentPath,
      });
      console.log('[UploadQueue] Moved video to:', persistentPath);

      const fileInfo = await FileSystem.getInfoAsync(persistentPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to persist video file');
      }

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
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        progress: 0,
        stage: 'queued',
        logs: [],
        status: 'pending',
      };

      this.appendVideoLog(
        queuedVideo,
        'info',
        'Segment queued for background upload',
        'queued',
        persistentPath
      );

      this.queue.push(queuedVideo);
      await this.persistState();

      try {
        await FileSystem.deleteAsync(normalizedTempVideoUri, { idempotent: true });
      } catch (error) {
        this.appendVideoLog(
          queuedVideo,
          'info',
          'Temporary source file could not be deleted after queueing',
          'queued',
          String(error)
        );
      }

      void this.processQueue();
      console.log('[UploadQueue] Video queued successfully:', id);
      return id;
    } catch (error: any) {
      this.appendGlobalLog(
        'error',
        'Failed to add video to upload queue',
        undefined,
        undefined,
        error?.message || String(error)
      );
      console.error('[UploadQueue] Failed to queue video:', error);
      throw error;
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      this.appendGlobalLog('info', 'Queue processing skipped because it is already running');
      return;
    }

    if (!this.isOnline) {
      this.appendGlobalLog('info', 'Queue processing paused because app is offline');
      return;
    }

    const pendingVideos = this.queue.filter(
      v => v.status === 'pending' || v.status === 'failed'
    );

    if (pendingVideos.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();
    this.appendGlobalLog('info', `Processing ${pendingVideos.length} queued upload(s)`);

    try {
      for (const video of pendingVideos) {
        if (!this.isOnline) {
          this.appendGlobalLog('info', 'Stopping queue processing after network loss');
          break;
        }

        await this.uploadVideo(video);
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  async retryFailed(): Promise<void> {
    const failed = this.queue.filter(v => v.status === 'failed');
    for (const video of failed) {
      video.status = 'pending';
      video.retryCount = 0;
      video.progress = 0;
      video.stage = 'queued';
      video.lastError = undefined;
      this.appendVideoLog(video, 'info', 'Manual retry requested', 'queued');
    }
    await this.persistState();
    void this.processQueue();
  }

  async retryItem(id: string): Promise<void> {
    const video = this.queue.find((item) => item.id === id);
    if (!video) {
      return;
    }

    video.status = 'pending';
    video.retryCount = 0;
    video.progress = 0;
    video.stage = 'queued';
    video.lastError = undefined;
    this.appendVideoLog(video, 'info', 'Manual item retry requested', 'queued');
    await this.persistState();
    void this.processQueue();
  }

  async clearQueue(): Promise<void> {
    for (const video of this.queue) {
      try {
        await FileSystem.deleteAsync(video.localPath, { idempotent: true });
      } catch {
        // Ignore cleanup failures while clearing the debug queue.
      }
    }

    this.queue = [];
    this.appendGlobalLog('info', 'Queue cleared manually');
    await this.persistState();
  }

  private async uploadVideo(video: QueuedVideo): Promise<void> {
    console.log('[UploadQueue] Uploading:', video.id);

    video.status = 'uploading';
    video.progress = 0;
    video.lastError = undefined;
    this.appendVideoLog(video, 'info', 'Upload started', 'preparing_file');
    await this.persistState();

    try {
      if (!video.storageUrl) {
        const fileInfo = await FileSystem.getInfoAsync(video.localPath);
        if (!fileInfo.exists) {
          this.appendVideoLog(video, 'error', 'Queued file is missing on disk', 'failed', video.localPath);
          await this.removeFromQueue(video.id);
          return;
        }
      }

      const uploadInput = {
        locationId: video.locationId,
        locationName: video.locationName,
        jobId: video.jobId,
        jobTitle: video.jobTitle,
        segmentNumber: video.segmentNumber,
        startedAt: video.startedAt,
        endedAt: video.endedAt,
      };

      const handleStage = (event: { stage: UploadStage; message: string; details?: string }) => {
        if (event.stage === 'failed') {
          video.status = 'failed';
          video.stage = 'failed';
          video.lastError = event.message;
          this.appendVideoLog(video, 'error', event.message, 'failed', event.details);
        } else {
          video.status = 'uploading';
          video.stage = event.stage;
          if (event.stage === 'completed') {
            video.progress = 100;
          }
          this.appendVideoLog(video, 'info', event.message, event.stage, event.details);
        }
        void this.persistState();
      };

      if (!video.storageUrl) {
        const artifact = await VideoUploadService.uploadBinary(
          video.localPath,
          uploadInput,
          (progress) => {
            video.progress = progress.progress;
            video.updatedAt = new Date().toISOString();
            this.notifyListeners();
          },
          handleStage
        );
        this.applyUploadedArtifact(video, artifact);
        this.appendVideoLog(
          video,
          'info',
          'Firebase upload completed; waiting for portal metadata save',
          'save_metadata',
          artifact.storageUrl.substring(0, 120)
        );
        await this.persistState();
      } else {
        video.progress = 100;
        this.appendVideoLog(
          video,
          'info',
          'Reusing existing Firebase upload and retrying metadata save only',
          'save_metadata',
          video.storageUrl.substring(0, 120)
        );
        await this.persistState();
      }

      await VideoUploadService.saveMetadata(
        uploadInput,
        {
          storageUrl: video.storageUrl!,
          fileName: video.uploadedFileName || `${Date.now()}-video.mp4`,
          fileSize: video.uploadedFileSize ?? 0,
          durationSeconds: video.uploadedDurationSeconds ?? 0,
        },
        handleStage
      );

      this.isOnline = true;
      video.stage = 'completed';
      video.progress = 100;
      this.appendVideoLog(video, 'info', 'Upload finished successfully', 'completed');
      await this.persistState();

      await FileSystem.deleteAsync(video.localPath, { idempotent: true });
      await this.removeFromQueue(video.id);
    } catch (error: any) {
      const message = error?.message || 'Unknown upload error';

      video.status = 'failed';
      video.stage = 'failed';
      video.lastError = message;
      video.retryCount += 1;
      this.appendVideoLog(video, 'error', message, 'failed');

      if (message.includes('network') || message.includes('Network')) {
        this.isOnline = false;
      }

      if (video.retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[Math.min(video.retryCount - 1, RETRY_DELAYS.length - 1)];
        this.appendVideoLog(video, 'info', `Retry scheduled in ${delay}ms`, 'failed');
        setTimeout(() => {
          video.status = 'pending';
          video.progress = 0;
          video.stage = 'queued';
          this.appendVideoLog(video, 'info', 'Retrying queued upload', 'queued');
          void this.persistState();
          void this.processQueue();
        }, delay);
      } else {
        this.appendVideoLog(video, 'error', 'Max retries reached; waiting for manual retry', 'failed');
      }

      await this.persistState();
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    this.queue = this.queue.filter(v => v.id !== id);
    await this.persistState();
  }

  private async ensureVideosDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(VIDEOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VIDEOS_DIR, { intermediates: true });
      console.log('[UploadQueue] Created videos directory');
    }
  }

  private normalizeQueuedVideo(item: any): QueuedVideo {
    const now = new Date().toISOString();
    return {
      id: item.id,
      localPath: item.localPath,
      locationId: item.locationId,
      locationName: item.locationName,
      jobId: item.jobId,
      jobTitle: item.jobTitle,
      segmentNumber: item.segmentNumber,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || item.createdAt || now,
      retryCount: item.retryCount ?? 0,
      progress: item.progress ?? 0,
      stage: item.stage ?? 'queued',
      logs: Array.isArray(item.logs) ? item.logs : [],
      lastError: item.lastError,
      storageUrl: item.storageUrl,
      uploadedFileName: item.uploadedFileName,
      uploadedFileSize: item.uploadedFileSize,
      uploadedDurationSeconds: item.uploadedDurationSeconds,
      remoteUploadCompletedAt: item.remoteUploadCompletedAt,
      status: item.status === 'uploading' ? 'pending' : item.status ?? 'pending',
    };
  }

  private applyUploadedArtifact(video: QueuedVideo, artifact: UploadedVideoArtifact): void {
    video.storageUrl = artifact.storageUrl;
    video.uploadedFileName = artifact.fileName;
    video.uploadedFileSize = artifact.fileSize;
    video.uploadedDurationSeconds = artifact.durationSeconds;
    video.remoteUploadCompletedAt = new Date().toISOString();
    video.progress = 100;
  }

  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (!data) {
        this.queue = [];
        return;
      }

      const parsed = JSON.parse(data);
      this.queue = Array.isArray(parsed) ? parsed.map((item) => this.normalizeQueuedVideo(item)) : [];
      for (const video of this.queue) {
        if (video.status === 'pending' && video.logs.length === 0) {
          this.appendVideoLog(video, 'info', 'Recovered queued upload from disk', video.stage);
        }
      }
      await this.saveQueue();
    } catch (error) {
      console.error('[UploadQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  private async loadDebugLogs(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(DEBUG_LOGS_STORAGE_KEY);
      this.debugLogs = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[UploadQueue] Failed to load debug logs:', error);
      this.debugLogs = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[UploadQueue] Failed to save queue:', error);
    }
  }

  private async saveDebugLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(DEBUG_LOGS_STORAGE_KEY, JSON.stringify(this.debugLogs));
    } catch (error) {
      console.error('[UploadQueue] Failed to save queue debug logs:', error);
    }
  }

  private async persistState(): Promise<void> {
    await this.saveQueue();
    await this.saveDebugLogs();
    this.notifyListeners();
  }

  private startNetworkMonitoring(): void {
    if (this.networkUnsubscribe) {
      return;
    }

    // Seed the initial connectivity state
    NetInfo.fetch().then((state) => {
      this.isOnline = state.isConnected ?? true;
    });

    this.networkUnsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = state.isConnected ?? true;
      const wasOffline = !this.isOnline;
      this.isOnline = nowOnline;

      if (nowOnline && wasOffline) {
        this.appendGlobalLog('info', 'Network reconnected — resuming upload queue');
        void this.processQueue();
      }
    });
  }

  private createLog(
    level: UploadLogLevel,
    message: string,
    stage?: UploadStage,
    itemId?: string,
    details?: string
  ): UploadDebugLogEntry {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      stage,
      itemId,
      details,
    };
  }

  private appendGlobalLog(
    level: UploadLogLevel,
    message: string,
    stage?: UploadStage,
    itemId?: string,
    details?: string
  ): void {
    const entry = this.createLog(level, message, stage, itemId, details);
    this.debugLogs = [entry, ...this.debugLogs].slice(0, MAX_DEBUG_LOGS);
  }

  private appendVideoLog(
    video: QueuedVideo,
    level: UploadLogLevel,
    message: string,
    stage?: UploadStage,
    details?: string
  ): void {
    const entry = this.createLog(level, message, stage, video.id, details);
    video.logs = [entry, ...video.logs].slice(0, MAX_ITEM_LOGS);
    video.updatedAt = entry.timestamp;
    if (level === 'error') {
      video.lastError = message;
    }
    if (stage) {
      video.stage = stage;
    }
    this.appendGlobalLog(level, message, stage, video.id, details);
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
    const snapshot = this.getDebugSnapshot();
    this.debugListeners.forEach(listener => listener(snapshot));
  }
}

export const UploadQueueService = new UploadQueueServiceClass();

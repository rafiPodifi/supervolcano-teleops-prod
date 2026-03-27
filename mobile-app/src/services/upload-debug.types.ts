export type UploadStage =
  | 'queued'
  | 'preparing_file'
  | 'start_resumable'
  | 'upload_binary'
  | 'get_download_url'
  | 'save_metadata'
  | 'completed'
  | 'failed';

export type UploadLogLevel = 'info' | 'error';

export interface UploadDebugLogEntry {
  id: string;
  timestamp: string;
  level: UploadLogLevel;
  message: string;
  stage?: UploadStage;
  itemId?: string;
  details?: string;
}

export interface UploadStageEvent {
  stage: UploadStage;
  message: string;
  details?: string;
}

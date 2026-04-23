/**
 * Hook for components to subscribe to upload queue status
 */

import { useState, useEffect } from 'react';
import { UploadQueueService, QueueStatus } from '@/services/upload-queue.service';

export function useUploadQueue() {
  const [status, setStatus] = useState<QueueStatus>({
    needsAssignment: 0,
    pending: 0,
    uploading: 0,
    failed: 0,
    total: 0,
  });

  useEffect(() => {
    void UploadQueueService.initialize();
    const unsubscribe = UploadQueueService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return {
    ...status,
    isUploading: status.uploading > 0,
    hasPending: status.pending > 0 || status.uploading > 0 || status.needsAssignment > 0,
    needsAttention: status.failed > 0 || status.needsAssignment > 0,
    retryFailed: () => UploadQueueService.retryFailed(),
  };
}

import { useEffect, useState } from 'react';
import { QueueDebugSnapshot, UploadQueueService } from '@/services/upload-queue.service';

const EMPTY_DEBUG_SNAPSHOT: QueueDebugSnapshot = {
  items: [],
  logs: [],
  status: {
    pending: 0,
    uploading: 0,
    failed: 0,
    total: 0,
  },
  isProcessing: false,
  isOnline: true,
};

export function useUploadQueueDebug() {
  const [snapshot, setSnapshot] = useState<QueueDebugSnapshot>(EMPTY_DEBUG_SNAPSHOT);

  useEffect(() => {
    const unsubscribe = UploadQueueService.subscribeDebug(setSnapshot);
    return unsubscribe;
  }, []);

  return {
    ...snapshot,
    retryFailed: () => UploadQueueService.retryFailed(),
    retryItem: (id: string) => UploadQueueService.retryItem(id),
    clearQueue: () => UploadQueueService.clearQueue(),
  };
}

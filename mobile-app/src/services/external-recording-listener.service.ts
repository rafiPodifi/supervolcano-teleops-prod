/**
 * EXTERNAL RECORDING LISTENER
 * Module-level subscriber for ExternalCamera recording events.
 *
 * Lives outside React lifecycle so `finalized` events fire even after the
 * recording screen unmounts (e.g. user navigates to SessionComplete before
 * the native encoder flushes the file).
 */

import { ExternalCamera } from "@/native/external-camera";
import { normalizeLocalFileUri } from "@/utils/local-file-uri";
import { UploadQueueService } from "./upload-queue.service";

export type TerminalOutcome =
  | { state: "finalized"; filePath: string }
  | { state: "error"; message?: string }
  | { state: "timeout" };

interface PendingSegment {
  jobTitle: string;
  recordingMode: "assigned" | "generic";
  locationId?: string;
  locationName?: string;
  jobId?: string;
  startedAt: string;
}

type ErrorHandler = (message?: string) => void;

type TerminalWaiter = {
  resolve: (outcome: TerminalOutcome) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

class ExternalRecordingListenerClass {
  private subscription: { remove: () => void } | null = null;
  private pending: PendingSegment | null = null;
  private segmentNumber = 0;
  private onError: ErrorHandler | null = null;
  private terminalWaiters: TerminalWaiter[] = [];

  private fireTerminalWaiters(outcome: TerminalOutcome): void {
    if (this.terminalWaiters.length === 0) {
      return;
    }
    const waiters = this.terminalWaiters;
    this.terminalWaiters = [];
    for (const waiter of waiters) {
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.resolve(outcome);
    }
  }

  awaitNextTerminal(timeoutMs: number): Promise<TerminalOutcome> {
    return new Promise((resolve) => {
      const waiter: TerminalWaiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const idx = this.terminalWaiters.indexOf(waiter);
        if (idx >= 0) this.terminalWaiters.splice(idx, 1);
        console.warn(
          "[ExternalRecordingListener] awaitNextTerminal timed out after",
          timeoutMs,
          "ms",
        );
        resolve({ state: "timeout" });
      }, timeoutMs);
      this.terminalWaiters.push(waiter);
    });
  }

  register(): void {
    if (this.subscription) {
      console.log("[ExternalRecordingListener] register: already subscribed");
      return;
    }
    if (!ExternalCamera.isSupported) {
      console.log(
        "[ExternalRecordingListener] register: skipped — module not available",
      );
      return;
    }

    this.subscription =
      ExternalCamera.addRecordingStateListener((event) => {
        console.log(
          "[ExternalRecordingListener] event:",
          event.state,
          "filePath=",
          event.filePath,
          "message=",
          event.message,
        );
        if (event.state === "finalized") {
          const pending = this.pending;
          this.pending = null;

          this.fireTerminalWaiters(
            event.filePath
              ? { state: "finalized", filePath: event.filePath }
              : { state: "error", message: "finalized_without_path" },
          );

          if (!event.filePath || !pending) {
            return;
          }

          const normalized = normalizeLocalFileUri(event.filePath);
          const endedAt = new Date().toISOString();
          this.segmentNumber += 1;

          void UploadQueueService.addToQueue(normalized, {
            locationId: pending.locationId,
            locationName: pending.locationName,
            jobId: pending.jobId,
            jobTitle: pending.jobTitle,
            segmentNumber: this.segmentNumber,
            startedAt: pending.startedAt,
            endedAt,
            recordingMode: pending.recordingMode,
          }).catch((error) => {
            console.error(
              "[ExternalRecordingListener] Failed to enqueue finalized recording:",
              error,
            );
          });
        } else if (event.state === "error") {
          this.pending = null;
          console.error(
            "[ExternalRecordingListener] FINALIZE FAILED:",
            event.message,
          );
          this.fireTerminalWaiters({ state: "error", message: event.message });
          this.onError?.(event.message);
        }
      }) ?? null;
    console.log(
      "[ExternalRecordingListener] register: subscription=",
      this.subscription !== null,
    );
  }

  unregister(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.onError = null;
    this.fireTerminalWaiters({ state: "timeout" });
  }

  beginSegment(payload: PendingSegment): void {
    this.pending = payload;
  }

  cancelPending(): void {
    this.pending = null;
  }

  setErrorHandler(handler: ErrorHandler | null): void {
    this.onError = handler;
  }
}

export const ExternalRecordingListener = new ExternalRecordingListenerClass();

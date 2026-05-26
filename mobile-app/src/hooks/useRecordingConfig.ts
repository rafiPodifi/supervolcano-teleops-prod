import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/config/firebase";

export type RecordingConfig = {
  externalCamera: {
    quality: "highest" | "fhd" | "hd" | "sd";
    enableAudio: boolean;
  };
  nativeCamera: {
    enableAudio: boolean;
    zoom: number;
  };
  inactivityTimeoutMinutes: number;
  /** Auto-segment duration in seconds. Applies to both CameraScreen and MemberRecordScreen. Default 300 (5 min). */
  segmentDurationSeconds: number;
};

const DEFAULTS: RecordingConfig = {
  externalCamera: { quality: "hd", enableAudio: false },
  nativeCamera: { enableAudio: true, zoom: 0.5 },
  inactivityTimeoutMinutes: 15,
  segmentDurationSeconds: 300,
};

/** Clamp segment duration to safe range. Prevents tight-loop DoS from bad admin config. */
const MIN_SEGMENT_SECONDS = 30;
const MAX_SEGMENT_SECONDS = 3600; // 1 hour
function clampSegmentDuration(value: unknown): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULTS.segmentDurationSeconds;
  return Math.max(MIN_SEGMENT_SECONDS, Math.min(MAX_SEGMENT_SECONDS, n));
}

export function useRecordingConfig(): RecordingConfig {
  const [config, setConfig] = useState<RecordingConfig>(DEFAULTS);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, "config", "recording-settings"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            externalCamera: {
              ...DEFAULTS.externalCamera,
              ...data.externalCamera,
            },
            nativeCamera: { ...DEFAULTS.nativeCamera, ...data.nativeCamera },
            inactivityTimeoutMinutes:
              data.inactivityTimeoutMinutes ??
              DEFAULTS.inactivityTimeoutMinutes,
            segmentDurationSeconds: clampSegmentDuration(
              data.segmentDurationSeconds,
            ),
          });
        }
      },
      () => {
        // Silently fall back to defaults on permission error or offline
      },
    );
    return unsub;
  }, []);

  return config;
}

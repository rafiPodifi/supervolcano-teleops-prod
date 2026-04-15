import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

export type RecordingConfig = {
  externalCamera: {
    quality: 'highest' | 'fhd' | 'hd' | 'sd';
    enableAudio: boolean;
  };
  nativeCamera: {
    enableAudio: boolean;
    zoom: number;
  };
  inactivityTimeoutMinutes: number;
};

const DEFAULTS: RecordingConfig = {
  externalCamera: { quality: 'hd', enableAudio: false },
  nativeCamera: { enableAudio: true, zoom: 0.5 },
  inactivityTimeoutMinutes: 15,
};

export function useRecordingConfig(): RecordingConfig {
  const [config, setConfig] = useState<RecordingConfig>(DEFAULTS);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'config', 'recording-settings'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            externalCamera: { ...DEFAULTS.externalCamera, ...data.externalCamera },
            nativeCamera: { ...DEFAULTS.nativeCamera, ...data.nativeCamera },
            inactivityTimeoutMinutes: data.inactivityTimeoutMinutes ?? DEFAULTS.inactivityTimeoutMinutes,
          });
        }
      },
      () => {
        // Silently fall back to defaults on permission error or offline
      }
    );
    return unsub;
  }, []);

  return config;
}

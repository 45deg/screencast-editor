import { useMemo } from 'react';

import { getScreenRecordingExtension, getScreenRecordingMimeType, toErrorMessage } from '../appUtils';
import { useScreenCapture } from './useScreenCapture';

interface UseAppScreenCaptureArgs {
  onImportVideo: (file: File) => Promise<void>;
  onImportError: (message: string | null) => void;
  resetExportState: () => void;
  t: (key: string) => string;
}

export function useAppScreenCapture({
  onImportVideo,
  onImportError,
  resetExportState,
  t,
}: UseAppScreenCaptureArgs) {
  const supportsScreenCapture = useMemo(() => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return false;
    }

    return Boolean(navigator.mediaDevices?.getDisplayMedia);
  }, []);

  const { screenCaptureState, handleStartScreenCapture, handleStopScreenCapture } = useScreenCapture({
    supportsScreenCapture,
    onPrepareStart: () => {
      onImportError(null);
      resetExportState();
    },
    onImportVideo,
    onImportError: (message) => onImportError(message),
    toErrorMessage,
    getScreenRecordingMimeType,
    getScreenRecordingExtension,
    t,
  });

  return {
    supportsScreenCapture,
    screenCaptureState,
    handleStartScreenCapture,
    handleStopScreenCapture,
  };
}

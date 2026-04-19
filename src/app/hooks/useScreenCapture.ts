import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_CAPTURE_DIMENSION = 4096;
const MAX_CAPTURE_FPS = 30;

const CAPTURE_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { max: MAX_CAPTURE_DIMENSION },
  height: { max: MAX_CAPTURE_DIMENSION },
  frameRate: { ideal: MAX_CAPTURE_FPS, max: MAX_CAPTURE_FPS },
};

function canRetryWithoutCaptureConstraints(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof DOMException) {
    return error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError';
  }

  return false;
}

interface UseScreenCaptureArgs {
  supportsScreenCapture: boolean;
  onPrepareStart: () => void;
  onImportVideo: (file: File) => Promise<void>;
  onImportError: (message: string) => void;
  toErrorMessage: (error: unknown) => string;
  getScreenRecordingMimeType: () => string;
  getScreenRecordingExtension: (mimeType: string) => string;
  t: (key: string) => string;
}

export function useScreenCapture({
  supportsScreenCapture,
  onPrepareStart,
  onImportVideo,
  onImportError,
  toErrorMessage,
  getScreenRecordingMimeType,
  getScreenRecordingExtension,
  t,
}: UseScreenCaptureArgs) {
  const captureRecorderRef = useRef<MediaRecorder | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureChunksRef = useRef<Blob[]>([]);
  const [screenCaptureState, setScreenCaptureState] = useState<
    'idle' | 'starting' | 'recording' | 'processing'
  >('idle');

  const finishScreenCapture = useCallback(async () => {
    const recorder = captureRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    captureStreamRef.current?.getVideoTracks().forEach((track) => {
      track.onended = null;
    });
    setScreenCaptureState('processing');

    const file = await new Promise<File>((resolve, reject) => {
      const mimeType = recorder.mimeType || getScreenRecordingMimeType() || 'video/webm';
      const extension = getScreenRecordingExtension(mimeType);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          captureChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        reject(new Error(t('dropzone.captureFailed')));
      };

      recorder.onstop = () => {
        const blob = new Blob(captureChunksRef.current, { type: mimeType });
        captureChunksRef.current = [];

        if (!blob.size) {
          reject(new Error(t('dropzone.emptyCapture')));
          return;
        }

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        resolve(new File([blob], `screen-capture-${stamp}.${extension}`, { type: blob.type || mimeType }));
      };

      recorder.stop();
    });

    captureRecorderRef.current = null;
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;

    await onImportVideo(file);
    setScreenCaptureState('idle');
  }, [getScreenRecordingExtension, getScreenRecordingMimeType, onImportVideo, t]);

  const handleStartScreenCapture = useCallback(async () => {
    if (!supportsScreenCapture || screenCaptureState !== 'idle') {
      return;
    }

    onPrepareStart();
    setScreenCaptureState('starting');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: CAPTURE_VIDEO_CONSTRAINTS,
          audio: false,
        });
      } catch (error) {
        if (!canRetryWithoutCaptureConstraints(error)) {
          throw error;
        }

        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      }

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
        try {
          await videoTrack.applyConstraints(CAPTURE_VIDEO_CONSTRAINTS);
        } catch {
          // Some browsers ignore or reject display-track constraints. Keep recording with defaults.
        }
      }

      const mimeType = getScreenRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      captureChunksRef.current = [];
      captureStreamRef.current = stream;
      captureRecorderRef.current = recorder;

      if (videoTrack) {
        videoTrack.onended = () => {
          const activeRecorder = captureRecorderRef.current;
          if (activeRecorder && activeRecorder.state === 'recording') {
            void finishScreenCapture().catch((error: unknown) => {
              onImportError(toErrorMessage(error));
              setScreenCaptureState('idle');
            });
          } else {
            setScreenCaptureState('idle');
          }
        };
      }

      recorder.start();
      setScreenCaptureState('recording');
    } catch (error) {
      onImportError(toErrorMessage(error));
      captureRecorderRef.current = null;
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
      captureChunksRef.current = [];
      setScreenCaptureState('idle');
    }
  }, [
    finishScreenCapture,
    getScreenRecordingMimeType,
    onImportError,
    onPrepareStart,
    screenCaptureState,
    supportsScreenCapture,
    toErrorMessage,
  ]);

  const handleStopScreenCapture = useCallback(() => {
    if (captureRecorderRef.current?.state !== 'recording') {
      setScreenCaptureState('idle');
      return;
    }

    void finishScreenCapture().catch((error: unknown) => {
      onImportError(toErrorMessage(error));
      setScreenCaptureState('idle');
    });
  }, [finishScreenCapture, onImportError, toErrorMessage]);

  useEffect(() => {
    return () => {
      captureRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      captureRecorderRef.current = null;
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    };
  }, []);

  return {
    screenCaptureState,
    handleStartScreenCapture,
    handleStopScreenCapture,
  };
}

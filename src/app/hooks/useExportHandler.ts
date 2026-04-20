import { useCallback, useRef, useState } from 'react';

import { exportVideoToMp4, ensureBrowserExportRuntimeReady } from '../../lib/browserExport';
import type {
  AnnotationModel,
  CropRect,
  ExportSettings,
  SliceModel,
  VideoMeta,
} from '../../types/editor';
import type { ExportRuntimeStatus } from '../../store/editorStore';
import { getSafeDownloadName, toErrorMessage } from '../appUtils';

interface UseExportHandlerArgs {
  sources: VideoMeta[];
  slices: SliceModel[];
  annotations: AnnotationModel[];
  baseCrop: CropRect | null;
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  totalDuration: number;
  t: (key: string, options?: Record<string, unknown>) => string;
  setExportRuntimeStatus: (status: ExportRuntimeStatus, error?: string | null) => void;
  exportVideo?: typeof exportVideoToMp4;
}

export function useExportHandler({
  sources,
  slices,
  annotations,
  baseCrop,
  globalCrop,
  exportSettings,
  totalDuration,
  t,
  setExportRuntimeStatus,
  exportVideo = exportVideoToMp4,
}: UseExportHandlerArgs) {
  const runtimeStatusRef = useRef<ExportRuntimeStatus>('idle');
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportProgressLabel, setExportProgressLabel] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const syncExportRuntimeStatusRef = useCallback((status: ExportRuntimeStatus) => {
    runtimeStatusRef.current = status;
  }, []);

  const resetExportState = useCallback(() => {
    setExportError(null);
    setExportProgress(null);
    setExportProgressLabel(null);
  }, []);

  const isAbortError = useCallback((error: unknown) => {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return 'name' in error && (error as { name?: unknown }).name === 'AbortError';
  }, []);

  const cancelExport = useCallback(() => {
    const controller = exportAbortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    setIsCancelling(true);
    setExportProgressLabel(t('app.exportStageCanceling'));
    controller.abort();
  }, [t]);

  const ensureExportRuntimeReady = useCallback(async () => {
    if (runtimeStatusRef.current === 'ready') {
      return true;
    }

    if (runtimeStatusRef.current !== 'loading') {
      setExportRuntimeStatus('loading', null);
      runtimeStatusRef.current = 'loading';
    }

    try {
      await ensureBrowserExportRuntimeReady();
      setExportRuntimeStatus('ready', null);
      runtimeStatusRef.current = 'ready';
      return true;
    } catch (error) {
      const message = toErrorMessage(error);
      setExportRuntimeStatus('error', message);
      runtimeStatusRef.current = 'error';
      return false;
    }
  }, [setExportRuntimeStatus]);

  const handleExport = useCallback(async () => {
    const primaryVideo = sources[0] ?? null;

    if (!primaryVideo || !slices.length || !baseCrop) {
      return;
    }

    if (isExporting) {
      return;
    }

    const downloadName = getSafeDownloadName(primaryVideo.file.name, 'mp4');
    const exportAbortController = new AbortController();
    const { signal } = exportAbortController;
    const runtimeWasReadyAtStart = runtimeStatusRef.current === 'ready';
    let runtimeReadyForReuse = runtimeWasReadyAtStart;

    const updateExportProgress = (nextProgress: number, label: string) => {
      const safeProgress = Math.max(0, Math.min(100, Math.round(nextProgress)));
      setExportProgress(safeProgress);
      setExportProgressLabel(label);
    };

    setIsExporting(true);
    setIsCancelling(false);
    setExportError(null);
    exportAbortControllerRef.current = exportAbortController;
    updateExportProgress(4, t('app.exportStagePreparing'));

    let exportSucceeded = false;

    try {
      setExportRuntimeStatus('loading', null);
      runtimeStatusRef.current = 'loading';
      updateExportProgress(12, t('app.exportStageLoadingRuntime'));

      const blob = await exportVideo({
        sources,
        slices,
        annotations,
        globalCrop,
        exportSettings,
        totalDuration,
        signal,
        onProgress: (progress) => {
          if (progress >= 14) {
            runtimeReadyForReuse = true;
          }
          if (progress < 30) {
            updateExportProgress(progress, t('app.exportStageLoadingRuntime'));
            return;
          }

          if (progress < 36) {
            updateExportProgress(progress, t('app.exportStagePreparingFrames'));
            return;
          }

          if (progress < 94) {
            updateExportProgress(progress, t('app.exportStageEncoding'));
            return;
          }

          updateExportProgress(progress, t('app.exportStageMuxing'));
        },
      });

      if (signal.aborted) {
        throw new DOMException('Export was cancelled', 'AbortError');
      }

      setExportRuntimeStatus('ready', null);
      runtimeStatusRef.current = 'ready';
      updateExportProgress(100, t('app.exportStageDone'));

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      exportSucceeded = true;
    } catch (error) {
      if (isAbortError(error)) {
        setExportError(null);
        const nextStatus = runtimeReadyForReuse ? 'ready' : 'idle';
        setExportRuntimeStatus(nextStatus, null);
        runtimeStatusRef.current = nextStatus;
      } else {
        console.error('[export][mp4] failed', {
          error,
          videoName: primaryVideo.file.name,
          exportSettings,
          sliceCount: slices.length,
          annotationCount: annotations.length,
          totalDuration,
        });
        const message = toErrorMessage(error);
        setExportError(message);
        setExportRuntimeStatus('error', message);
        runtimeStatusRef.current = 'error';
      }
      setExportProgress(null);
      setExportProgressLabel(null);
    } finally {
      exportAbortControllerRef.current = null;
      setIsExporting(false);
      setIsCancelling(false);
      if (exportSucceeded) {
        window.setTimeout(() => {
          setExportProgress(null);
          setExportProgressLabel(null);
        }, 900);
      }
    }
  }, [
    annotations,
    baseCrop,
    exportSettings,
    globalCrop,
    isAbortError,
    isExporting,
    setExportRuntimeStatus,
    slices,
    t,
    totalDuration,
    sources,
    exportVideo,
  ]);

  return {
    isExporting,
    isCancelling,
    exportProgress,
    exportProgressLabel,
    exportError,
    ensureExportRuntimeReady,
    handleExport,
    cancelExport,
    resetExportState,
    syncExportRuntimeStatusRef,
  };
}

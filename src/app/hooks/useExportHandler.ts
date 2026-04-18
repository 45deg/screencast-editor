import { useCallback, useRef, useState } from 'react';

import { buildFfmpegCommand } from '../../lib/ffmpegCommand';
import type { BuildFfmpegCommandResult } from '../../lib/ffmpegCommand';
import { loadFfmpegRuntimeFromCDN } from '../../lib/ffmpegClient';
import { rasterizeAnnotationsToOverlays } from '../../lib/overlayRasterizer';
import type {
  AnnotationModel,
  CropRect,
  ExportSettings,
  SliceModel,
  VideoMeta,
} from '../../types/editor';
import { getFileExtension, getSafeDownloadName, toErrorMessage } from '../appUtils';

interface UseExportHandlerArgs {
  video: VideoMeta | null;
  slices: SliceModel[];
  annotations: AnnotationModel[];
  baseCrop: CropRect | null;
  globalCrop: CropRect | null;
  exportSettings: ExportSettings;
  totalDuration: number;
  t: (key: string, options?: Record<string, unknown>) => string;
  setFfmpegStatus: (status: 'idle' | 'loading' | 'ready' | 'error', error?: string | null) => void;
}

export function useExportHandler({
  video,
  slices,
  annotations,
  baseCrop,
  globalCrop,
  exportSettings,
  totalDuration,
  t,
  setFfmpegStatus,
}: UseExportHandlerArgs) {
  const ffmpegStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportProgressLabel, setExportProgressLabel] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const syncFfmpegStatusRef = useCallback((status: 'idle' | 'loading' | 'ready' | 'error') => {
    ffmpegStatusRef.current = status;
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

  const ensureFfmpegRuntimeReady = useCallback(async () => {
    if (ffmpegStatusRef.current === 'ready') {
      return true;
    }

    if (ffmpegStatusRef.current !== 'loading') {
      setFfmpegStatus('loading', null);
      ffmpegStatusRef.current = 'loading';
    }

    try {
      await loadFfmpegRuntimeFromCDN();
      setFfmpegStatus('ready', null);
      ffmpegStatusRef.current = 'ready';
      return true;
    } catch (error) {
      const message = toErrorMessage(error);
      setFfmpegStatus('error', message);
      ffmpegStatusRef.current = 'error';
      return false;
    }
  }, [setFfmpegStatus]);

  const createCommandPreview = useCallback(
    (
      inputFileName?: string,
      outputFileName?: string,
      overlayInputs?: Array<{ fileName: string; start: number; end: number }>,
    ) => {
      if (!video || !slices.length) {
        return null;
      }

      return buildFfmpegCommand({
        video,
        slices,
        globalCrop,
        exportSettings,
        inputFileName,
        outputFileName,
        overlayInputs,
        outputDuration: totalDuration,
      });
    },
    [exportSettings, globalCrop, slices, totalDuration, video],
  );

  const logFfmpegCommandPreview = useCallback(
    (built: { command: string; filterComplex: string }, note?: string) => {
      console.groupCollapsed('FFmpeg command preview');
      console.log(built.command);
      console.log(built.filterComplex);
      if (note) {
        console.log(note);
      }
      console.groupEnd();
    },
    [],
  );

  const handleExport = useCallback(async () => {
    if (!video || !slices.length || !baseCrop) {
      return;
    }

    if (isExporting) {
      return;
    }

    const runId = crypto.randomUUID().slice(0, 8);
    const inputExt = getFileExtension(video.file.name, 'mp4');
    const inputFileName = `input-${runId}.${inputExt}`;
    const outputFileName = `output-${runId}.${exportSettings.format}`;
    const downloadName = getSafeDownloadName(video.file.name, exportSettings.format);
    const exportAbortController = new AbortController();
    const { signal } = exportAbortController;
    let runtimeLoaded = false;

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
    let runtime: Awaited<ReturnType<typeof loadFfmpegRuntimeFromCDN>> | null = null;
    let progressCallback: ((event: { progress: number; time: number }) => void) | null = null;
    let overlayFileNames: string[] = [];
    let builtCommand: BuildFfmpegCommandResult | null = null;
    let exportSucceeded = false;

    try {
      setFfmpegStatus('loading', null);
      updateExportProgress(12, t('app.exportStageLoadingRuntime'));
      runtime = await loadFfmpegRuntimeFromCDN(signal);
      runtimeLoaded = true;
      setFfmpegStatus('ready', null);
      const activeRuntime = runtime;

      if (!activeRuntime) {
        throw new Error(t('app.unknownError'));
      }

      if (signal.aborted) {
        throw new DOMException('Export was cancelled', 'AbortError');
      }

      updateExportProgress(28, t('app.exportStageRasterizingOverlay'));
      const rasterizedOverlays = await rasterizeAnnotationsToOverlays(
        annotations,
        baseCrop,
        exportSettings.width,
        exportSettings.height,
      );
      overlayFileNames = rasterizedOverlays.map((overlay) => overlay.fileName);

      if (signal.aborted) {
        throw new DOMException('Export was cancelled', 'AbortError');
      }

      const built = createCommandPreview(
        inputFileName,
        outputFileName,
        rasterizedOverlays.map((overlay) => ({
          fileName: overlay.fileName,
          start: overlay.start,
          end: overlay.end,
        })),
      );
      if (!built) {
        throw new Error(t('app.noExportTarget'));
      }

      builtCommand = built;
      logFfmpegCommandPreview(built);

      updateExportProgress(42, t('app.exportStageWritingInput'));
      if (signal.aborted) {
        throw new DOMException('Export was cancelled', 'AbortError');
      }
      const source = await activeRuntime.fetchFile(video.file);
      await activeRuntime.ffmpeg.writeFile(inputFileName, source);

      if (rasterizedOverlays.length > 0) {
        updateExportProgress(54, t('app.exportStageWritingOverlay'));
      }

      const overlayProgressStep = rasterizedOverlays.length > 0 ? 14 / rasterizedOverlays.length : 0;
      for (let index = 0; index < rasterizedOverlays.length; index += 1) {
        if (signal.aborted) {
          throw new DOMException('Export was cancelled', 'AbortError');
        }

        const overlay = rasterizedOverlays[index];
        const overlayFile = new File([overlay.blob], overlay.fileName, { type: 'image/png' });
        const overlayBytes = await activeRuntime.fetchFile(overlayFile);
        await activeRuntime.ffmpeg.writeFile(overlay.fileName, overlayBytes);
        if (overlayProgressStep > 0) {
          updateExportProgress(
            54 + overlayProgressStep * (index + 1),
            t('app.exportStageWritingOverlay'),
          );
        }
      }

      updateExportProgress(72, t('app.exportStageEncoding'));
      const encodingDurationMicros = Math.max(1, Math.round(totalDuration * 1_000_000));
      progressCallback = ({ progress, time }) => {
        const timeNormalized = Number.isFinite(time) ? time / encodingDurationMicros : Number.NaN;
        const normalized = Number.isFinite(timeNormalized)
          ? Math.max(0, Math.min(1, timeNormalized))
          : Math.max(0, Math.min(1, progress));
        const encodingProgress = 72 + normalized * 24;
        setExportProgress((current) => {
          const baseline = current ?? 72;
          const next = Math.max(baseline, Math.round(encodingProgress));
          return Math.min(96, next);
        });
        setExportProgressLabel(t('app.exportStageEncoding'));
      };
      activeRuntime.ffmpeg.on('progress', progressCallback);
      const exitCode = await activeRuntime.ffmpeg.exec(built.execArgs, undefined, { signal });

      if (exitCode !== 0) {
        throw new Error(t('app.ffmpegExecutionFailed', { code: exitCode }));
      }

      updateExportProgress(97, t('app.exportStageFinalizing'));
      const output = await activeRuntime.ffmpeg.readFile(outputFileName, undefined, { signal });
      const outputBytes = typeof output === 'string' ? new TextEncoder().encode(output) : new Uint8Array(output);
      const mimeType = exportSettings.format === 'gif' ? 'image/gif' : 'video/mp4';
      const blob = new Blob([outputBytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      link.click();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      exportSucceeded = true;
      updateExportProgress(100, t('app.exportStageDone'));
    } catch (error) {
      if (!isAbortError(error) && exportSettings.format === 'mp4') {
        console.error('[export][mp4] failed', {
          error,
          command: builtCommand?.command,
          filterComplex: builtCommand?.filterComplex,
          execArgs: builtCommand?.execArgs,
          exportSettings,
        });
      }
      if (isAbortError(error)) {
        setExportError(null);
        setFfmpegStatus(runtimeLoaded ? 'ready' : 'idle', null);
      } else {
        const message = toErrorMessage(error);
        setExportError(message);
        setFfmpegStatus('error', message);
      }
      setExportProgress(null);
      setExportProgressLabel(null);
    } finally {
      exportAbortControllerRef.current = null;
      if (runtime && progressCallback) {
        runtime.ffmpeg.off('progress', progressCallback);
      }

      if (runtime && typeof runtime.ffmpeg.deleteFile === 'function') {
        const cleanupRuntime = runtime;
        const cleanupTargets = [inputFileName, outputFileName, ...overlayFileNames];
        await Promise.allSettled([
          ...cleanupTargets.map((fileName) => cleanupRuntime.ffmpeg.deleteFile(fileName)),
        ]);
      }

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
    createCommandPreview,
    exportSettings,
    exportSettings.format,
    exportSettings.height,
    exportSettings.width,
    isAbortError,
    isExporting,
    logFfmpegCommandPreview,
    setFfmpegStatus,
    slices.length,
    totalDuration,
    t,
    video,
  ]);

  return {
    isExporting,
    isCancelling,
    exportProgress,
    exportProgressLabel,
    exportError,
    setExportError,
    ensureFfmpegRuntimeReady,
    handleExport,
    cancelExport,
    resetExportState,
    syncFfmpegStatusRef,
  };
}

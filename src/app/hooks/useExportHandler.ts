import { useCallback, useRef, useState } from 'react';

import { buildFfmpegCommand } from '../../lib/ffmpegCommand';
import { loadFfmpegRuntimeFromCDN } from '../../lib/ffmpegClient';
import { rasterizeAnnotationsToOverlays } from '../../lib/overlayRasterizer';
import type { AnnotationModel, CropRect, ExportSettings, SliceModel, VideoMeta } from '../../types/editor';
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
  const [isExporting, setIsExporting] = useState(false);
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

    const runId = crypto.randomUUID().slice(0, 8);
    const inputExt = getFileExtension(video.file.name, 'mp4');
    const inputFileName = `input-${runId}.${inputExt}`;
    const outputFileName = `output-${runId}.${exportSettings.format}`;
    const downloadName = getSafeDownloadName(video.file.name, exportSettings.format);

    const updateExportProgress = (nextProgress: number, label: string) => {
      const safeProgress = Math.max(0, Math.min(100, Math.round(nextProgress)));
      setExportProgress(safeProgress);
      setExportProgressLabel(label);
    };

    setIsExporting(true);
    setExportError(null);
    updateExportProgress(4, t('app.exportStagePreparing'));
    let runtime: Awaited<ReturnType<typeof loadFfmpegRuntimeFromCDN>> | null = null;
    let progressCallback: ((event: { progress: number; time: number }) => void) | null = null;
    let overlayFileNames: string[] = [];
    let exportSucceeded = false;

    try {
      setFfmpegStatus('loading', null);
      updateExportProgress(12, t('app.exportStageLoadingRuntime'));
      runtime = await loadFfmpegRuntimeFromCDN();
      setFfmpegStatus('ready', null);
      const activeRuntime = runtime;

      if (!activeRuntime) {
        throw new Error(t('app.unknownError'));
      }

      updateExportProgress(28, t('app.exportStageRasterizingOverlay'));
      const rasterizedOverlays = await rasterizeAnnotationsToOverlays(
        annotations,
        baseCrop,
        exportSettings.width,
        exportSettings.height,
      );
      overlayFileNames = rasterizedOverlays.map((overlay) => overlay.fileName);

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

      logFfmpegCommandPreview(built);

      updateExportProgress(42, t('app.exportStageWritingInput'));
      const source = await activeRuntime.fetchFile(video.file);
      await activeRuntime.ffmpeg.writeFile(inputFileName, source);

      if (rasterizedOverlays.length > 0) {
        updateExportProgress(54, t('app.exportStageWritingOverlay'));
      }

      const overlayProgressStep = rasterizedOverlays.length > 0 ? 14 / rasterizedOverlays.length : 0;
      for (let index = 0; index < rasterizedOverlays.length; index += 1) {
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
      progressCallback = ({ progress }) => {
        const normalized = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
        const encodingProgress = 72 + normalized * 24;
        setExportProgress((current) => {
          const baseline = current ?? 72;
          const next = Math.max(baseline, Math.round(encodingProgress));
          return Math.min(96, next);
        });
        setExportProgressLabel(t('app.exportStageEncoding'));
      };
      activeRuntime.ffmpeg.on('progress', progressCallback);
      const exitCode = await activeRuntime.ffmpeg.exec(built.execArgs);

      if (exitCode !== 0) {
        throw new Error(t('app.ffmpegExecutionFailed', { code: exitCode }));
      }

      updateExportProgress(97, t('app.exportStageFinalizing'));
      const output = await activeRuntime.ffmpeg.readFile(outputFileName);
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
      const message = toErrorMessage(error);
      setExportError(message);
      setFfmpegStatus('error', message);
      setExportProgress(null);
      setExportProgressLabel(null);
    } finally {
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
    exportSettings.format,
    exportSettings.height,
    exportSettings.width,
    logFfmpegCommandPreview,
    setFfmpegStatus,
    slices.length,
    t,
    video,
  ]);

  return {
    isExporting,
    exportProgress,
    exportProgressLabel,
    exportError,
    setExportError,
    ensureFfmpegRuntimeReady,
    handleExport,
    resetExportState,
    syncFfmpegStatusRef,
  };
}

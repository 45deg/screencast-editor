import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { ChevronLeft, Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import CanvasPreview from './components/CanvasPreview';
import PropertyPanel from './components/PropertyPanel';
import SliceEditorTimeline from './components/SliceEditor';
import VideoDropzone from './components/VideoDropzone';
import { i18n } from './i18n';
import { buildFfmpegCommand } from './lib/ffmpegCommand';
import { loadFfmpegRuntimeFromCDN } from './lib/ffmpegClient';
import { readVideoMetadata, revokeVideoObjectUrl } from './lib/video';
import { useEditorStore } from './store/editorStore';
import {
  deriveSlices,
  findSliceAtTimelineTime,
  getSourceTimeAtTimelineTime,
  getTotalDuration,
  type CropRect,
  type SliceModel,
  type VideoMeta,
} from './types/editor';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t('app.unknownError');
}

function getDefaultCrop(width: number, height: number): CropRect {
  return {
    x: 0,
    y: 0,
    w: width,
    h: height,
  };
}

function clampCropToVideo(crop: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(crop.y)));
  const maxW = Math.max(1, video.width - x);
  const maxH = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(crop.w))),
    h: Math.max(1, Math.min(maxH, Math.round(crop.h))),
  };
}

function normalizeCropForStorage(crop: CropRect, video: VideoMeta): CropRect | null {
  const safe = clampCropToVideo(crop, video);

  if (safe.x === 0 && safe.y === 0 && safe.w === video.width && safe.h === video.height) {
    return null;
  }

  return safe;
}

function findSliceIdAtTimelineTime(slices: SliceModel[], time: number): string | null {
  const derived = deriveSlices(slices);
  const hit = derived.find((slice) => time >= slice.start && time < slice.end);

  if (hit) {
    return hit.id;
  }

  if (derived.length && time >= derived[derived.length - 1].end) {
    return derived[derived.length - 1].id;
  }

  return derived[0]?.id ?? null;
}

function getFileExtension(fileName: string, fallback: string): string {
  const index = fileName.lastIndexOf('.');
  if (index <= 0 || index === fileName.length - 1) {
    return fallback;
  }

  return fileName.slice(index + 1).replace(/[^a-zA-Z0-9]/g, '') || fallback;
}

function getSafeDownloadName(fileName: string, format: 'gif' | 'mp4'): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${base || 'export'}-edited.${format}`;
}

function getFirstVideoFile(files: FileList | null): File | null {
  if (!files?.length) {
    return null;
  }

  return Array.from(files).find((file) => file.type.startsWith('video/')) ?? null;
}

export default function App() {
  const { t } = useTranslation();
  const ffmpegStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cropEditMode, setCropEditMode] = useState<'idle' | 'crop' | 'scene'>('idle');
  const [cropEditDraft, setCropEditDraft] = useState<CropRect | null>(null);
  const [sceneCropTargetSliceId, setSceneCropTargetSliceId] = useState<string | null>(null);
  const [isMobileSettingsDrawerOpen, setIsMobileSettingsDrawerOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  const {
    video,
    slices,
    currentTime,
    selectedSliceId,
    globalCrop,
    exportSettings,
    ffmpegStatus,
    ffmpegError,
    past,
    future,
    setVideo,
    clearVideo,
    setCurrentTime,
    setSelectedSliceId,
    replaceSlicesPreview,
    replaceSlicesCommit,
    setGlobalCropCommit,
    setSliceCropCommit,
    updateExportSettings,
    setFfmpegStatus,
    undo,
    redo,
  } = useEditorStore();

  useEffect(() => {
    ffmpegStatusRef.current = ffmpegStatus;
  }, [ffmpegStatus]);

  const fullCrop = useMemo(() => {
    if (!video) {
      return null;
    }

    return getDefaultCrop(video.width, video.height);
  }, [video]);

  const baseCrop = useMemo(() => {
    if (!video || !fullCrop) {
      return null;
    }

    return globalCrop ?? fullCrop;
  }, [fullCrop, globalCrop, video]);

  const previewSlice = useMemo(() => findSliceAtTimelineTime(slices, currentTime), [currentTime, slices]);

  const activeSceneCrop = useMemo(() => {
    if (!previewSlice?.crop || !video) {
      return null;
    }

    return clampCropToVideo(previewSlice.crop, video);
  }, [previewSlice, video]);

  const hasVideo = Boolean(video && baseCrop);
  const totalDuration = useMemo(() => getTotalDuration(slices), [slices]);
  const previewSourceTime = useMemo(() => getSourceTimeAtTimelineTime(slices, currentTime), [currentTime, slices]);

  const outputAspectRatio = useMemo(
    () => exportSettings.width / Math.max(1, exportSettings.height),
    [exportSettings.height, exportSettings.width],
  );

  const isCropEditing = cropEditMode !== 'idle';

  const effectiveEditCrop = useMemo(() => {
    if (!video || !isCropEditing || !fullCrop) {
      return null;
    }

    return clampCropToVideo(cropEditDraft ?? fullCrop, video);
  }, [cropEditDraft, fullCrop, isCropEditing, video]);

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

  useEffect(() => {
    void ensureFfmpegRuntimeReady();
  }, [ensureFfmpegRuntimeReady]);

  useEffect(() => {
    setCropEditMode('idle');
    setCropEditDraft(null);
    setSceneCropTargetSliceId(null);
  }, [video?.objectUrl]);

  useEffect(() => {
    if (!hasVideo) {
      setIsMobileSettingsDrawerOpen(false);
    }
  }, [hasVideo]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (isDesktopViewport && isMobileSettingsDrawerOpen) {
      setIsMobileSettingsDrawerOpen(false);
    }
  }, [isDesktopViewport, isMobileSettingsDrawerOpen]);

  const handleImportVideo = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setImportError(null);
      setExportError(null);

      try {
        const nextVideo = await readVideoMetadata(file);

        if (video) {
          revokeVideoObjectUrl(video);
        }

        setVideo(nextVideo);
        void ensureFfmpegRuntimeReady();
      } catch (error) {
        setImportError(toErrorMessage(error));
      } finally {
        setIsImporting(false);
      }
    },
    [ensureFfmpegRuntimeReady, setVideo, video],
  );

  const handleReturnToLanding = useCallback(() => {
    if (video) {
      revokeVideoObjectUrl(video);
    }

    clearVideo();
    setImportError(null);
    setExportError(null);
  }, [clearVideo, video]);

  const closeCropEditor = useCallback(() => {
    setCropEditMode('idle');
    setCropEditDraft(null);
    setSceneCropTargetSliceId(null);
  }, []);

  const handleStartCropEdit = useCallback(() => {
    if (!video || !fullCrop) {
      return;
    }

    const initial = globalCrop ? clampCropToVideo(globalCrop, video) : fullCrop;
    setCropEditMode('crop');
    setSceneCropTargetSliceId(null);
    setCropEditDraft(initial);
  }, [fullCrop, globalCrop, video]);

  const handleStartSceneCropEdit = useCallback(() => {
    if (!video || !slices.length || !baseCrop) {
      return;
    }

    const targetSliceId = selectedSliceId ?? findSliceIdAtTimelineTime(slices, currentTime);
    if (!targetSliceId) {
      return;
    }

    const targetSlice = slices.find((slice) => slice.id === targetSliceId);
    if (!targetSlice) {
      return;
    }

    setSelectedSliceId(targetSliceId);
    setCropEditMode('scene');
    setSceneCropTargetSliceId(targetSliceId);
    setCropEditDraft(targetSlice.crop ? clampCropToVideo(targetSlice.crop, video) : baseCrop);
  }, [baseCrop, currentTime, selectedSliceId, setSelectedSliceId, slices, video]);

  const handleEditCropPreview = useCallback(
    (crop: CropRect) => {
      if (!video) {
        return;
      }

      setCropEditDraft(clampCropToVideo(crop, video));
    },
    [video],
  );

  const handleConfirmCropEdit = useCallback(() => {
    if (!video || !effectiveEditCrop) {
      closeCropEditor();
      return;
    }

    const nextCrop = normalizeCropForStorage(effectiveEditCrop, video);

    if (cropEditMode === 'crop') {
      setGlobalCropCommit(nextCrop);
      closeCropEditor();
      return;
    }

    if (cropEditMode === 'scene' && sceneCropTargetSliceId) {
      setSliceCropCommit(sceneCropTargetSliceId, nextCrop);
    }

    closeCropEditor();
  }, [
    closeCropEditor,
    cropEditMode,
    effectiveEditCrop,
    sceneCropTargetSliceId,
    setGlobalCropCommit,
    setSliceCropCommit,
    video,
  ]);

  const handleCancelCropEdit = useCallback(() => {
    closeCropEditor();
  }, [closeCropEditor]);

  const handleResetCropEdit = useCallback(() => {
    if (!fullCrop) {
      return;
    }

    setCropEditDraft(fullCrop);
  }, [fullCrop]);

  const createCommandPreview = useCallback(
    (inputFileName?: string, outputFileName?: string) => {
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
      });
    },
    [exportSettings, globalCrop, slices, video],
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
    if (!video || !slices.length) {
      return;
    }

    const runId = crypto.randomUUID().slice(0, 8);
    const inputExt = getFileExtension(video.file.name, 'mp4');
    const inputFileName = `input-${runId}.${inputExt}`;
    const outputFileName = `output-${runId}.${exportSettings.format}`;
    const downloadName = getSafeDownloadName(video.file.name, exportSettings.format);

    setIsExporting(true);
    setExportError(null);
    let runtime: Awaited<ReturnType<typeof loadFfmpegRuntimeFromCDN>> | null = null;

    try {
      setFfmpegStatus('loading', null);
      runtime = await loadFfmpegRuntimeFromCDN();
      setFfmpegStatus('ready', null);

      const built = createCommandPreview(inputFileName, outputFileName);
      if (!built) {
        throw new Error(t('app.noExportTarget'));
      }

      logFfmpegCommandPreview(built);

      const source = await runtime.fetchFile(video.file);
      await runtime.ffmpeg.writeFile(inputFileName, source);
      const exitCode = await runtime.ffmpeg.exec(built.execArgs);

      if (exitCode !== 0) {
        throw new Error(t('app.ffmpegExecutionFailed', { code: exitCode }));
      }

      const output = await runtime.ffmpeg.readFile(outputFileName);
      const outputBytes = typeof output === 'string' ? new TextEncoder().encode(output) : new Uint8Array(output);
      const mimeType = exportSettings.format === 'gif' ? 'image/gif' : 'video/mp4';
      const blob = new Blob([outputBytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      link.click();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
      const message = toErrorMessage(error);
      setExportError(message);
      setFfmpegStatus('error', message);
    } finally {
      if (runtime && typeof runtime.ffmpeg.deleteFile === 'function') {
        await Promise.allSettled([
          runtime.ffmpeg.deleteFile(inputFileName),
          runtime.ffmpeg.deleteFile(outputFileName),
        ]);
      }

      setIsExporting(false);
    }
  }, [
    createCommandPreview,
    exportSettings.format,
    logFfmpegCommandPreview,
    setFfmpegStatus,
    slices.length,
    video,
  ]);

  useEffect(() => {
    if (!baseCrop) {
      return;
    }

    const nextHeight = Math.max(64, Math.min(4096, Math.round((exportSettings.width * baseCrop.h) / Math.max(1, baseCrop.w))));
    if (nextHeight !== exportSettings.height) {
      updateExportSettings({ height: nextHeight, keepAspectRatio: true });
    }
  }, [baseCrop, exportSettings.height, exportSettings.width, updateExportSettings]);

  useEffect(() => {
    return () => {
      revokeVideoObjectUrl(useEditorStore.getState().video);
    };
  }, []);

  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) {
        return;
      }

      const nextFile = getFirstVideoFile(event.dataTransfer.files);
      if (!nextFile) {
        return;
      }

      event.preventDefault();

      if (video && !window.confirm(t('app.replaceVideoConfirm'))) {
        return;
      }

      void handleImportVideo(nextFile);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleImportVideo, video]);

  return (
    <Drawer.Root open={isMobileSettingsDrawerOpen} onOpenChange={setIsMobileSettingsDrawerOpen}>
      <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(160deg,#020617_0%,#0b1120_42%,#111827_100%)] text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_92%_4%,rgba(16,185,129,0.2),transparent_30%)]" />

        <header className="relative z-10 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {hasVideo ? (
                <button
                  type="button"
                  onClick={handleReturnToLanding}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
                  aria-label={t('app.back')}
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold">Screencast Editor</h1>
            </div>

            <div className="flex items-center gap-2">
              {hasVideo && baseCrop ? (
                <Drawer.Trigger
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-400/25 lg:hidden"
                >
                  <Download size={14} />
                  {t('app.export')}
                </Drawer.Trigger>
              ) : null}
            </div>
          </div>
        </header>

        <main
          className={`relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 ${
            hasVideo ? 'pb-[260px] sm:pb-[300px] lg:pb-4' : ''
          }`}
        >
          <section className={`grid gap-4 ${hasVideo ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'justify-items-center'}`}>
            {hasVideo && video && baseCrop ? (
              <CanvasPreview
                video={video}
                fileName={video.file.name}
                currentTime={currentTime}
                sourceTime={previewSourceTime}
                totalDuration={totalDuration}
                baseCrop={baseCrop}
                activeSceneCrop={activeSceneCrop}
                editMode={cropEditMode}
                editCrop={effectiveEditCrop}
                onStartCrop={handleStartCropEdit}
                onEditCropPreview={handleEditCropPreview}
                onConfirmEdit={handleConfirmCropEdit}
                onCancelEdit={handleCancelCropEdit}
                onResetEdit={handleResetCropEdit}
                onCurrentTimeChange={setCurrentTime}
              />
            ) : (
              <VideoDropzone onFileSelected={handleImportVideo} isLoading={isImporting} error={importError} mode="embedded" />
            )}

            {hasVideo && baseCrop ? (
              <>
                <div className="hidden lg:block">
                  <PropertyPanel
                    baseCrop={baseCrop}
                    exportSettings={exportSettings}
                    ffmpegStatus={ffmpegStatus}
                    ffmpegError={ffmpegError}
                    isExporting={isExporting}
                    exportError={exportError}
                    onChangeExportSettings={updateExportSettings}
                    onExport={handleExport}
                  />
                </div>
              </>
            ) : null}
          </section>
        </main>

        {hasVideo && video && baseCrop ? (
          <div className="fixed inset-x-0 bottom-0 z-20 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 lg:static lg:mx-auto lg:w-full lg:max-w-[1500px] lg:px-6 lg:pb-0 lg:pt-0">
            <SliceEditorTimeline
              video={video}
              slices={slices}
              currentTime={currentTime}
              selectedSliceId={selectedSliceId}
              canStartSceneCrop={slices.length > 0}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
              onCurrentTimeChange={setCurrentTime}
              onSelectedSliceIdChange={setSelectedSliceId}
              onStartSceneCrop={handleStartSceneCropEdit}
              onSlicesPreview={replaceSlicesPreview}
              onSlicesCommit={replaceSlicesCommit}
              baseCrop={baseCrop}
              outputAspectRatio={outputAspectRatio}
              onUndo={undo}
              onRedo={redo}
            />
          </div>
        ) : null}
      </div>

      {hasVideo && baseCrop && !isDesktopViewport ? (
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Drawer.Popup className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] rounded-t-2xl border border-slate-800/90 bg-slate-950 outline-none data-[starting-style]:translate-y-6 data-[ending-style]:translate-y-6 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
            <Drawer.Content className="flex h-full max-h-[88vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
                <div>
                  <Drawer.Title className="text-sm font-semibold text-slate-100">{t('app.outputSettings')}</Drawer.Title>
                  <p className="text-[11px] text-slate-400">{t('app.outputSettingsDescription')}</p>
                </div>

                <Drawer.Close className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100">
                  <X size={13} />
                  {t('app.close')}
                </Drawer.Close>
              </div>

              <div className="timeline-scrollbar flex-1 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
                <PropertyPanel
                  baseCrop={baseCrop}
                  exportSettings={exportSettings}
                  ffmpegStatus={ffmpegStatus}
                  ffmpegError={ffmpegError}
                  isExporting={isExporting}
                  exportError={exportError}
                  onChangeExportSettings={updateExportSettings}
                  onExport={handleExport}
                  className="border-none bg-transparent p-0 shadow-none lg:w-full"
                />
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Portal>
      ) : null}
    </Drawer.Root>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Replace } from 'lucide-react';

import CanvasPreview from './components/CanvasPreview';
import PropertyPanel from './components/PropertyPanel';
import SliceEditorTimeline from './components/SliceEditor';
import VideoDropzone from './components/VideoDropzone';
import { buildFfmpegCommand } from './lib/ffmpegCommand';
import { loadFfmpegRuntimeFromCDN } from './lib/ffmpegClient';
import { readVideoMetadata, revokeVideoObjectUrl } from './lib/video';
import { useEditorStore } from './store/editorStore';
import { deriveSlices, type CropRect } from './types/editor';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return '不明なエラーが発生しました。';
}

function getDefaultCrop(width: number, height: number): CropRect {
  return {
    x: 0,
    y: 0,
    w: width,
    h: height,
  };
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

export default function App() {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const {
    video,
    slices,
    currentTime,
    selectedSliceId,
    globalCrop,
    exportSettings,
    commandPreview,
    ffmpegStatus,
    ffmpegError,
    past,
    future,
    setVideo,
    setCurrentTime,
    setSelectedSliceId,
    replaceSlicesPreview,
    replaceSlicesCommit,
    setGlobalCropPreview,
    setGlobalCropCommit,
    setSelectedSliceCropPreview,
    setSelectedSliceCropCommit,
    updateExportSettings,
    setCommandPreview,
    setFfmpegStatus,
    undo,
    redo,
  } = useEditorStore();

  const derivedSlices = useMemo(() => deriveSlices(slices), [slices]);
  const selectedSlice = useMemo(
    () => slices.find((slice) => slice.id === selectedSliceId) ?? null,
    [selectedSliceId, slices],
  );
  const selectedDerivedSlice = useMemo(
    () => derivedSlices.find((slice) => slice.id === selectedSliceId) ?? null,
    [derivedSlices, selectedSliceId],
  );

  const baseCrop = useMemo(() => {
    if (!video) {
      return null;
    }

    return globalCrop ?? getDefaultCrop(video.width, video.height);
  }, [globalCrop, video]);

  const activeCrop = useMemo(() => {
    if (!video) {
      return null;
    }

    if (selectedSlice?.crop) {
      return selectedSlice.crop;
    }

    return baseCrop ?? getDefaultCrop(video.width, video.height);
  }, [baseCrop, selectedSlice, video]);

  const hasVideo = Boolean(video && baseCrop && activeCrop);

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
      } catch (error) {
        setImportError(toErrorMessage(error));
      } finally {
        setIsImporting(false);
      }
    },
    [setVideo, video],
  );

  const handleReplaceVideo = useCallback(() => {
    replaceInputRef.current?.click();
  }, []);

  const handleCropPreview = useCallback(
    (crop: CropRect) => {
      if (selectedSliceId) {
        setSelectedSliceCropPreview(crop);
      } else {
        setGlobalCropPreview(crop);
      }
    },
    [selectedSliceId, setGlobalCropPreview, setSelectedSliceCropPreview],
  );

  const handleCropCommit = useCallback(
    (crop: CropRect) => {
      if (selectedSliceId) {
        setSelectedSliceCropCommit(crop);
      } else {
        setGlobalCropCommit(crop);
      }
    },
    [selectedSliceId, setGlobalCropCommit, setSelectedSliceCropCommit],
  );

  const handleLoadFfmpeg = useCallback(async () => {
    setFfmpegStatus('loading', null);
    try {
      await loadFfmpegRuntimeFromCDN();
      setFfmpegStatus('ready', null);
    } catch (error) {
      setFfmpegStatus('error', toErrorMessage(error));
    }
  }, [setFfmpegStatus]);

  const createCommandPreview = useCallback(
    (inputFileName?: string, outputFileName?: string) => {
      if (!video || !slices.length || !baseCrop) {
        return null;
      }

      return buildFfmpegCommand({
        video,
        slices,
        globalCrop: baseCrop,
        exportSettings,
        inputFileName,
        outputFileName,
      });
    },
    [baseCrop, exportSettings, slices, video],
  );

  const handleGenerateCommandPreview = useCallback(() => {
    const built = createCommandPreview();
    if (!built) {
      return;
    }

    setCommandPreview(`${built.command}\n\n# filter_complex\n${built.filterComplex}`);
  }, [createCommandPreview, setCommandPreview]);

  const handleExport = useCallback(async () => {
    if (!video || !slices.length || !baseCrop) {
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
        throw new Error('エクスポート対象がありません。');
      }

      setCommandPreview(`${built.command}\n\n# filter_complex\n${built.filterComplex}`);

      const source = await runtime.fetchFile(video.file);
      await runtime.ffmpeg.writeFile(inputFileName, source);
      const exitCode = await runtime.ffmpeg.exec(built.execArgs);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg 実行が失敗しました (exit code: ${exitCode})`);
      }

      const output = await runtime.ffmpeg.readFile(outputFileName);
      const outputBytes = new Uint8Array(output);
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
  }, [baseCrop, createCommandPreview, exportSettings.format, setCommandPreview, setFfmpegStatus, slices.length, video]);

  useEffect(() => {
    if (!baseCrop || !exportSettings.keepAspectRatio) {
      return;
    }

    const nextHeight = Math.max(64, Math.min(4096, Math.round((exportSettings.width * baseCrop.h) / Math.max(1, baseCrop.w))));
    if (nextHeight !== exportSettings.height) {
      updateExportSettings({ height: nextHeight });
    }
  }, [baseCrop, exportSettings.height, exportSettings.keepAspectRatio, exportSettings.width, updateExportSettings]);

  useEffect(() => {
    return () => {
      revokeVideoObjectUrl(useEditorStore.getState().video);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(160deg,#020617_0%,#0b1120_42%,#111827_100%)] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_92%_4%,rgba(16,185,129,0.2),transparent_30%)]" />

      <header className="relative z-10 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold">Screencast Editor</h1>
            <p className="text-xs text-slate-400">
              {video
                ? `${video.file.name} | ${video.width}x${video.height} | ${video.duration.toFixed(2)}s`
                : '動画を読み込むとここにメタデータを表示します'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleReplaceVideo}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
          >
            <Replace size={14} />
            {video ? '動画を差し替え' : '動画を読み込む'}
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {hasVideo && video && activeCrop ? (
            <CanvasPreview
              video={video}
              currentTime={currentTime}
              selectedSlice={selectedSlice}
              activeCrop={activeCrop}
              onCropPreview={handleCropPreview}
              onCropCommit={handleCropCommit}
            />
          ) : (
            <VideoDropzone onFileSelected={handleImportVideo} isLoading={isImporting} error={importError} mode="embedded" />
          )}

          {hasVideo && baseCrop ? (
            <PropertyPanel
              selectedSlice={selectedSlice}
              baseCrop={baseCrop}
              exportSettings={exportSettings}
              ffmpegStatus={ffmpegStatus}
              ffmpegError={ffmpegError}
              commandPreview={commandPreview}
              isExporting={isExporting}
              exportError={exportError}
              onChangeExportSettings={updateExportSettings}
              onSelectGlobalCrop={() => setSelectedSliceId(null)}
              onLoadFfmpeg={handleLoadFfmpeg}
              onGenerateCommandPreview={handleGenerateCommandPreview}
              onExport={handleExport}
            />
          ) : (
            <aside className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-xl lg:w-[360px]">
              <h2 className="font-['Space_Grotesk',sans-serif] text-lg font-semibold text-slate-100">Property Panel</h2>
              <p className="mt-1 text-xs text-slate-400">動画を読み込むと出力設定を編集できます。</p>
              <div className="mt-4 space-y-2">
                <div className="h-10 animate-pulse rounded-md bg-slate-900" />
                <div className="h-10 animate-pulse rounded-md bg-slate-900/90" />
                <div className="h-10 animate-pulse rounded-md bg-slate-900/80" />
                <div className="h-28 animate-pulse rounded-lg bg-slate-900/70" />
              </div>
            </aside>
          )}
        </section>

        {hasVideo ? (
          <SliceEditorTimeline
            slices={slices}
            currentTime={currentTime}
            selectedSliceId={selectedSliceId}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onCurrentTimeChange={setCurrentTime}
            onSelectedSliceIdChange={setSelectedSliceId}
            onSlicesPreview={replaceSlicesPreview}
            onSlicesCommit={replaceSlicesCommit}
            onUndo={undo}
            onRedo={redo}
          />
        ) : (
          <section className="relative z-10 flex h-[280px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-xl">
            <div className="h-14 border-b border-slate-800/80 bg-slate-950/95 px-4" />
            <div className="flex-1 px-4 py-6">
              <div className="h-6 w-28 animate-pulse rounded bg-slate-900" />
              <div className="mt-3 h-20 w-full animate-pulse rounded bg-slate-900/90" />
              <div className="mt-3 h-20 w-3/4 animate-pulse rounded bg-slate-900/80" />
            </div>
          </section>
        )}

        {hasVideo && baseCrop ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Download size={13} />
                Export Baseline
              </span>
              <span className="font-mono text-cyan-100">
                base={baseCrop.w}x{baseCrop.h}
              </span>
              <span className="font-mono text-slate-400">
                crop-mode={selectedDerivedSlice ? `slice:${selectedDerivedSlice.id.slice(0, 8)}` : 'global'}
              </span>
            </div>
          </div>
        ) : null}
      </main>

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        accept="video/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImportVideo(file);
          }
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}

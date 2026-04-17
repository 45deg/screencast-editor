import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Replace, Undo2 } from 'lucide-react';

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

export default function App() {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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
    clearVideo,
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

  const handleImportVideo = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setImportError(null);

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

  const handleResetToDropzone = useCallback(() => {
    if (video) {
      revokeVideoObjectUrl(video);
    }
    clearVideo();
    setImportError(null);
    setCommandPreview('');
    setFfmpegStatus('idle', null);
  }, [clearVideo, setCommandPreview, setFfmpegStatus, video]);

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

  const handleGenerateCommandPreview = useCallback(() => {
    if (!video || !slices.length || !baseCrop) {
      return;
    }

    const built = buildFfmpegCommand({
      video,
      slices,
      globalCrop: baseCrop,
      exportSettings,
    });

    setCommandPreview(`${built.command}\n\n# filter_complex\n${built.filterComplex}`);
  }, [baseCrop, exportSettings, setCommandPreview, slices, video]);

  useEffect(() => {
    return () => {
      revokeVideoObjectUrl(useEditorStore.getState().video);
    };
  }, []);

  if (!video) {
    return <VideoDropzone onFileSelected={handleImportVideo} isLoading={isImporting} error={importError} />;
  }

  if (!baseCrop || !activeCrop) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(160deg,#020617_0%,#0b1120_42%,#111827_100%)] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_92%_4%,rgba(16,185,129,0.2),transparent_30%)]" />

      <header className="relative z-10 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold">Screencast Editor</h1>
            <p className="text-xs text-slate-400">
              {video.file.name} | {video.width}x{video.height} | {video.duration.toFixed(2)}s
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReplaceVideo}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
            >
              <Replace size={14} />
              動画を差し替え
            </button>
            <button
              type="button"
              onClick={handleResetToDropzone}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-400/60 hover:text-amber-100"
            >
              <Undo2 size={14} />
              ドロップ画面へ戻る
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <CanvasPreview
            video={video}
            currentTime={currentTime}
            selectedSlice={selectedSlice}
            activeCrop={activeCrop}
            onCropPreview={handleCropPreview}
            onCropCommit={handleCropCommit}
          />

          <PropertyPanel
            selectedSlice={selectedSlice}
            baseCrop={baseCrop}
            exportSettings={exportSettings}
            ffmpegStatus={ffmpegStatus}
            ffmpegError={ffmpegError}
            commandPreview={commandPreview}
            onChangeExportSettings={updateExportSettings}
            onLoadFfmpeg={handleLoadFfmpeg}
            onGenerateCommandPreview={handleGenerateCommandPreview}
          />
        </section>

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

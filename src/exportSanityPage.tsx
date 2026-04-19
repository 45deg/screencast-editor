import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useExportHandler } from './app/hooks/useExportHandler';
import { revokeVideoObjectUrl, readVideoMetadata } from './lib/video';
import { exportVideoToMp4, type BrowserExportDiagnostics } from './lib/browserExport';
import { DEFAULT_EXPORT_SETTINGS } from './store/editorStoreHelpers';
import { DEFAULT_TEXT_ANNOTATION_STYLE, getTotalDuration, type AnnotationModel, type ExportSettings, type SliceModel, type VideoMeta } from './types/editor';

type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

const EXPORT_MESSAGES: Record<string, string> = {
  'app.noExportTarget': 'There is nothing to export.',
  'app.exportStagePreparing': 'Preparing export',
  'app.exportStageLoadingRuntime': 'Loading export runtime',
  'app.exportStagePreparingFrames': 'Preparing frames',
  'app.exportStageEncoding': 'Encoding',
  'app.exportStageMuxing': 'Muxing MP4',
  'app.exportStageCanceling': 'Cancelling export',
  'app.exportStageDone': 'Done',
  'app.unknownError': 'Unknown error',
};

function getExportMessage(key: string) {
  return EXPORT_MESSAGES[key] ?? key;
}

function createSlices(video: VideoMeta | null): SliceModel[] {
  if (!video) {
    return [];
  }

  return [
    {
      id: 'sanity-slice',
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: video.duration,
      duration: video.duration,
      crop: null,
    },
  ];
}

function createAnnotations(video: VideoMeta | null): AnnotationModel[] {
  if (!video) {
    return [];
  }

  return [
    {
      id: 'sanity-label',
      kind: 'text',
      start: 0.1,
      duration: Math.max(0.5, Math.min(0.9, video.duration - 0.1)),
      x: 16,
      y: 16,
      text: 'sanity export',
      style: {
        ...DEFAULT_TEXT_ANNOTATION_STYLE,
        fontSize: 24,
        boxColor: '#0f172acc',
      },
    },
  ];
}

export default function ExportSanityPage() {
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('idle');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string>('No export yet.');
  const [runtimeDelayMs, setRuntimeDelayMs] = useState(0);
  const [demuxerDelayMs, setDemuxerDelayMs] = useState(0);
  const [demuxerCreatedCount, setDemuxerCreatedCount] = useState(0);
  const [demuxerDestroyedCount, setDemuxerDestroyedCount] = useState(0);
  const lastBlobSizeRef = useRef<number | null>(null);

  const slices = useMemo(() => createSlices(video), [video]);
  const annotations = useMemo(() => createAnnotations(video), [video]);
  const totalDuration = useMemo(() => getTotalDuration(slices, annotations), [annotations, slices]);

  useEffect(() => {
    return () => {
      revokeVideoObjectUrl(video);
    };
  }, [video]);

  const handleRuntimeStatusChange = useCallback((status: RuntimeStatus, error?: string | null) => {
    setRuntimeStatus(status);
    setRuntimeError(error ?? null);
  }, []);

  const delayStage = useCallback(async (delayMs: number, signal?: AbortSignal) => {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, delayMs);
      const abortHandler = () => {
        window.clearTimeout(timer);
        reject(new DOMException('Export was cancelled', 'AbortError'));
      };

      if (signal?.aborted) {
        abortHandler();
        return;
      }

      signal?.addEventListener('abort', abortHandler, { once: true });
    });
  }, []);

  const exportVideo = useCallback(
    async (input: Parameters<typeof exportVideoToMp4>[0]) => {
      lastBlobSizeRef.current = null;

      const diagnostics: BrowserExportDiagnostics = {
        beforeRuntimeReady: async (signal) => delayStage(runtimeDelayMs, signal),
        beforeDemuxerLoad: async (signal) => delayStage(demuxerDelayMs, signal),
        onDemuxerCreated: () => setDemuxerCreatedCount((count) => count + 1),
        onDemuxerDestroyed: () => setDemuxerDestroyedCount((count) => count + 1),
      };

      const blob = await exportVideoToMp4({
        ...input,
        diagnostics,
      });

      lastBlobSizeRef.current = blob.size;
      return blob;
    },
    [delayStage, demuxerDelayMs, runtimeDelayMs],
  );

  const {
    isExporting,
    isCancelling,
    exportProgress,
    exportProgressLabel,
    exportError,
    handleExport,
    cancelExport,
    syncExportRuntimeStatusRef,
  } = useExportHandler({
    video,
    slices,
    annotations,
    baseCrop: video ? { x: 0, y: 0, w: video.width, h: video.height } : null,
    globalCrop: null,
    exportSettings,
    totalDuration,
    t: (key) => getExportMessage(key),
    setExportRuntimeStatus: handleRuntimeStatusChange,
    exportVideo,
  });

  useEffect(() => {
    syncExportRuntimeStatusRef(runtimeStatus);
  }, [runtimeStatus, syncExportRuntimeStatusRef]);

  useEffect(() => {
    if (isExporting) {
      setResultText('Export in progress...');
      return;
    }

    if (exportError) {
      setResultText('Export failed.');
      return;
    }

    if (lastBlobSizeRef.current) {
      setResultText(`Exported MP4 (${lastBlobSizeRef.current} bytes).`);
      return;
    }

    if (isCancelling) {
      setResultText('Cancelling export...');
    }
  }, [exportError, isCancelling, isExporting]);

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    const nextVideo = await readVideoMetadata(file);
    setVideo((current) => {
      revokeVideoObjectUrl(current);
      return nextVideo;
    });
    setRuntimeStatus('idle');
    setRuntimeError(null);
    setResultText('Video loaded.');
    lastBlobSizeRef.current = null;
    setExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      width: nextVideo.width,
      height: nextVideo.height,
    });
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Export Sanity Check</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            This page exercises the browser export pipeline directly for deterministic Playwright regression checks.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl lg:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-200">
            <span>Source video</span>
            <input
              data-testid="video-input"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              onChange={(event) => {
                void handleFileChange(event.target.files?.[0] ?? null);
              }}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-200">
              <span>Runtime delay (ms)</span>
              <input
                data-testid="runtime-delay-ms"
                type="number"
                min={0}
                step={50}
                value={runtimeDelayMs}
                className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                onChange={(event) => setRuntimeDelayMs(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Demuxer delay (ms)</span>
              <input
                data-testid="demuxer-delay-ms"
                type="number"
                min={0}
                step={50}
                value={demuxerDelayMs}
                className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                onChange={(event) => setDemuxerDelayMs(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              data-testid="start-export"
              type="button"
              disabled={!video || isExporting}
              className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                lastBlobSizeRef.current = null;
                setResultText('Export requested.');
                void handleExport();
              }}
            >
              Start export
            </button>

            <button
              data-testid="cancel-export"
              type="button"
              disabled={!isExporting}
              className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={cancelExport}
            >
              Cancel export
            </button>
          </div>

          <dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Runtime status</dt>
              <dd data-testid="runtime-status" className="font-mono text-slate-100">
                {runtimeStatus}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Export progress</dt>
              <dd data-testid="export-progress" className="font-mono text-slate-100">
                {exportProgress ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Demuxer created</dt>
              <dd data-testid="demuxer-created-count" className="font-mono text-slate-100">
                {demuxerCreatedCount}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Demuxer destroyed</dt>
              <dd data-testid="demuxer-destroyed-count" className="font-mono text-slate-100">
                {demuxerDestroyedCount}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Stage</dt>
              <dd className="font-mono text-slate-100">{exportProgressLabel ?? 'idle'}</dd>
            </div>
          </dl>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p data-testid="export-error" className="min-h-6 text-sm text-rose-200">
              {runtimeError ?? exportError ?? ''}
            </p>
            <p data-testid="export-result" className="text-sm text-cyan-100">
              {resultText}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

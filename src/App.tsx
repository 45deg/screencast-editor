import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Drawer } from '@base-ui/react/drawer';
import { ChevronLeft, CircleHelp, Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Group, Panel, Separator } from 'react-resizable-panels';

import CanvasPreview from './components/CanvasPreview';
import PropertyPanel from './components/PropertyPanel';
import SliceEditorTimeline from './components/SliceEditor';
import VideoDropzone from './components/VideoDropzone';
import { i18n } from './i18n';
import { buildFfmpegCommand } from './lib/ffmpegCommand';
import { loadFfmpegRuntimeFromCDN } from './lib/ffmpegClient';
import { readImageMetaFromObjectUrl } from './lib/image';
import { rasterizeAnnotationsToOverlays } from './lib/overlayRasterizer';
import { readVideoMetadata, revokeVideoObjectUrl } from './lib/video';
import { useEditorStore } from './store/editorStore';
import {
  DEFAULT_TEXT_ANNOTATION_STYLE,
  deriveSlices,
  findSliceAtTimelineTime,
  getActiveAnnotationsAtTimelineTime,
  getSourceTimeAtTimelineTime,
  getTotalDuration,
  type AnnotationModel,
  type AnnotationTextStyle,
  type CropRect,
  type SliceModel,
  type TextAnnotation,
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

  if (derived.length) {
    const latest = [...derived].sort((a, b) => a.end - b.end)[derived.length - 1];
    if (latest && time >= latest.end) {
      return latest.id;
    }
  }

  return null;
}

function revokeAnnotationImageUrls(annotations: AnnotationModel[]): void {
  for (const annotation of annotations) {
    if (annotation.kind !== 'image') {
      continue;
    }

    URL.revokeObjectURL(annotation.imageUrl);
  }
}

function clampAnnotationPosition(annotation: AnnotationModel, nextX: number, nextY: number, baseCrop: CropRect) {
  if (annotation.kind === 'image') {
    return {
      x: Math.max(0, Math.min(baseCrop.w - annotation.width, Math.round(nextX))),
      y: Math.max(0, Math.min(baseCrop.h - annotation.height, Math.round(nextY))),
    };
  }

  return {
    x: Math.max(0, Math.min(baseCrop.w - 8, Math.round(nextX))),
    y: Math.max(0, Math.min(baseCrop.h - 8, Math.round(nextY))),
  };
}

function clampImageAnnotationRect(
  baseCrop: CropRect,
  nextX: number,
  nextY: number,
  nextWidth: number,
  nextHeight: number,
) {
  const width = Math.max(24, Math.min(baseCrop.w, Math.round(nextWidth)));
  const height = Math.max(24, Math.min(baseCrop.h, Math.round(nextHeight)));

  return {
    x: Math.max(0, Math.min(baseCrop.w - width, Math.round(nextX))),
    y: Math.max(0, Math.min(baseCrop.h - height, Math.round(nextY))),
    width,
    height,
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

function getFirstVideoFile(files: FileList | null): File | null {
  if (!files?.length) {
    return null;
  }

  return Array.from(files).find((file) => file.type.startsWith('video/')) ?? null;
}

function getFirstImageFile(files: FileList | null): File | null {
  if (!files?.length) {
    return null;
  }

  return Array.from(files).find((file) => file.type.startsWith('image/')) ?? null;
}

function formatDurationLabel(duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) {
    return '0:00';
  }

  const rounded = Math.round(duration);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function getScreenRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function getScreenRecordingExtension(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

export default function App() {
  const { t } = useTranslation();
  const ffmpegStatusRef = useRef<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const captureRecorderRef = useRef<MediaRecorder | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureChunksRef = useRef<Blob[]>([]);
  const pendingAnnotationPreviewRef = useRef<AnnotationModel[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportProgressLabel, setExportProgressLabel] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cropEditMode, setCropEditMode] = useState<'idle' | 'crop' | 'scene'>('idle');
  const [cropEditDraft, setCropEditDraft] = useState<CropRect | null>(null);
  const [sceneCropTargetSliceId, setSceneCropTargetSliceId] = useState<string | null>(null);
  const [isMobileSettingsDrawerOpen, setIsMobileSettingsDrawerOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [screenCaptureState, setScreenCaptureState] = useState<'idle' | 'starting' | 'recording' | 'processing'>('idle');

  const {
    video,
    slices,
    annotations,
    currentTime,
    selectedSliceId,
    selectedAnnotationId,
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
    setSelectedAnnotationId,
    replaceSlicesPreview,
    replaceSlicesCommit,
    replaceAnnotationsPreview,
    replaceAnnotationsCommit,
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

  const activeAnnotations = useMemo(
    () => getActiveAnnotationsAtTimelineTime(annotations, currentTime),
    [annotations, currentTime],
  );

  const selectedTextAnnotation = useMemo(() => {
    const selected = annotations.find((annotation) => annotation.id === selectedAnnotationId);
    if (!selected || selected.kind !== 'text') {
      return null;
    }

    return selected as TextAnnotation;
  }, [annotations, selectedAnnotationId]);

  const hasVideo = Boolean(video && baseCrop);
  const totalDuration = useMemo(() => getTotalDuration(slices, annotations), [annotations, slices]);
  const previewSourceTime = useMemo(() => getSourceTimeAtTimelineTime(slices, currentTime), [currentTime, slices]);
  const videoInfoItems = useMemo(() => {
    if (!video) {
      return [];
    }

    return [
      `${video.width}x${video.height}`,
      formatDurationLabel(video.duration),
      formatFileSize(video.file.size),
    ];
  }, [video]);

  const outputAspectRatio = useMemo(
    () => exportSettings.width / Math.max(1, exportSettings.height),
    [exportSettings.height, exportSettings.width],
  );

  const isCropEditing = cropEditMode !== 'idle';
  const supportsScreenCapture = useMemo(() => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return false;
    }

    return Boolean(navigator.mediaDevices?.getDisplayMedia);
  }, []);

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
    pendingAnnotationPreviewRef.current = null;
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
      setExportProgress(null);
      setExportProgressLabel(null);

      try {
        const nextVideo = await readVideoMetadata(file);

        if (video) {
          revokeVideoObjectUrl(video);
        }
        revokeAnnotationImageUrls(annotations);

        setVideo(nextVideo);
        void ensureFfmpegRuntimeReady();
      } catch (error) {
        setImportError(toErrorMessage(error));
      } finally {
        setIsImporting(false);
      }
    },
    [annotations, ensureFfmpegRuntimeReady, setVideo, video],
  );

  const handleReturnToLanding = useCallback(() => {
    if (video) {
      revokeVideoObjectUrl(video);
    }
    revokeAnnotationImageUrls(annotations);

    clearVideo();
    setImportError(null);
    setExportError(null);
    setExportProgress(null);
    setExportProgressLabel(null);
  }, [annotations, clearVideo, video]);

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
    setSelectedAnnotationId(null);
    setCropEditMode('crop');
    setSceneCropTargetSliceId(null);
    setCropEditDraft(initial);
  }, [fullCrop, globalCrop, setSelectedAnnotationId, video]);

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

    setSelectedAnnotationId(null);
    setSelectedSliceId(targetSliceId);
    setCropEditMode('scene');
    setSceneCropTargetSliceId(targetSliceId);
    setCropEditDraft(targetSlice.crop ? clampCropToVideo(targetSlice.crop, video) : baseCrop);
  }, [baseCrop, currentTime, selectedSliceId, setSelectedAnnotationId, setSelectedSliceId, slices, video]);

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

  const handleCreateTextAnnotation = useCallback(() => {
    if (!baseCrop) {
      return;
    }

    const initialText = t('canvas.defaultText');
    const estimatedTextWidth = Math.max(
      120,
      Math.round(initialText.length * DEFAULT_TEXT_ANNOTATION_STYLE.fontSize * 0.56 + 16),
    );
    const estimatedTextHeight = Math.max(40, Math.round(DEFAULT_TEXT_ANNOTATION_STYLE.fontSize * 1.5 + 8));
    const annotationId = crypto.randomUUID();
    const nextAnnotation: AnnotationModel = {
      id: annotationId,
      kind: 'text',
      start: currentTime,
      duration: 2.5,
      x: Math.max(0, Math.round((baseCrop.w - estimatedTextWidth) / 2)),
      y: Math.max(0, Math.round((baseCrop.h - estimatedTextHeight) / 2)),
      text: initialText,
      style: {
        ...DEFAULT_TEXT_ANNOTATION_STYLE,
      },
    };

    const nextAnnotations = [...annotations, nextAnnotation];
    replaceAnnotationsCommit(nextAnnotations, annotationId);
    setSelectedSliceId(null);
    setSelectedAnnotationId(annotationId);
  }, [
    annotations,
    baseCrop,
    currentTime,
    replaceAnnotationsCommit,
    setSelectedAnnotationId,
    setSelectedSliceId,
    t,
  ]);

  const handleCreateImageAnnotation = useCallback(
    async (file: File) => {
      if (!baseCrop) {
        return;
      }

      let imageUrl = '';

      try {
        imageUrl = URL.createObjectURL(file);
        const meta = await readImageMetaFromObjectUrl(imageUrl);
        const maxWidth = Math.max(72, Math.round(baseCrop.w * 0.35));
        const scale = Math.min(1, maxWidth / Math.max(1, meta.width));
        const width = Math.max(24, Math.round(meta.width * scale));
        const height = Math.max(24, Math.round(meta.height * scale));
        const annotationId = crypto.randomUUID();

        const nextAnnotation: AnnotationModel = {
          id: annotationId,
          kind: 'image',
          start: currentTime,
          duration: 3,
          x: Math.max(0, Math.round((baseCrop.w - width) / 2)),
          y: Math.max(0, Math.round((baseCrop.h - height) / 2)),
          width,
          height,
          file,
          imageUrl,
        };

        const nextAnnotations = [...annotations, nextAnnotation];
        replaceAnnotationsCommit(nextAnnotations, annotationId);
        setSelectedSliceId(null);
        setSelectedAnnotationId(annotationId);
      } catch (error) {
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }
        setImportError(toErrorMessage(error));
      }
    },
    [
      annotations,
      baseCrop,
      currentTime,
      replaceAnnotationsCommit,
      setSelectedAnnotationId,
      setSelectedSliceId,
    ],
  );

  const handleSelectedAnnotationChange = useCallback(
    (annotationId: string | null) => {
      setSelectedSliceId(null);
      setSelectedAnnotationId(annotationId);
    },
    [setSelectedAnnotationId, setSelectedSliceId],
  );

  const handleAnnotationPositionPreview = useCallback(
    (annotationId: string, x: number, y: number) => {
      if (!baseCrop) {
        return;
      }

      const nextAnnotations = annotations.map((annotation) => {
        if (annotation.id !== annotationId) {
          return annotation;
        }

        const clamped = clampAnnotationPosition(annotation, x, y, baseCrop);
        return {
          ...annotation,
          x: clamped.x,
          y: clamped.y,
        };
      });

      pendingAnnotationPreviewRef.current = nextAnnotations;
      replaceAnnotationsPreview(nextAnnotations);
    },
    [annotations, baseCrop, replaceAnnotationsPreview],
  );

  const handleAnnotationImageResizePreview = useCallback(
    (annotationId: string, x: number, y: number, width: number, height: number) => {
      if (!baseCrop) {
        return;
      }

      const nextAnnotations = annotations.map((annotation) => {
        if (annotation.id !== annotationId || annotation.kind !== 'image') {
          return annotation;
        }

        const clamped = clampImageAnnotationRect(baseCrop, x, y, width, height);
        return {
          ...annotation,
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
        };
      });

      pendingAnnotationPreviewRef.current = nextAnnotations;
      replaceAnnotationsPreview(nextAnnotations);
    },
    [annotations, baseCrop, replaceAnnotationsPreview],
  );

  const handleAnnotationPositionCommit = useCallback(() => {
    const pending = pendingAnnotationPreviewRef.current;
    if (!pending) {
      return;
    }

    replaceAnnotationsCommit(pending, selectedAnnotationId);
    pendingAnnotationPreviewRef.current = null;
  }, [replaceAnnotationsCommit, selectedAnnotationId]);

  const handleTextAnnotationChange = useCallback(
    (annotationId: string, text: string) => {
      const selected = annotations.find(
        (annotation) => annotation.id === annotationId && annotation.kind === 'text',
      );

      if (!selected) {
        return;
      }

      const nextAnnotations = annotations.map((annotation) => {
        if (annotation.id !== selected.id || annotation.kind !== 'text') {
          return annotation;
        }

        return {
          ...annotation,
          text,
        };
      });

      replaceAnnotationsCommit(nextAnnotations, selected.id);
    },
    [annotations, replaceAnnotationsCommit],
  );

  const handleTextAnnotationStyleChange = useCallback(
    (nextStyle: Partial<AnnotationTextStyle>) => {
      if (!selectedTextAnnotation) {
        return;
      }

      const nextAnnotations = annotations.map((annotation) => {
        if (annotation.id !== selectedTextAnnotation.id || annotation.kind !== 'text') {
          return annotation;
        }

        return {
          ...annotation,
          style: {
            ...annotation.style,
            ...nextStyle,
            fontSize: Math.max(8, Math.min(180, Math.round(nextStyle.fontSize ?? annotation.style.fontSize))),
            outlineWidth: Math.max(0, Math.min(24, nextStyle.outlineWidth ?? annotation.style.outlineWidth)),
          },
        };
      });

      replaceAnnotationsCommit(nextAnnotations, selectedTextAnnotation.id);
    },
    [annotations, replaceAnnotationsCommit, selectedTextAnnotation],
  );

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
    exportSettings.height,
    exportSettings.format,
    exportSettings.width,
    logFfmpegCommandPreview,
    setFfmpegStatus,
    slices.length,
    t,
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
      const state = useEditorStore.getState();
      revokeVideoObjectUrl(state.video);
      revokeAnnotationImageUrls(state.annotations);
    };
  }, []);

  useEffect(() => {
    return () => {
      captureRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      captureRecorderRef.current = null;
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    };
  }, []);

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

    await handleImportVideo(file);
    setScreenCaptureState('idle');
  }, [handleImportVideo, t]);

  const handleStartScreenCapture = useCallback(async () => {
    if (!supportsScreenCapture || screenCaptureState !== 'idle') {
      return;
    }

    setImportError(null);
    setExportError(null);
    setScreenCaptureState('starting');

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const mimeType = getScreenRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      captureChunksRef.current = [];
      captureStreamRef.current = stream;
      captureRecorderRef.current = recorder;

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          const activeRecorder = captureRecorderRef.current;
          if (activeRecorder && activeRecorder.state === 'recording') {
            void finishScreenCapture().catch((error: unknown) => {
              setImportError(toErrorMessage(error));
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
      setImportError(toErrorMessage(error));
      captureRecorderRef.current = null;
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
      captureChunksRef.current = [];
      setScreenCaptureState('idle');
    }
  }, [finishScreenCapture, screenCaptureState, supportsScreenCapture]);

  const handleStopScreenCapture = useCallback(() => {
    if (captureRecorderRef.current?.state !== 'recording') {
      setScreenCaptureState('idle');
      return;
    }

    void finishScreenCapture().catch((error: unknown) => {
      setImportError(toErrorMessage(error));
      setScreenCaptureState('idle');
    });
  }, [finishScreenCapture]);

  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return;
      }

      const hasVideoFile = getFirstVideoFile(event.dataTransfer.files) !== null;
      const hasImageFile = getFirstImageFile(event.dataTransfer.files) !== null;
      if (!hasVideoFile && !(hasVideo && hasImageFile)) {
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
      const nextImage = getFirstImageFile(event.dataTransfer.files);
      if (!nextFile && !(hasVideo && nextImage)) {
        return;
      }

      event.preventDefault();

      if (hasVideo && nextImage && !nextFile) {
        void handleCreateImageAnnotation(nextImage);
        return;
      }

      if (video && !window.confirm(t('app.replaceVideoConfirm'))) {
        return;
      }

      if (nextFile) {
        void handleImportVideo(nextFile);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleCreateImageAnnotation, handleImportVideo, hasVideo, t, video]);

  return (
    <Drawer.Root open={isMobileSettingsDrawerOpen} onOpenChange={setIsMobileSettingsDrawerOpen}>
      <div
        className={`${hasVideo ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'} bg-[linear-gradient(160deg,#020617_0%,#0b1120_42%,#111827_100%)] text-slate-100`}
      >
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_92%_4%,rgba(16,185,129,0.2),transparent_30%)]" />

        <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-800/70 bg-slate-950/88 backdrop-blur">
          <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {hasVideo ? (
                <button
                  type="button"
                  onClick={handleReturnToLanding}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-100"
                  aria-label={t('app.back')}
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold">Screencast Editor</h1>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {hasVideo && video ? (
                <Popover.Root>
                  <Popover.Trigger
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800/85 bg-slate-950/78 text-slate-300 shadow-lg backdrop-blur transition hover:border-cyan-400/60 hover:bg-slate-900 hover:text-cyan-100"
                    aria-label={t('canvas.sourceInfo')}
                    title={t('canvas.sourceInfo')}
                  >
                    <CircleHelp size={18} />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner side="bottom" align="end" sideOffset={10} className="z-[120]">
                      <Popover.Popup className="z-[120] w-[min(68vw,420px)] rounded-xl border border-slate-800 bg-slate-950/98 p-3 shadow-2xl backdrop-blur">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                          {t('canvas.source')}
                        </div>
                        <div className="truncate text-sm font-medium text-white" title={video.file.name}>
                          {video.file.name}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          {videoInfoItems.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              ) : null}
              {hasVideo && baseCrop ? (
                <Drawer.Trigger
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-400/25 lg:hidden"
                >
                  <Download size={14} />
                  {t('app.export')}
                </Drawer.Trigger>
              ) : null}
            </div>
          </div>
        </header>

        {hasVideo && video && baseCrop ? (
          <>
            <main className="fixed inset-x-0 bottom-0 top-16 z-10 overflow-hidden lg:right-[23rem]">
              <Group orientation="vertical" className="h-full min-h-0">
                <Panel defaultSize="52%" minSize="12rem" className="min-h-0">
                  <section className="relative h-full min-h-0 px-1 pt-1 lg:pr-1">
                    <CanvasPreview
                      video={video}
                      fileName={video.file.name}
                      currentTime={currentTime}
                      sourceTime={previewSourceTime}
                      totalDuration={totalDuration}
                      baseCrop={baseCrop}
                      activeSceneCrop={activeSceneCrop}
                      activeAnnotations={activeAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      selectedTextAnnotation={selectedTextAnnotation}
                      hasActiveVideoSlice={Boolean(previewSlice)}
                      editMode={cropEditMode}
                      editCrop={effectiveEditCrop}
                      onStartCrop={handleStartCropEdit}
                      onEditCropPreview={handleEditCropPreview}
                      onConfirmEdit={handleConfirmCropEdit}
                      onCancelEdit={handleCancelCropEdit}
                      onResetEdit={handleResetCropEdit}
                      onCurrentTimeChange={setCurrentTime}
                      onSelectedAnnotationIdChange={handleSelectedAnnotationChange}
                      onAnnotationPositionPreview={handleAnnotationPositionPreview}
                      onAnnotationImageResizePreview={handleAnnotationImageResizePreview}
                      onAnnotationPositionCommit={handleAnnotationPositionCommit}
                      onTextAnnotationChange={handleTextAnnotationChange}
                      onTextAnnotationStyleChange={handleTextAnnotationStyleChange}
                      className="h-full"
                      fillHeight
                    />
                  </section>
                </Panel>

                <Separator className="group relative mx-1 my-0.5 h-4 shrink-0 lg:mr-1">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-800/90 transition group-hover:bg-cyan-400/60" />
                  <div className="absolute left-1/2 top-1/2 h-1.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900 transition group-hover:border-cyan-400/60 group-hover:bg-slate-800" />
                </Separator>

                <Panel defaultSize="48%" minSize="16rem" className="min-h-0">
                  <div className="h-full min-h-0 px-0.5 pb-[calc(env(safe-area-inset-bottom)+2px)] pt-0 lg:pr-1">
                    <SliceEditorTimeline
                      video={video}
                      slices={slices}
                      annotations={annotations}
                      currentTime={currentTime}
                      selectedSliceId={selectedSliceId}
                      selectedAnnotationId={selectedAnnotationId}
                      canStartSceneCrop={slices.length > 0}
                      canUndo={past.length > 0}
                      canRedo={future.length > 0}
                      onCurrentTimeChange={setCurrentTime}
                      onSelectedSliceIdChange={setSelectedSliceId}
                      onSelectedAnnotationIdChange={handleSelectedAnnotationChange}
                      onStartSceneCrop={handleStartSceneCropEdit}
                      onSlicesPreview={replaceSlicesPreview}
                      onSlicesCommit={replaceSlicesCommit}
                      onAnnotationsPreview={replaceAnnotationsPreview}
                      onAnnotationsCommit={replaceAnnotationsCommit}
                      onCreateTextAnnotation={handleCreateTextAnnotation}
                      onCreateImageAnnotation={handleCreateImageAnnotation}
                      baseCrop={baseCrop}
                      outputAspectRatio={outputAspectRatio}
                      onUndo={undo}
                      onRedo={redo}
                      className="h-full"
                      fillHeight
                    />
                  </div>
                </Panel>
              </Group>
            </main>

            <aside className="fixed bottom-0 right-0 top-16 z-20 hidden overflow-hidden border-l border-slate-800/80 bg-slate-950/30 backdrop-blur lg:block lg:w-[23rem]">
              <div className="h-full overflow-y-auto px-2 py-1">
                <PropertyPanel
                  baseCrop={baseCrop}
                  exportSettings={exportSettings}
                  ffmpegStatus={ffmpegStatus}
                  ffmpegError={ffmpegError}
                  isExporting={isExporting}
                  exportProgress={exportProgress}
                  exportProgressLabel={exportProgressLabel}
                  exportError={exportError}
                  onChangeExportSettings={updateExportSettings}
                  onExport={handleExport}
                  className="min-h-full border-none bg-transparent p-0 shadow-none rounded-none lg:w-full"
                />
              </div>
            </aside>
          </>
        ) : (
          <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-4 pb-6 pt-20 sm:px-6">
            <VideoDropzone
              onFileSelected={handleImportVideo}
              isLoading={isImporting || screenCaptureState === 'processing'}
              error={importError}
              mode="embedded"
              screenCapture={{
                isSupported: supportsScreenCapture,
                isStarting: screenCaptureState === 'starting' || screenCaptureState === 'processing',
                isRecording: screenCaptureState === 'recording',
                onStart: handleStartScreenCapture,
                onStop: handleStopScreenCapture,
              }}
            />
          </main>
        )}
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
                  exportProgress={exportProgress}
                  exportProgressLabel={exportProgressLabel}
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

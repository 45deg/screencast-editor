import { useCallback, useState } from 'react';

import { readImageMetaFromObjectUrl } from '../../lib/image';
import { readVideoMetadata, revokeVideoObjectUrl } from '../../lib/video';
import {
  DEFAULT_TEXT_ANNOTATION_STYLE,
  type AnnotationModel,
  type CropRect,
  type VideoMeta,
} from '../../types/editor';
import { revokeAnnotationImageUrls, toErrorMessage } from '../appUtils';

interface UseMediaImportHandlersArgs {
  video: VideoMeta | null;
  annotations: AnnotationModel[];
  baseCrop: CropRect | null;
  currentTime: number;
  setVideo: (video: VideoMeta) => void;
  replaceAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  setSelectedSliceId: (sliceId: string | null) => void;
  setSelectedAnnotationId: (annotationId: string | null) => void;
  clearVideo: () => void;
  ensureExportRuntimeReady: () => Promise<boolean>;
  resetExportState: () => void;
  t: (key: string) => string;
}

export function useMediaImportHandlers({
  video,
  annotations,
  baseCrop,
  currentTime,
  setVideo,
  replaceAnnotationsCommit,
  setSelectedSliceId,
  setSelectedAnnotationId,
  clearVideo,
  ensureExportRuntimeReady,
  resetExportState,
  t,
}: UseMediaImportHandlersArgs) {
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportVideo = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setImportError(null);
      resetExportState();

      try {
        const nextVideo = await readVideoMetadata(file);

        if (video) {
          revokeVideoObjectUrl(video);
        }
        revokeAnnotationImageUrls(annotations);

        setVideo(nextVideo);
        void ensureExportRuntimeReady();
      } catch (error) {
        setImportError(toErrorMessage(error));
      } finally {
        setIsImporting(false);
      }
    },
    [annotations, ensureExportRuntimeReady, resetExportState, setVideo, video],
  );

  const handleReturnToLanding = useCallback(() => {
    if (video) {
      revokeVideoObjectUrl(video);
    }
    revokeAnnotationImageUrls(annotations);

    clearVideo();
    setImportError(null);
    resetExportState();
  }, [annotations, clearVideo, resetExportState, video]);

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
          naturalWidth: meta.width,
          naturalHeight: meta.height,
          width,
          height,
          file,
          imageUrl,
          opacity: 1,
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

  return {
    importError,
    setImportError,
    isImporting,
    handleImportVideo,
    handleReturnToLanding,
    handleCreateTextAnnotation,
    handleCreateImageAnnotation,
  };
}

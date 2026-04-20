import { useCallback, useRef } from 'react';

import { clampAnnotationPosition, clampImageAnnotationRect } from '../appUtils';
import type { AnnotationModel, AnnotationTextStyle, CropRect, TextAnnotation } from '../../types/editor';

interface UseAnnotationHandlersArgs {
  annotations: AnnotationModel[];
  baseCrop: CropRect | null;
  selectedAnnotationId: string | null;
  selectedTextAnnotation: TextAnnotation | null;
  replaceAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  replaceAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  setSelectedSliceId: (sliceId: string | null) => void;
  setSelectedAnnotationId: (annotationId: string | null) => void;
}

export function useAnnotationHandlers({
  annotations,
  baseCrop,
  selectedAnnotationId,
  selectedTextAnnotation,
  replaceAnnotationsPreview,
  replaceAnnotationsCommit,
  setSelectedSliceId,
  setSelectedAnnotationId,
}: UseAnnotationHandlersArgs) {
  const pendingAnnotationPreviewRef = useRef<AnnotationModel[] | null>(null);

  const resetPendingAnnotationPreview = useCallback(() => {
    pendingAnnotationPreviewRef.current = null;
  }, []);

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

        const clamped = clampImageAnnotationRect(baseCrop, annotation, x, y, width, height);
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

  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) {
      return;
    }

    const nextAnnotations = annotations.filter((annotation) => annotation.id !== selectedAnnotationId);
    pendingAnnotationPreviewRef.current = null;
    replaceAnnotationsCommit(nextAnnotations, null);
    setSelectedAnnotationId(null);
  }, [annotations, replaceAnnotationsCommit, selectedAnnotationId, setSelectedAnnotationId]);

  return {
    pendingAnnotationPreviewRef,
    resetPendingAnnotationPreview,
    handleSelectedAnnotationChange,
    handleAnnotationPositionPreview,
    handleAnnotationImageResizePreview,
    handleAnnotationPositionCommit,
    handleTextAnnotationChange,
    handleTextAnnotationStyleChange,
    handleDeleteSelectedAnnotation,
  };
}

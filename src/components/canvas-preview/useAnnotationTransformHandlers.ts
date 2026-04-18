import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { clampAnnotationPosition, resizeImageAnnotationFromCorner, type ImageResizeMode } from './annotationMath';
import type { AnnotationModel, CropRect } from '../../types/editor';

interface FrameSize {
  width: number;
  height: number;
}

interface AnnotationDragState {
  annotation: AnnotationModel;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

interface AnnotationResizeState {
  annotation: Extract<AnnotationModel, { kind: 'image' }>;
  mode: ImageResizeMode;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
}

interface UseAnnotationTransformHandlersArgs {
  isEditing: boolean;
  frameSize: FrameSize;
  baseCrop: CropRect;
  onSelectedAnnotationIdChange: (annotationId: string | null) => void;
  onAnnotationPositionPreview: (annotationId: string, x: number, y: number) => void;
  onAnnotationImageResizePreview: (
    annotationId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onAnnotationPositionCommit: () => void;
}

export function useAnnotationTransformHandlers({
  isEditing,
  frameSize,
  baseCrop,
  onSelectedAnnotationIdChange,
  onAnnotationPositionPreview,
  onAnnotationImageResizePreview,
  onAnnotationPositionCommit,
}: UseAnnotationTransformHandlersArgs) {
  const annotationDragRef = useRef<AnnotationDragState | null>(null);
  const annotationResizeRef = useRef<AnnotationResizeState | null>(null);
  const [annotationDragging, setAnnotationDragging] = useState(false);
  const [annotationResizing, setAnnotationResizing] = useState(false);

  useEffect(() => {
    if (!annotationDragging || annotationResizing || isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = annotationDragRef.current;
      if (!current || frameSize.width <= 0 || frameSize.height <= 0) {
        return;
      }

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const previewScale = Math.min(
        frameSize.width / Math.max(1, baseCrop.w),
        frameSize.height / Math.max(1, baseCrop.h),
      );
      const clamped = clampAnnotationPosition(
        current.annotation,
        current.initialX + dx / Math.max(0.0001, previewScale),
        current.initialY + dy / Math.max(0.0001, previewScale),
        baseCrop,
      );

      onAnnotationPositionPreview(current.annotation.id, clamped.x, clamped.y);
    };

    const handlePointerUp = () => {
      annotationDragRef.current = null;
      setAnnotationDragging(false);
      onAnnotationPositionCommit();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    annotationDragging,
    annotationResizing,
    baseCrop,
    frameSize.height,
    frameSize.width,
    isEditing,
    onAnnotationPositionCommit,
    onAnnotationPositionPreview,
  ]);

  useEffect(() => {
    if (!annotationResizing || isEditing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = annotationResizeRef.current;
      if (!current || frameSize.width <= 0 || frameSize.height <= 0) {
        return;
      }

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const previewScale = Math.min(
        frameSize.width / Math.max(1, baseCrop.w),
        frameSize.height / Math.max(1, baseCrop.h),
      );

      const resized = resizeImageAnnotationFromCorner(
        {
          ...current.annotation,
          x: current.initialX,
          y: current.initialY,
          width: current.initialWidth,
          height: current.initialHeight,
        },
        current.mode,
        dx / Math.max(0.0001, previewScale),
        dy / Math.max(0.0001, previewScale),
        baseCrop,
      );

      onAnnotationImageResizePreview(current.annotation.id, resized.x, resized.y, resized.width, resized.height);
    };

    const handlePointerUp = () => {
      annotationResizeRef.current = null;
      setAnnotationResizing(false);
      onAnnotationPositionCommit();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    annotationResizing,
    baseCrop,
    frameSize.height,
    frameSize.width,
    isEditing,
    onAnnotationImageResizePreview,
    onAnnotationPositionCommit,
  ]);

  const beginAnnotationDrag = useCallback(
    (event: ReactPointerEvent, annotation: AnnotationModel) => {
      if (annotationResizing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      annotationDragRef.current = {
        annotation,
        startX: event.clientX,
        startY: event.clientY,
        initialX: annotation.x,
        initialY: annotation.y,
      };

      onSelectedAnnotationIdChange(annotation.id);
      setAnnotationDragging(true);
    },
    [annotationResizing, onSelectedAnnotationIdChange],
  );

  const beginImageResize = useCallback(
    (
      event: ReactPointerEvent,
      annotation: Extract<AnnotationModel, { kind: 'image' }>,
      mode: ImageResizeMode,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      annotationResizeRef.current = {
        annotation,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        initialX: annotation.x,
        initialY: annotation.y,
        initialWidth: annotation.width,
        initialHeight: annotation.height,
      };

      onSelectedAnnotationIdChange(annotation.id);
      setAnnotationDragging(false);
      setAnnotationResizing(true);
    },
    [onSelectedAnnotationIdChange],
  );

  return {
    annotationDragging,
    annotationResizing,
    setAnnotationDragging,
    setAnnotationResizing,
    beginAnnotationDrag,
    beginImageResize,
  };
}

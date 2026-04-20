import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

import { canMoveAnnotationLayer, moveAnnotationLayer } from '../../lib/annotationTimeline';
import { compactSlices, type AnnotationModel, type DerivedSlice, type SliceModel } from '../../types/editor';
import {
  updateAnnotationDurationWithSnap,
  updateAnnotationLeftEdgeWithSnap,
  updateAnnotationStartWithSnap,
  updateSliceLeftEdge,
  updateSliceDuration,
  updateSliceStart,
} from './sliceMutations';

const MIN_SLICE_DURATION = 0.5;

interface UseSliceEditorMutationHandlersArgs {
  slices: SliceModel[];
  slicesWithPos: DerivedSlice[];
  annotations: AnnotationModel[];
  pixelsPerSecond: number;
  currentTime: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  onSelectedAnnotationIdChange: (id: string | null) => void;
  onSlicesPreview: (slices: SliceModel[]) => void;
  onSlicesCommit: (slices: SliceModel[], selectedSliceId?: string | null) => void;
  onAnnotationsPreview: (annotations: AnnotationModel[]) => void;
  onAnnotationsCommit: (annotations: AnnotationModel[], selectedAnnotationId?: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useSliceEditorMutationHandlers({
  slices,
  slicesWithPos,
  annotations,
  pixelsPerSecond,
  currentTime,
  selectedSliceId,
  selectedAnnotationId,
  onSelectedAnnotationIdChange,
  onSlicesPreview,
  onSlicesCommit,
  onAnnotationsPreview,
  onAnnotationsCommit,
  onUndo,
  onRedo,
}: UseSliceEditorMutationHandlersArgs) {
  const pendingSliceCommitRef = useRef<SliceModel[] | null>(null);
  const pendingAnnotationCommitRef = useRef<AnnotationModel[] | null>(null);
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null);
  const getAnnotationSnapPoints = useCallback(
    (annotationId: string) => [
      ...slicesWithPos.flatMap((slice) => [slice.start, slice.end]),
      ...annotations
        .filter((annotation) => annotation.id !== annotationId)
        .flatMap((annotation) => [annotation.start, annotation.start + annotation.duration]),
    ],
    [annotations, slicesWithPos],
  );

  const selectedAnnotationIndex = annotations.findIndex((annotation) => annotation.id === selectedAnnotationId);
  const canMoveAnnotationUp =
    selectedAnnotationId !== null &&
    selectedAnnotationIndex >= 0 &&
    canMoveAnnotationLayer(annotations, selectedAnnotationId, 'up');
  const canMoveAnnotationDown =
    selectedAnnotationId !== null &&
    selectedAnnotationIndex >= 0 &&
    canMoveAnnotationLayer(annotations, selectedAnnotationId, 'down');

  const commitPendingSlices = useCallback(
    (nextSelectedId?: string | null) => {
      if (!pendingSliceCommitRef.current) {
        return;
      }

      onSlicesCommit(pendingSliceCommitRef.current, nextSelectedId);
      pendingSliceCommitRef.current = null;
    },
    [onSlicesCommit],
  );

  const commitPendingAnnotations = useCallback(
    (nextSelectedId?: string | null) => {
      if (!pendingAnnotationCommitRef.current) {
        return;
      }

      onAnnotationsCommit(pendingAnnotationCommitRef.current, nextSelectedId);
      pendingAnnotationCommitRef.current = null;
    },
    [onAnnotationsCommit],
  );

  const handleCut = useCallback(() => {
    const target = slicesWithPos.find((slice) => currentTime > slice.start && currentTime < slice.end);
    if (!target) {
      return;
    }

    const targetIndex = slices.findIndex((slice) => slice.id === target.id);
    if (targetIndex < 0) {
      return;
    }

    const leftDuration = currentTime - target.start;
    const rightDuration = target.end - currentTime;
    if (leftDuration < MIN_SLICE_DURATION || rightDuration < MIN_SLICE_DURATION) {
      return;
    }

    const ratio = leftDuration / target.duration;
    const splitSource = target.sourceStart + target.sourceDuration * ratio;

    const leftSlice: SliceModel = {
      id: nanoid(),
      sourceId: target.sourceId,
      timelineStart: target.start,
      sourceStart: target.sourceStart,
      sourceEnd: splitSource,
      duration: leftDuration,
      crop: target.crop ? { ...target.crop } : null,
    };
    const rightSlice: SliceModel = {
      id: nanoid(),
      sourceId: target.sourceId,
      timelineStart: currentTime,
      sourceStart: splitSource,
      sourceEnd: target.sourceEnd,
      duration: rightDuration,
      crop: target.crop ? { ...target.crop } : null,
    };

    const nextSlices = [...slices];
    nextSlices.splice(targetIndex, 1, leftSlice, rightSlice);
    onSlicesCommit(nextSlices, rightSlice.id);
    onSelectedAnnotationIdChange(null);
  }, [currentTime, onSelectedAnnotationIdChange, onSlicesCommit, slices, slicesWithPos]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotationId) {
      const nextAnnotations = annotations.filter((annotation) => annotation.id !== selectedAnnotationId);
      onAnnotationsCommit(nextAnnotations, null);
      return;
    }

    if (selectedSliceId) {
      const nextSlices = compactSlices(slices.filter((slice) => slice.id !== selectedSliceId));
      onSlicesCommit(nextSlices, null);
    }
  }, [annotations, onAnnotationsCommit, onSlicesCommit, selectedAnnotationId, selectedSliceId, slices]);

  const handleSpeedValueChange = useCallback(
    (nextSpeed: number | null) => {
      if (!selectedSliceId || nextSpeed === null) {
        return;
      }

      if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
        return;
      }

      const updated = slices.map((slice) => {
        if (slice.id !== selectedSliceId) {
          return slice;
        }

        const sourceDuration = slice.sourceEnd - slice.sourceStart;
        return {
          ...slice,
          duration: Math.max(MIN_SLICE_DURATION, sourceDuration / nextSpeed),
        };
      });

      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, selectedSliceId, slices],
  );

  const handleSpeedValueCommit = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleResizeSlice = useCallback(
    (sliceId: string, newDuration: number) => {
      const clamped = Math.max(MIN_SLICE_DURATION, newDuration);
      const updated = updateSliceDuration(slices, sliceId, clamped);
      if (updated === slices) {
        return;
      }

      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleResizeSliceEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleResizeSliceStart = useCallback(
    (sliceId: string, nextStart: number) => {
      const updated = updateSliceLeftEdge(slices, sliceId, nextStart);
      if (updated === slices) {
        return;
      }

      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleResizeSliceStartEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleMoveSlice = useCallback(
    (sliceId: string, nextStart: number) => {
      const updated = updateSliceStart(slices, sliceId, nextStart);
      if (updated === slices) {
        return;
      }

      pendingSliceCommitRef.current = updated;
      onSlicesPreview(updated);
    },
    [onSlicesPreview, slices],
  );

  const handleMoveSliceEnd = useCallback(() => {
    commitPendingSlices();
  }, [commitPendingSlices]);

  const handleMoveAnnotation = useCallback(
    (annotationId: string, nextStart: number) => {
      const snapPoints = getAnnotationSnapPoints(annotationId);
      const updated = updateAnnotationStartWithSnap(
        annotations,
        annotationId,
        nextStart,
        snapPoints,
        pixelsPerSecond,
      );
      if (updated === annotations) {
        return;
      }

      pendingAnnotationCommitRef.current = updated;
      onAnnotationsPreview(updated);
    },
    [annotations, getAnnotationSnapPoints, onAnnotationsPreview, pixelsPerSecond],
  );

  const handleMoveAnnotationEnd = useCallback(() => {
    commitPendingAnnotations();
  }, [commitPendingAnnotations]);

  const handleResizeAnnotation = useCallback(
    (annotationId: string, nextDuration: number) => {
      const snapPoints = getAnnotationSnapPoints(annotationId);
      const updated = updateAnnotationDurationWithSnap(
        annotations,
        annotationId,
        nextDuration,
        snapPoints,
        pixelsPerSecond,
      );
      pendingAnnotationCommitRef.current = updated;
      onAnnotationsPreview(updated);
    },
    [annotations, getAnnotationSnapPoints, onAnnotationsPreview, pixelsPerSecond],
  );

  const handleResizeAnnotationEnd = useCallback(() => {
    commitPendingAnnotations();
  }, [commitPendingAnnotations]);

  const handleResizeAnnotationStart = useCallback(
    (annotationId: string, nextStart: number) => {
      const snapPoints = getAnnotationSnapPoints(annotationId);
      const updated = updateAnnotationLeftEdgeWithSnap(
        annotations,
        annotationId,
        nextStart,
        snapPoints,
        pixelsPerSecond,
      );
      pendingAnnotationCommitRef.current = updated;
      onAnnotationsPreview(updated);
    },
    [annotations, getAnnotationSnapPoints, onAnnotationsPreview, pixelsPerSecond],
  );

  const handleResizeAnnotationStartEnd = useCallback(() => {
    commitPendingAnnotations();
  }, [commitPendingAnnotations]);

  const handleMoveAnnotationLayer = useCallback(
    (annotationId: string, direction: 'up' | 'down') => {
      const updated = moveAnnotationLayer(annotations, annotationId, direction);
      if (updated === annotations) {
        return;
      }

      onAnnotationsCommit(updated, annotationId);
    },
    [annotations, onAnnotationsCommit],
  );

  const handleAnnotationDragStart = useCallback((annotationId: string) => {
    setDraggingAnnotationId(annotationId);
  }, []);

  const handleAnnotationDragEnd = useCallback(() => {
    setDraggingAnnotationId(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName ?? '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedSliceId || selectedAnnotationId) {
          event.preventDefault();
          handleDeleteSelected();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleDeleteSelected, onRedo, onUndo, selectedAnnotationId, selectedSliceId]);

  return {
    canMoveAnnotationUp,
    canMoveAnnotationDown,
    draggingAnnotationId,
    handleCut,
    handleDeleteSelected,
    handleSpeedValueChange,
    handleSpeedValueCommit,
    handleResizeSlice,
    handleResizeSliceEnd,
    handleResizeSliceStart,
    handleResizeSliceStartEnd,
    handleMoveSlice,
    handleMoveSliceEnd,
    handleMoveAnnotation,
    handleMoveAnnotationEnd,
    handleResizeAnnotation,
    handleResizeAnnotationEnd,
    handleResizeAnnotationStart,
    handleResizeAnnotationStartEnd,
    handleMoveAnnotationLayer,
    handleAnnotationDragStart,
    handleAnnotationDragEnd,
  };
}

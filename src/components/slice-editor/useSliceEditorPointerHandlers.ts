import { useCallback, type RefObject } from 'react';
import type { PanInfo } from 'framer-motion';

import type { DerivedAnnotation, DerivedSlice } from '../../types/editor';

interface UseSliceEditorPointerHandlersArgs {
  timelineRef: RefObject<HTMLDivElement | null>;
  currentTime: number;
  totalDuration: number;
  pixelsPerSecond: number;
  draggingAnnotationId: string | null;
  slicesWithPos: DerivedSlice[];
  annotationsWithPos: DerivedAnnotation[];
  onCurrentTimeChange: (time: number) => void;
  onSelectedSliceIdChange: (id: string | null) => void;
  onSelectedAnnotationIdChange: (id: string | null) => void;
}

export function useSliceEditorPointerHandlers({
  timelineRef,
  currentTime,
  totalDuration,
  pixelsPerSecond,
  draggingAnnotationId,
  slicesWithPos,
  annotationsWithPos,
  onCurrentTimeChange,
  onSelectedSliceIdChange,
  onSelectedAnnotationIdChange,
}: UseSliceEditorPointerHandlersArgs) {
  const updateTimeFromClientX = useCallback(
    (clientX: number) => {
      const element = timelineRef.current;
      if (!element) {
        return currentTime;
      }

      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left;
      const nextTime = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
      onCurrentTimeChange(nextTime);
      return nextTime;
    },
    [currentTime, onCurrentTimeChange, pixelsPerSecond, timelineRef, totalDuration],
  );

  const getSliceIdAtTime = useCallback(
    (time: number): string | null => {
      const hit = slicesWithPos.find((slice) => time >= slice.start && time < slice.end);
      if (hit) {
        return hit.id;
      }

      return null;
    },
    [slicesWithPos],
  );

  const getAnnotationIdAtTime = useCallback(
    (time: number): string | null => {
      const active = annotationsWithPos.filter((annotation) => time >= annotation.start && time < annotation.end);
      if (!active.length) {
        return null;
      }

      return active[active.length - 1]?.id ?? null;
    },
    [annotationsWithPos],
  );

  const handleTimelinePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (draggingAnnotationId) {
        return;
      }

      const target = event.target as Element;
      const nextTime = updateTimeFromClientX(event.clientX);
      const clickedSliceBlock = target.closest('[data-timeline-slice-block="true"]');
      const clickedAnnotationBlock = target.closest('[data-timeline-annotation-block="true"]');

      if (clickedAnnotationBlock) {
        const hitAnnotation = getAnnotationIdAtTime(nextTime);
        onSelectedSliceIdChange(null);
        onSelectedAnnotationIdChange(hitAnnotation);
        return;
      }

      if (clickedSliceBlock) {
        const hitSlice = getSliceIdAtTime(nextTime);
        onSelectedAnnotationIdChange(null);
        onSelectedSliceIdChange(hitSlice);
        return;
      }

      if (event.target === event.currentTarget || target.id === 'ruler') {
        const hitAnnotation = getAnnotationIdAtTime(nextTime);
        if (hitAnnotation) {
          onSelectedSliceIdChange(null);
          onSelectedAnnotationIdChange(hitAnnotation);
          return;
        }

        const hitSlice = getSliceIdAtTime(nextTime);
        onSelectedAnnotationIdChange(null);
        onSelectedSliceIdChange(hitSlice);
      }
    },
    [
      draggingAnnotationId,
      getAnnotationIdAtTime,
      getSliceIdAtTime,
      onSelectedAnnotationIdChange,
      onSelectedSliceIdChange,
      updateTimeFromClientX,
    ],
  );

  const handleTimelinePan = useCallback(
    (_event: Event, info: PanInfo) => {
      updateTimeFromClientX(info.point.x);
    },
    [updateTimeFromClientX],
  );

  return {
    handleTimelinePointerDown,
    handleTimelinePan,
  };
}

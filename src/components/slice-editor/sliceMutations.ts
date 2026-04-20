import { MIN_ANNOTATION_DURATION } from '../../lib/annotationTimeline';
import type { AnnotationModel, SliceModel } from '../../types/editor';

const SNAP_THRESHOLD_PX = 12;
const MIN_SNAP_THRESHOLD_SECONDS = 0.03;
const MAX_SNAP_THRESHOLD_SECONDS = 0.18;

function getSnapThresholdSeconds(pixelsPerSecond: number): number {
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) {
    return MAX_SNAP_THRESHOLD_SECONDS;
  }

  return Math.min(
    MAX_SNAP_THRESHOLD_SECONDS,
    Math.max(MIN_SNAP_THRESHOLD_SECONDS, SNAP_THRESHOLD_PX / pixelsPerSecond),
  );
}

function snapTimeToPoints(time: number, snapPoints: number[], thresholdSeconds: number): number {
  let closest = time;
  let closestDistance = thresholdSeconds;

  snapPoints.forEach((point) => {
    const distance = Math.abs(point - time);
    if (distance <= closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  });

  return closest;
}

export function updateSliceDuration(slices: SliceModel[], sliceId: string, duration: number): SliceModel[] {
  const targetSlice = slices.find((slice) => slice.id === sliceId);
  if (!targetSlice) {
    return slices;
  }

  const nextSliceStart = slices
    .filter((slice) => slice.id !== sliceId && slice.timelineStart >= targetSlice.timelineStart)
    .reduce<number | null>(
      (closest, slice) => (closest === null || slice.timelineStart < closest ? slice.timelineStart : closest),
      null,
    );
  const maxDuration = nextSliceStart === null ? Number.POSITIVE_INFINITY : Math.max(0.0001, nextSliceStart - targetSlice.timelineStart);
  const nextDuration = Math.min(duration, maxDuration);
  if (nextDuration === targetSlice.duration) {
    return slices;
  }

  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      duration: nextDuration,
    };
  });
}

export function updateSliceStart(slices: SliceModel[], sliceId: string, timelineStart: number): SliceModel[] {
  const targetSlice = slices.find((slice) => slice.id === sliceId);
  if (!targetSlice) {
    return slices;
  }

  const previousSliceEnd = slices
    .filter((slice) => slice.id !== sliceId && slice.timelineStart + slice.duration <= targetSlice.timelineStart)
    .reduce((latestEnd, slice) => Math.max(latestEnd, slice.timelineStart + slice.duration), 0);
  const nextSliceStart = slices
    .filter((slice) => slice.id !== sliceId && slice.timelineStart >= targetSlice.timelineStart)
    .reduce<number | null>(
      (closest, slice) => (closest === null || slice.timelineStart < closest ? slice.timelineStart : closest),
      null,
    );
  const maxStart =
    nextSliceStart === null ? Number.POSITIVE_INFINITY : Math.max(previousSliceEnd, nextSliceStart - targetSlice.duration);
  const nextTimelineStart = Math.max(previousSliceEnd, Math.min(timelineStart, maxStart));
  if (nextTimelineStart === targetSlice.timelineStart) {
    return slices;
  }

  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      timelineStart: nextTimelineStart,
    };
  });
}

export function updateSliceLeftEdge(slices: SliceModel[], sliceId: string, timelineStart: number): SliceModel[] {
  const targetSlice = slices.find((slice) => slice.id === sliceId);
  if (!targetSlice) {
    return slices;
  }

  const previousSliceEnd = slices
    .filter((slice) => slice.id !== sliceId && slice.timelineStart + slice.duration <= targetSlice.timelineStart)
    .reduce((latestEnd, slice) => Math.max(latestEnd, slice.timelineStart + slice.duration), 0);
  const currentEnd = targetSlice.timelineStart + targetSlice.duration;
  const maxStart = Math.max(previousSliceEnd, currentEnd - 0.0001);
  const nextTimelineStart = Math.max(previousSliceEnd, Math.min(timelineStart, maxStart));
  const nextDuration = Math.max(0.0001, currentEnd - nextTimelineStart);

  if (nextTimelineStart === targetSlice.timelineStart && nextDuration === targetSlice.duration) {
    return slices;
  }

  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      timelineStart: nextTimelineStart,
      duration: nextDuration,
    };
  });
}

export function updateAnnotationStart(
  annotations: AnnotationModel[],
  annotationId: string,
  start: number,
): AnnotationModel[] {
  const targetAnnotation = annotations.find((annotation) => annotation.id === annotationId);
  if (!targetAnnotation || targetAnnotation.start === start) {
    return annotations;
  }

  return annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation;
    }

    return {
      ...annotation,
      start,
    };
  });
}

export function updateAnnotationStartWithSnap(
  annotations: AnnotationModel[],
  annotationId: string,
  start: number,
  snapPoints: number[],
  pixelsPerSecond: number,
): AnnotationModel[] {
  const snappedStart = Math.max(0, snapTimeToPoints(start, snapPoints, getSnapThresholdSeconds(pixelsPerSecond)));
  return updateAnnotationStart(annotations, annotationId, snappedStart);
}

export function updateAnnotationDurationWithSnap(
  annotations: AnnotationModel[],
  annotationId: string,
  duration: number,
  snapPoints: number[],
  pixelsPerSecond: number,
): AnnotationModel[] {
  const targetAnnotation = annotations.find((annotation) => annotation.id === annotationId);
  if (!targetAnnotation) {
    return annotations;
  }

  const rawDuration = Math.max(MIN_ANNOTATION_DURATION, duration);
  const snappedEnd = snapTimeToPoints(
    targetAnnotation.start + rawDuration,
    snapPoints.filter((point) => point >= targetAnnotation.start + MIN_ANNOTATION_DURATION),
    getSnapThresholdSeconds(pixelsPerSecond),
  );
  const snappedDuration = Math.max(MIN_ANNOTATION_DURATION, snappedEnd - targetAnnotation.start);

  if (snappedDuration === targetAnnotation.duration) {
    return annotations;
  }

  return annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation;
    }

    return {
      ...annotation,
      duration: snappedDuration,
    };
  });
}

export function updateAnnotationLeftEdgeWithSnap(
  annotations: AnnotationModel[],
  annotationId: string,
  start: number,
  snapPoints: number[],
  pixelsPerSecond: number,
): AnnotationModel[] {
  const targetAnnotation = annotations.find((annotation) => annotation.id === annotationId);
  if (!targetAnnotation) {
    return annotations;
  }

  const currentEnd = targetAnnotation.start + targetAnnotation.duration;
  const snappedStart = Math.max(
    0,
    snapTimeToPoints(start, snapPoints, getSnapThresholdSeconds(pixelsPerSecond)),
  );
  const nextStart = Math.min(snappedStart, currentEnd - MIN_ANNOTATION_DURATION);
  const nextDuration = Math.max(MIN_ANNOTATION_DURATION, currentEnd - nextStart);

  if (nextStart === targetAnnotation.start && nextDuration === targetAnnotation.duration) {
    return annotations;
  }

  return annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation;
    }

    return {
      ...annotation,
      start: nextStart,
      duration: nextDuration,
    };
  });
}

import type { AnnotationModel, SliceModel } from '../../types/editor';

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

import type { AnnotationModel, SliceModel } from '../../types/editor';

export function updateSliceDuration(slices: SliceModel[], sliceId: string, duration: number): SliceModel[] {
  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      duration,
    };
  });
}

export function updateSliceStart(slices: SliceModel[], sliceId: string, timelineStart: number): SliceModel[] {
  return slices.map((slice) => {
    if (slice.id !== sliceId) {
      return slice;
    }

    return {
      ...slice,
      timelineStart,
    };
  });
}

export function updateAnnotationStart(
  annotations: AnnotationModel[],
  annotationId: string,
  start: number,
): AnnotationModel[] {
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

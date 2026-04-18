import type { AnnotationModel, DerivedAnnotation } from '../types/editor';

export type LayerMoveDirection = 'up' | 'down';

export interface UnifiedAnnotationPlacement<T extends DerivedAnnotation = DerivedAnnotation> {
  annotation: T;
  row: number;
  zIndex: number;
}

export interface UnifiedAnnotationLayout<T extends DerivedAnnotation = DerivedAnnotation> {
  placements: UnifiedAnnotationPlacement<T>[];
  rowCount: number;
}

export const MIN_ANNOTATION_DURATION = 0.1;

const OVERLAP_EPSILON = 0.0001;

function annotationEnd(annotation: AnnotationModel): number {
  return annotation.start + annotation.duration;
}

function annotationsOverlap(a: AnnotationModel, b: AnnotationModel): boolean {
  return (
    a.start < annotationEnd(b) - OVERLAP_EPSILON &&
    b.start < annotationEnd(a) - OVERLAP_EPSILON
  );
}

function getOverlappingIndices(annotations: AnnotationModel[], annotationId: string): number[] {
  const selected = annotations.find((annotation) => annotation.id === annotationId);
  if (!selected) {
    return [];
  }

  const indices: number[] = [];

  for (let index = 0; index < annotations.length; index += 1) {
    if (annotationsOverlap(selected, annotations[index])) {
      indices.push(index);
    }
  }

  return indices;
}

export function canMoveAnnotationLayer(
  annotations: AnnotationModel[],
  annotationId: string,
  direction: LayerMoveDirection,
): boolean {
  const selectedIndex = annotations.findIndex((annotation) => annotation.id === annotationId);
  if (selectedIndex < 0) {
    return false;
  }

  const overlapIndices = getOverlappingIndices(annotations, annotationId);
  if (overlapIndices.length <= 1) {
    return false;
  }

  const groupPosition = overlapIndices.indexOf(selectedIndex);
  if (groupPosition < 0) {
    return false;
  }

  if (direction === 'up') {
    return groupPosition > 0;
  }

  return groupPosition < overlapIndices.length - 1;
}

export function buildUnifiedAnnotationLayout<T extends DerivedAnnotation>(annotations: T[]): UnifiedAnnotationLayout<T> {
  if (!annotations.length) {
    return {
      placements: [],
      rowCount: 1,
    };
  }

  const rows: Array<Array<{ start: number; end: number }>> = [];
  const rowById = new Map<string, number>();

  // Iterate in draw order (lower index first, higher index later).
  // Overlapping later items are pushed to lower rows and should render above.
  annotations.forEach((annotation) => {
    let row = 0;

    while (true) {
      const segments = rows[row] ?? [];
      const overlaps = segments.some(
        (segment) =>
          annotation.start < segment.end - OVERLAP_EPSILON && segment.start < annotation.end - OVERLAP_EPSILON,
      );

      if (!overlaps) {
        break;
      }

      row += 1;
    }

    if (!rows[row]) {
      rows[row] = [];
    }

    rows[row].push({ start: annotation.start, end: annotation.end });
    rowById.set(annotation.id, row);
  });

  return {
    rowCount: Math.max(1, rows.length),
    placements: annotations.map((annotation, index) => {
      const row = rowById.get(annotation.id) ?? 0;
      return {
        annotation,
        row,
        zIndex: row * 1000 + index + 1,
      };
    }),
  };
}

export function moveAnnotationLayer(
  annotations: AnnotationModel[],
  annotationId: string,
  direction: LayerMoveDirection,
): AnnotationModel[] {
  const selectedIndex = annotations.findIndex((annotation) => annotation.id === annotationId);
  if (selectedIndex < 0) {
    return annotations;
  }

  const overlapIndices = getOverlappingIndices(annotations, annotationId);
  if (overlapIndices.length <= 1) {
    return annotations;
  }

  const groupPosition = overlapIndices.indexOf(selectedIndex);
  if (groupPosition < 0) {
    return annotations;
  }

  const targetGroupPosition = direction === 'up' ? groupPosition - 1 : groupPosition + 1;
  if (targetGroupPosition < 0 || targetGroupPosition >= overlapIndices.length) {
    return annotations;
  }

  const targetIndex = overlapIndices[targetGroupPosition];

  const next = [...annotations];
  const selected = next[selectedIndex];
  next[selectedIndex] = next[targetIndex];
  next[targetIndex] = selected;
  return next;
}

export function resizeAnnotationDuration(
  annotations: AnnotationModel[],
  annotationId: string,
  nextDuration: number,
): AnnotationModel[] {
  const safeDuration = Math.max(MIN_ANNOTATION_DURATION, nextDuration);
  return annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return annotation;
    }

    return {
      ...annotation,
      duration: safeDuration,
    };
  });
}

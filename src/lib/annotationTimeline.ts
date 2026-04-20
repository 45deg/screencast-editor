import type { AnnotationModel, DerivedAnnotation } from '../types/editor';

export type LayerMoveDirection = 'up' | 'down';
export type LayerEdgeDirection = 'front' | 'back';

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

function getSelectedOverlapPosition(annotations: AnnotationModel[], annotationId: string) {
  const selectedIndex = annotations.findIndex((annotation) => annotation.id === annotationId);
  if (selectedIndex < 0) {
    return null;
  }

  const overlapIndices = getOverlappingIndices(annotations, annotationId);
  if (overlapIndices.length <= 1) {
    return null;
  }

  const groupPosition = overlapIndices.indexOf(selectedIndex);
  if (groupPosition < 0) {
    return null;
  }

  return {
    selectedIndex,
    overlapIndices,
    groupPosition,
  };
}

export function canMoveAnnotationLayer(
  annotations: AnnotationModel[],
  annotationId: string,
  direction: LayerMoveDirection,
): boolean {
  const overlap = getSelectedOverlapPosition(annotations, annotationId);
  if (!overlap) {
    return false;
  }

  if (direction === 'up') {
    return overlap.groupPosition > 0;
  }

  return overlap.groupPosition < overlap.overlapIndices.length - 1;
}

export function canMoveAnnotationLayerToEdge(
  annotations: AnnotationModel[],
  annotationId: string,
  direction: LayerEdgeDirection,
): boolean {
  const overlap = getSelectedOverlapPosition(annotations, annotationId);
  if (!overlap) {
    return false;
  }

  if (direction === 'front') {
    return overlap.groupPosition < overlap.overlapIndices.length - 1;
  }

  return overlap.groupPosition > 0;
}

export function hasOverlappingAnnotationLayers(
  annotations: AnnotationModel[],
  annotationId: string,
): boolean {
  return getSelectedOverlapPosition(annotations, annotationId) !== null;
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
  const overlap = getSelectedOverlapPosition(annotations, annotationId);
  if (!overlap) {
    return annotations;
  }

  const targetGroupPosition = direction === 'up' ? overlap.groupPosition - 1 : overlap.groupPosition + 1;
  if (targetGroupPosition < 0 || targetGroupPosition >= overlap.overlapIndices.length) {
    return annotations;
  }

  const targetIndex = overlap.overlapIndices[targetGroupPosition];

  const next = [...annotations];
  const selected = next[overlap.selectedIndex];
  next[overlap.selectedIndex] = next[targetIndex];
  next[targetIndex] = selected;
  return next;
}

export function moveAnnotationLayerToEdge(
  annotations: AnnotationModel[],
  annotationId: string,
  direction: LayerEdgeDirection,
): AnnotationModel[] {
  const overlap = getSelectedOverlapPosition(annotations, annotationId);
  if (!overlap) {
    return annotations;
  }

  const targetIndex =
    direction === 'front'
      ? overlap.overlapIndices[overlap.overlapIndices.length - 1]
      : overlap.overlapIndices[0];

  if (targetIndex === overlap.selectedIndex) {
    return annotations;
  }

  const next = [...annotations];
  const [selected] = next.splice(overlap.selectedIndex, 1);
  next.splice(targetIndex, 0, selected);
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

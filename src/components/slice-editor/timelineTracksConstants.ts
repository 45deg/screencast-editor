import type { DerivedAnnotation } from '../../types/editor';

export const VIDEO_TRACK_TOP = 28;
export const VIDEO_TRACK_HEIGHT = 96;
export const TRACK_GAP = 8;
export const ANNOTATION_TRACK_PADDING = 5;
export const ANNOTATION_ROW_HEIGHT = 28;
export const ANNOTATION_ROW_GAP = 3;
export const MIN_ANNOTATION_TRACK_HEIGHT = 34;
export const MIN_ANNOTATION_BLOCK_WIDTH = 36;

export function getAnnotationRowTop(row: number): number {
  return ANNOTATION_TRACK_PADDING + row * (ANNOTATION_ROW_HEIGHT + ANNOTATION_ROW_GAP);
}

export function getAnnotationLabel(annotation: DerivedAnnotation): string {
  if (annotation.kind === 'text') {
    return annotation.text || 'Text';
  }

  return annotation.file.name;
}

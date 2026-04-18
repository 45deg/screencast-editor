import type { DerivedAnnotation } from '../../types/editor';

export const VIDEO_TRACK_TOP = 28;
export const VIDEO_TRACK_HEIGHT = 116;
export const TRACK_GAP = 10;
export const ANNOTATION_TRACK_PADDING = 6;
export const ANNOTATION_ROW_HEIGHT = 30;
export const ANNOTATION_ROW_GAP = 4;
export const MIN_ANNOTATION_TRACK_HEIGHT = 40;
export const MIN_ANNOTATION_BLOCK_WIDTH = 40;

export function getAnnotationRowTop(row: number): number {
  return ANNOTATION_TRACK_PADDING + row * (ANNOTATION_ROW_HEIGHT + ANNOTATION_ROW_GAP);
}

export function getAnnotationLabel(annotation: DerivedAnnotation): string {
  if (annotation.kind === 'text') {
    return annotation.text || 'Text';
  }

  return annotation.file.name;
}

export type OutputFormat = 'gif' | 'mp4';
export type PaletteMode = 'global' | 'single';
export type DitherMode = 'none' | 'bayer' | 'floyd_steinberg' | 'sierra2' | 'sierra2_4a';
export type Mp4Preset = 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VideoMeta {
  file: File;
  objectUrl: string;
  width: number;
  height: number;
  duration: number;
}

export interface SliceModel {
  id: string;
  timelineStart: number;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  crop: CropRect | null;
}

export interface DerivedSlice extends SliceModel {
  start: number;
  end: number;
  sourceDuration: number;
  speed: number;
}

export interface AnnotationTextStyle {
  boxEnabled: boolean;
  boxColor: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  outlineWidth: number;
  outlineColor: string;
}

interface AnnotationBase {
  id: string;
  start: number;
  duration: number;
  x: number;
  y: number;
}

export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  text: string;
  style: AnnotationTextStyle;
}

export interface ImageAnnotation extends AnnotationBase {
  kind: 'image';
  file: File;
  imageUrl: string;
  width: number;
  height: number;
}

export type AnnotationModel = TextAnnotation | ImageAnnotation;

export type DerivedAnnotation<T extends AnnotationModel = AnnotationModel> = T & {
  end: number;
};

export interface ExportSettings {
  format: OutputFormat;
  width: number;
  height: number;
  keepAspectRatio: boolean;
  gifFps: number;
  paletteMode: PaletteMode;
  dither: DitherMode;
  mp4Fps: number;
  mp4Preset: Mp4Preset;
}

export interface TimelineScrollInfo {
  left: number;
  width: number;
}

export interface EditorSnapshot {
  slices: SliceModel[];
  annotations: AnnotationModel[];
  globalCrop: CropRect | null;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
}

export const DEFAULT_TEXT_ANNOTATION_STYLE: AnnotationTextStyle = {
  boxEnabled: true,
  boxColor: '#b91c1c',
  textColor: '#ffffff',
  bold: false,
  italic: false,
  fontSize: 44,
  outlineWidth: 0,
  outlineColor: '#000000',
};

export function cloneCrop(crop: CropRect | null): CropRect | null {
  if (!crop) {
    return null;
  }

  return { ...crop };
}

export function cloneSlices(slices: SliceModel[]): SliceModel[] {
  return slices.map((slice) => ({
    ...slice,
    timelineStart: Math.max(0, slice.timelineStart),
    duration: Math.max(0.0001, slice.duration),
    crop: cloneCrop(slice.crop),
  }));
}

export function cloneAnnotationStyle(style: AnnotationTextStyle): AnnotationTextStyle {
  return {
    ...style,
    fontSize: Math.max(8, Math.round(style.fontSize)),
    outlineWidth: Math.max(0, style.outlineWidth),
  };
}

export function cloneAnnotation(annotation: AnnotationModel): AnnotationModel {
  if (annotation.kind === 'text') {
    return {
      ...annotation,
      start: Math.max(0, annotation.start),
      duration: Math.max(0.0001, annotation.duration),
      style: cloneAnnotationStyle(annotation.style),
    };
  }

  return {
    ...annotation,
    start: Math.max(0, annotation.start),
    duration: Math.max(0.0001, annotation.duration),
    width: Math.max(1, annotation.width),
    height: Math.max(1, annotation.height),
  };
}

export function cloneAnnotations(annotations: AnnotationModel[]): AnnotationModel[] {
  return annotations.map((annotation) => cloneAnnotation(annotation));
}

export function deriveSlices(slices: SliceModel[]): DerivedSlice[] {
  return [...slices]
    .sort((a, b) => a.timelineStart - b.timelineStart || a.id.localeCompare(b.id))
    .map((slice) => {
    const duration = Math.max(0.0001, slice.duration);
    const start = Math.max(0, slice.timelineStart);
    const end = start + duration;
    const sourceDuration = Math.max(0.0001, slice.sourceEnd - slice.sourceStart);
    const speed = sourceDuration / duration;

    return {
      ...slice,
      duration,
      start,
      end,
      sourceDuration,
      speed,
    };
  });
}

export function deriveAnnotations(annotations: AnnotationModel[]): DerivedAnnotation[] {
  return [...annotations]
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
    .map((annotation) => ({
      ...cloneAnnotation(annotation),
      end: Math.max(0, annotation.start) + Math.max(0.0001, annotation.duration),
    }));
}

export function findSliceAtTimelineTime(slices: SliceModel[], time: number): DerivedSlice | null {
  const derived = deriveSlices(slices);
  const hit = [...derived].reverse().find((slice) => time >= slice.start && time < slice.end);

  if (hit) {
    return hit;
  }

  if (derived.length && time >= Math.max(...derived.map((slice) => slice.end))) {
    return [...derived].sort((a, b) => a.end - b.end)[derived.length - 1] ?? null;
  }

  return null;
}

export function getSourceTimeAtTimelineTime(slices: SliceModel[], time: number): number {
  const activeSlice = findSliceAtTimelineTime(slices, time);
  if (!activeSlice) {
    return 0;
  }

  const localOffset = Math.max(0, Math.min(activeSlice.duration, time - activeSlice.start));
  const sourceProgress = localOffset / Math.max(0.0001, activeSlice.duration);

  return activeSlice.sourceStart + activeSlice.sourceDuration * sourceProgress;
}

export function getActiveAnnotationsAtTimelineTime(
  annotations: AnnotationModel[],
  time: number,
): DerivedAnnotation[] {
  const derived = deriveAnnotations(annotations);
  return derived.filter((annotation) => time >= annotation.start && time < annotation.end);
}

export function getTotalDuration(slices: SliceModel[], annotations: AnnotationModel[] = []): number {
  const sliceEnds = deriveSlices(slices).map((slice) => slice.end);
  const annotationEnds = deriveAnnotations(annotations).map((annotation) => annotation.end);

  return Math.max(0, ...sliceEnds, ...annotationEnds);
}

export function cropEquals(a: CropRect | null, b: CropRect | null): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

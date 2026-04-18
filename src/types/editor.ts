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
  globalCrop: CropRect | null;
}

export function cloneCrop(crop: CropRect | null): CropRect | null {
  if (!crop) {
    return null;
  }

  return { ...crop };
}

export function cloneSlices(slices: SliceModel[]): SliceModel[] {
  return slices.map((slice) => ({
    ...slice,
    crop: cloneCrop(slice.crop),
  }));
}

export function deriveSlices(slices: SliceModel[]): DerivedSlice[] {
  let offset = 0;

  return slices.map((slice) => {
    const start = offset;
    const end = start + slice.duration;
    const sourceDuration = Math.max(0.0001, slice.sourceEnd - slice.sourceStart);
    const speed = sourceDuration / Math.max(0.0001, slice.duration);

    offset = end;

    return {
      ...slice,
      start,
      end,
      sourceDuration,
      speed,
    };
  });
}

export function findSliceAtTimelineTime(slices: SliceModel[], time: number): DerivedSlice | null {
  const derived = deriveSlices(slices);
  const hit = derived.find((slice) => time >= slice.start && time < slice.end);

  if (hit) {
    return hit;
  }

  if (derived.length && time >= derived[derived.length - 1].end) {
    return derived[derived.length - 1];
  }

  return derived[0] ?? null;
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

export function getTotalDuration(slices: SliceModel[]): number {
  return slices.reduce((acc, slice) => acc + slice.duration, 0);
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

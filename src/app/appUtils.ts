import { i18n } from '../i18n';
import {
  deriveSlices,
  type AnnotationModel,
  type CropRect,
  type SliceModel,
  type VideoMeta,
} from '../types/editor';

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t('app.unknownError');
}

export function getDefaultCrop(width: number, height: number): CropRect {
  return {
    x: 0,
    y: 0,
    w: width,
    h: height,
  };
}

export function clampCropToVideo(crop: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(crop.y)));
  const maxW = Math.max(1, video.width - x);
  const maxH = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxW, Math.round(crop.w))),
    h: Math.max(1, Math.min(maxH, Math.round(crop.h))),
  };
}

export function normalizeCropForStorage(crop: CropRect, video: VideoMeta): CropRect | null {
  const safe = clampCropToVideo(crop, video);

  if (safe.x === 0 && safe.y === 0 && safe.w === video.width && safe.h === video.height) {
    return null;
  }

  return safe;
}

export function findSliceIdAtTimelineTime(slices: SliceModel[], time: number): string | null {
  const derived = deriveSlices(slices);
  const hit = derived.find((slice) => time >= slice.start && time < slice.end);

  if (hit) {
    return hit.id;
  }

  if (derived.length) {
    const latest = [...derived].sort((a, b) => a.end - b.end)[derived.length - 1];
    if (latest && time >= latest.end) {
      return latest.id;
    }
  }

  return null;
}

export function revokeAnnotationImageUrls(annotations: AnnotationModel[]): void {
  for (const annotation of annotations) {
    if (annotation.kind !== 'image') {
      continue;
    }

    URL.revokeObjectURL(annotation.imageUrl);
  }
}

export function clampAnnotationPosition(
  annotation: AnnotationModel,
  nextX: number,
  nextY: number,
  baseCrop: CropRect,
) {
  if (annotation.kind === 'image') {
    return {
      x: Math.max(0, Math.min(baseCrop.w - annotation.width, Math.round(nextX))),
      y: Math.max(0, Math.min(baseCrop.h - annotation.height, Math.round(nextY))),
    };
  }

  return {
    x: Math.max(0, Math.min(baseCrop.w - 8, Math.round(nextX))),
    y: Math.max(0, Math.min(baseCrop.h - 8, Math.round(nextY))),
  };
}

export function clampImageAnnotationRect(
  baseCrop: CropRect,
  annotation: Extract<AnnotationModel, { kind: 'image' }>,
  nextX: number,
  nextY: number,
  nextWidth: number,
  nextHeight: number,
) {
  const aspectRatio = Math.max(1 / 4096, annotation.naturalWidth / Math.max(1, annotation.naturalHeight));
  const maxWidth = Math.max(24, baseCrop.w - Math.max(0, Math.round(nextX)));
  const maxHeight = Math.max(24, baseCrop.h - Math.max(0, Math.round(nextY)));
  const widthChange = Math.abs(nextWidth - annotation.width) / Math.max(1, annotation.width);
  const heightChange = Math.abs(nextHeight - annotation.height) / Math.max(1, annotation.height);

  let width =
    widthChange >= heightChange
      ? Math.max(24, Math.round(nextWidth))
      : Math.max(24, Math.round(nextHeight * aspectRatio));
  let height = Math.max(24, Math.round(width / aspectRatio));

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.max(24, Math.round(height * aspectRatio));
  }

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.max(24, Math.round(width / aspectRatio));
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.max(24, Math.round(height * aspectRatio));
  }

  return {
    x: Math.max(0, Math.min(baseCrop.w - width, Math.round(nextX))),
    y: Math.max(0, Math.min(baseCrop.h - height, Math.round(nextY))),
    width,
    height,
  };
}

export function getFileExtension(fileName: string, fallback: string): string {
  const index = fileName.lastIndexOf('.');
  if (index <= 0 || index === fileName.length - 1) {
    return fallback;
  }

  return fileName.slice(index + 1).replace(/[^a-zA-Z0-9]/g, '') || fallback;
}

export function getSafeDownloadName(fileName: string, format: 'gif' | 'mp4'): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${base || 'export'}-edited.${format}`;
}

export function getFirstVideoFile(files: FileList | null): File | null {
  if (!files?.length) {
    return null;
  }

  return Array.from(files).find((file) => file.type.startsWith('video/')) ?? null;
}

export function getFirstImageFile(files: FileList | null): File | null {
  if (!files?.length) {
    return null;
  }

  return Array.from(files).find((file) => file.type.startsWith('image/')) ?? null;
}

export function formatDurationLabel(duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) {
    return '0:00';
  }

  const rounded = Math.round(duration);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function getScreenRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

export function getScreenRecordingExtension(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

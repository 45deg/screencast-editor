import { deriveSlices, type CropRect, type ExportSettings, type Mp4Preset, type SliceModel, type VideoMeta } from '../types/editor';

export function clampCrop(crop: CropRect, video: VideoMeta): CropRect {
  const x = Math.max(0, Math.min(video.width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(video.height - 1, Math.round(crop.y)));
  const maxWidth = Math.max(1, video.width - x);
  const maxHeight = Math.max(1, video.height - y);

  return {
    x,
    y,
    w: Math.max(1, Math.min(maxWidth, Math.round(crop.w))),
    h: Math.max(1, Math.min(maxHeight, Math.round(crop.h))),
  };
}

export function getBaseCrop(video: VideoMeta, globalCrop: CropRect | null): CropRect {
  if (!globalCrop) {
    return {
      x: 0,
      y: 0,
      w: video.width,
      h: video.height,
    };
  }

  return clampCrop(globalCrop, video);
}

export function getSortedSlices(slices: SliceModel[]) {
  return deriveSlices(slices).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function getOutputFrameDurationUs(fps: number): number {
  return Math.max(1, Math.round(1_000_000 / Math.max(1, fps)));
}

export function getTotalFrameCount(totalDuration: number, fps: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalDuration) * Math.max(1, fps) - 1e-9));
}

export function getTargetBitrate(width: number, height: number, fps: number, preset: Mp4Preset): number {
  const pixelsPerSecond = Math.max(1, width) * Math.max(1, height) * Math.max(1, fps);
  const multiplier =
    preset === 'ultrafast' || preset === 'superfast' || preset === 'veryfast'
      ? 0.14
      : preset === 'faster' || preset === 'fast' || preset === 'medium'
        ? 0.2
        : 0.28;

  return Math.max(900_000, Math.round(pixelsPerSecond * multiplier));
}

export function getConfiguredBitrate(width: number, height: number, exportSettings: ExportSettings): number {
  if (exportSettings.mp4BitrateMode === 'manual') {
    return Math.max(250_000, Math.round(exportSettings.mp4BitrateKbps * 1_000));
  }

  return getTargetBitrate(width, height, exportSettings.mp4Fps, exportSettings.mp4Preset);
}
